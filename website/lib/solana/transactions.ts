import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import type { SendOptions, TransactionSignature } from '@solana/web3.js';
import {
  PROGRAM_ID,
  SEEDS,
  bytes16ToString,
  getContractPda,
  getMarketConfigPda,
  getObservationPda,
} from './client.ts';

export interface WalletTransactionSigner {
  publicKey: PublicKey | null;
  sendTransaction: (
    transaction: Transaction,
    connection: Connection,
    options?: SendOptions
  ) => Promise<TransactionSignature>;
}

export type OnChainContractState = {
  address: PublicKey;
  contractId: string;
  marketSymbol: string;
  buyer: PublicKey;
  riskTaker: PublicKey;
  positionSide: 'long' | 'short';
  notionalCents: number;
  fixedRatePpm: number;
  intervalCount: number;
  intervalSeconds: number;
  startTime: number;
  endTime: number;
  requiredBuyerCollateral: bigint;
  requiredRiskTakerCollateral: bigint;
  depositedBuyerCollateral: bigint;
  depositedRiskTakerCollateral: bigint;
  accumulatedSettlementCents: bigint;
  submittedObservationsCount: number;
  lifecycleState: number;
  lifecycleLabel: string;
  bump: number;
  vaultBump: number;
};

export type OnChainMarketConfig = {
  address: PublicKey;
  admin: PublicKey;
  oracleAuthority: PublicKey;
  venueId: string;
  marketSymbol: string;
  intervalSeconds: number;
  minRatePpm: number;
  maxRatePpm: number;
  maxNotionalCents: bigint;
  safetyBufferBps: number;
  isPaused: boolean;
  bump: number;
};

export type OnChainObservation = {
  address: PublicKey;
  contract: PublicKey;
  intervalIndex: number;
  realizedRatePpm: number;
  intervalSettlementCents: bigint;
  cumulativeSettlementCents: bigint;
  recordedAt: number;
  bump: number;
};

const CONTRACT_STATE_LABELS = [
  'Open',
  'Matched',
  'Funded',
  'Active',
  'Settling',
  'Settled',
  'Cancelled',
  'Defaulted',
] as const;

const ACCOUNT_DISCRIMINATORS = {
  MarketConfig: Buffer.from([119, 255, 200, 88, 252, 82, 128, 24]),
  ContractAccount: Buffer.from([158, 92, 19, 55, 102, 209, 113, 218]),
  ObservationRecord: Buffer.from([80, 224, 178, 152, 235, 70, 104, 11]),
} as const;

function readU16(data: Buffer, offset: number): number {
  return data.readUInt16LE(offset);
}

function readU64(data: Buffer, offset: number): bigint {
  return data.readBigUInt64LE(offset);
}

function readI64(data: Buffer, offset: number): bigint {
  return data.readBigInt64LE(offset);
}

function readPubkey(data: Buffer, offset: number): PublicKey {
  return new PublicKey(data.subarray(offset, offset + 32));
}

function readFixedString(data: Buffer, offset: number, length: number): string {
  return bytes16ToString(data.subarray(offset, offset + length));
}

function assertAccountData(
  address: PublicKey,
  info: Awaited<ReturnType<Connection['getAccountInfo']>>,
  expectedLength: number,
  discriminator: Buffer
): Buffer | null {
  if (!info) return null;
  if (!info.owner.equals(PROGRAM_ID)) {
    throw new Error(`Unexpected owner for ${address.toBase58()}`);
  }
  if (info.data.length !== expectedLength) {
    throw new Error(
      `Unexpected account size for ${address.toBase58()}: ${info.data.length} bytes`
    );
  }
  const data = Buffer.from(info.data);
  if (!data.subarray(0, 8).equals(discriminator)) {
    throw new Error(`Unexpected account discriminator for ${address.toBase58()}`);
  }
  return data;
}

export async function simulateAndSendTransaction(params: {
  connection: Connection;
  wallet: WalletTransactionSigner;
  instructions: TransactionInstruction[];
  description: string;
}): Promise<TransactionSignature> {
  const { connection, wallet, instructions, description } = params;
  if (!wallet.publicKey) {
    throw new Error('Connect a wallet before signing this transaction.');
  }
  if (instructions.length === 0) {
    throw new Error(`No instructions were provided for ${description}.`);
  }

  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  const transaction = new Transaction({
    feePayer: wallet.publicKey,
    recentBlockhash: latestBlockhash.blockhash,
  }).add(...instructions);

  // The wallet owns the required signer and cannot be asked to sign twice.
  // Convert the legacy transaction to a versioned simulation payload with a
  // placeholder signature, then disable signature verification for simulation.
  // This lets us validate the program instruction before opening the wallet
  // approval prompt.
  const simulationTransaction = new VersionedTransaction(transaction.compileMessage());
  const simulation = await connection.simulateTransaction(simulationTransaction, {
    commitment: 'confirmed',
    replaceRecentBlockhash: false,
    sigVerify: false,
  });
  if (simulation.value.err) {
    const errString = typeof simulation.value.err === 'string'
      ? simulation.value.err
      : JSON.stringify(simulation.value.err);
    const logs = simulation.value.logs?.filter(Boolean).slice(-4).join(' | ');

    if (errString.includes('AccountNotFound')) {
      throw new Error(
        `Wallet has 0 SOL on Solana Testnet. Fund your wallet with free Testnet SOL at https://faucet.solana.com, and verify your wallet network is set to Testnet.`
      );
    }
    if (errString.includes('InsufficientFundsForRent')) {
      throw new Error(
        `Insufficient SOL for account rent and network fees. Get free Testnet SOL at https://faucet.solana.com.`
      );
    }
    throw new Error(
      `${description} simulation failed: ${logs || errString}`
    );
  }

  const signature = await wallet.sendTransaction(transaction, connection, {
    preflightCommitment: 'confirmed',
    maxRetries: 3,
  });

  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    'confirmed'
  );

  return signature;
}

export async function fetchMarketConfig(
  connection: Connection,
  marketSymbol = 'SOL-PERP'
): Promise<OnChainMarketConfig | null> {
  const [address] = getMarketConfigPda(marketSymbol);
  const info = await connection.getAccountInfo(address, 'confirmed');
  const data = assertAccountData(address, info, 148, ACCOUNT_DISCRIMINATORS.MarketConfig);
  if (!data) return null;

  return {
    address,
    admin: readPubkey(data, 8),
    oracleAuthority: readPubkey(data, 40),
    venueId: readFixedString(data, 72, 16),
    marketSymbol: readFixedString(data, 88, 16),
    intervalSeconds: Number(readU64(data, 104)),
    minRatePpm: Number(readI64(data, 112)),
    maxRatePpm: Number(readI64(data, 120)),
    maxNotionalCents: readU64(data, 128),
    safetyBufferBps: readU16(data, 136),
    isPaused: data[138] === 1,
    bump: data[139],
  };
}

export async function fetchContractAccount(
  connection: Connection,
  contractId: string
): Promise<OnChainContractState | null> {
  const [address] = getContractPda(contractId);
  const info = await connection.getAccountInfo(address, 'confirmed');
  const data = assertAccountData(address, info, 192, ACCOUNT_DISCRIMINATORS.ContractAccount);
  if (!data) return null;

  const lifecycleState = data[189];
  return {
    address,
    contractId: readFixedString(data, 8, 16),
    marketSymbol: readFixedString(data, 24, 16),
    buyer: readPubkey(data, 40),
    riskTaker: readPubkey(data, 72),
    positionSide: data[104] === 0 ? 'long' : 'short',
    notionalCents: Number(readU64(data, 105)),
    fixedRatePpm: Number(readI64(data, 113)),
    intervalCount: readU16(data, 121),
    intervalSeconds: Number(readU64(data, 123)),
    startTime: Number(readI64(data, 131)),
    endTime: Number(readI64(data, 139)),
    requiredBuyerCollateral: readU64(data, 147),
    requiredRiskTakerCollateral: readU64(data, 155),
    depositedBuyerCollateral: readU64(data, 163),
    depositedRiskTakerCollateral: readU64(data, 171),
    accumulatedSettlementCents: readI64(data, 179),
    submittedObservationsCount: readU16(data, 187),
    lifecycleState,
    lifecycleLabel: CONTRACT_STATE_LABELS[lifecycleState] ?? `Unknown (${lifecycleState})`,
    bump: data[190],
    vaultBump: data[191],
  };
}

export async function fetchContractAccounts(
  connection: Connection
): Promise<OnChainContractState[]> {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    commitment: 'confirmed',
    filters: [{ dataSize: 192 }],
  });

  return accounts.flatMap(({ pubkey, account }) => {
    try {
      const data = assertAccountData(
        pubkey,
        account,
        192,
        ACCOUNT_DISCRIMINATORS.ContractAccount
      );
      if (!data) return [];

      const lifecycleState = data[189];
      return [{
        address: pubkey,
        contractId: readFixedString(data, 8, 16),
        marketSymbol: readFixedString(data, 24, 16),
        buyer: readPubkey(data, 40),
        riskTaker: readPubkey(data, 72),
        positionSide: data[104] === 0 ? 'long' : 'short',
        notionalCents: Number(readU64(data, 105)),
        fixedRatePpm: Number(readI64(data, 113)),
        intervalCount: readU16(data, 121),
        intervalSeconds: Number(readU64(data, 123)),
        startTime: Number(readI64(data, 131)),
        endTime: Number(readI64(data, 139)),
        requiredBuyerCollateral: readU64(data, 147),
        requiredRiskTakerCollateral: readU64(data, 155),
        depositedBuyerCollateral: readU64(data, 163),
        depositedRiskTakerCollateral: readU64(data, 171),
        accumulatedSettlementCents: readI64(data, 179),
        submittedObservationsCount: readU16(data, 187),
        lifecycleState,
        lifecycleLabel: CONTRACT_STATE_LABELS[lifecycleState] ?? `Unknown (${lifecycleState})`,
        bump: data[190],
        vaultBump: data[191],
      }];
    } catch {
      // Ignore accounts owned by this program that do not match the current
      // ContractAccount layout (for example future account types).
      return [];
    }
  });
}

export async function fetchObservationRecord(
  connection: Connection,
  contractAddress: PublicKey,
  intervalIndex: number
): Promise<OnChainObservation | null> {
  const [address] = getObservationPda(contractAddress, intervalIndex);
  const info = await connection.getAccountInfo(address, 'confirmed');
  const data = assertAccountData(address, info, 75, ACCOUNT_DISCRIMINATORS.ObservationRecord);
  if (!data) return null;

  return {
    address,
    contract: readPubkey(data, 8),
    intervalIndex: readU16(data, 40),
    realizedRatePpm: Number(readI64(data, 42)),
    intervalSettlementCents: readI64(data, 50),
    cumulativeSettlementCents: readI64(data, 58),
    recordedAt: Number(readI64(data, 66)),
    bump: data[74],
  };
}

export function createContractId(prefix: string, wallet: PublicKey): string {
  const normalizedPrefix = prefix.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
  const timestamp = Date.now().toString(36).slice(-7).toUpperCase();
  const walletSuffix = wallet.toBase58().slice(-6);
  return `${normalizedPrefix}${timestamp}${walletSuffix}`.slice(0, 16);
}

export function lamportsToSol(lamports: bigint | number): number {
  return Number(lamports) / 1_000_000_000;
}

export function formatSignature(signature: string): string {
  return `${signature.slice(0, 8)}…${signature.slice(-8)}`;
}

export { SEEDS };
