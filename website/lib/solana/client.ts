/**
 * FundingLock Solana Client
 *
 * Provides typed PDA derivation, transaction instruction builders, account deserializers,
 * and high-level contract interaction methods.
 */

import { PublicKey, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import type { ContractStatus } from '../domain/types.ts';

export const PROGRAM_ID = new PublicKey('78VTWQn5FdEE3vWvincjDG5cp1J7x3s8ioZzcXEMksxx');

export const SEEDS = {
  MARKET_CONFIG: Buffer.from('market_config'),
  CONTRACT: Buffer.from('contract'),
  VAULT: Buffer.from('vault'),
  OBSERVATION: Buffer.from('observation'),
};

/**
 * Format fixed-size byte array string for PDA seeds
 */
export function stringToBytes16(str: string): Buffer {
  const buf = Buffer.alloc(16);
  buf.write(str.slice(0, 16), 'utf-8');
  return buf;
}

export function bytes16ToString(bytes: Uint8Array): string {
  let end = bytes.indexOf(0);
  if (end === -1) end = bytes.length;
  return Buffer.from(bytes.slice(0, end)).toString('utf-8');
}

/**
 * Derive MarketConfig PDA
 */
export function getMarketConfigPda(
  marketSymbol = 'SOL-PERP',
  programId = PROGRAM_ID
): [PublicKey, number] {
  const symbolBytes = stringToBytes16(marketSymbol);
  return PublicKey.findProgramAddressSync([SEEDS.MARKET_CONFIG, symbolBytes], programId);
}

/**
 * Derive Contract PDA
 */
export function getContractPda(
  contractId: string,
  programId = PROGRAM_ID
): [PublicKey, number] {
  const idBytes = stringToBytes16(contractId);
  return PublicKey.findProgramAddressSync([SEEDS.CONTRACT, idBytes], programId);
}

/**
 * Derive Collateral Vault PDA
 */
export function getVaultPda(
  contractPubkey: PublicKey,
  programId = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEEDS.VAULT, contractPubkey.toBuffer()], programId);
}

/**
 * Derive Observation Record PDA
 */
export function getObservationPda(
  contractPubkey: PublicKey,
  intervalIndex: number,
  programId = PROGRAM_ID
): [PublicKey, number] {
  const indexBuf = Buffer.alloc(2);
  indexBuf.writeUInt16LE(intervalIndex, 0);
  return PublicKey.findProgramAddressSync(
    [SEEDS.OBSERVATION, contractPubkey.toBuffer(), indexBuf],
    programId
  );
}

/**
 * Instruction builder: Create Offer
 */
export function buildCreateOfferIx(params: {
  contractId: string;
  marketSymbol: string;
  buyer: PublicKey;
  positionSide: 'long' | 'short';
  notionalCents: number;
  fixedRatePpm: number;
  intervalCount: number;
  startTime: number;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = params.programId || PROGRAM_ID;
  const [contractPda] = getContractPda(params.contractId, programId);
  const [marketConfigPda] = getMarketConfigPda(params.marketSymbol, programId);

  // Instruction data buffer: Discriminator (8) + id (16) + side (1) + notional (8) + rate (8) + count (2) + start (8)
  const data = Buffer.alloc(8 + 16 + 1 + 8 + 8 + 2 + 8);
  // Discriminator: [79, 102, 102, 101, 114, 67, 114, 101]
  Buffer.from([79, 102, 102, 101, 114, 67, 114, 101]).copy(data, 0);
  stringToBytes16(params.contractId).copy(data, 8);
  data.writeUInt8(params.positionSide === 'long' ? 0 : 1, 24);
  data.writeBigUInt64LE(BigInt(params.notionalCents), 25);
  data.writeBigInt64LE(BigInt(params.fixedRatePpm), 33);
  data.writeUInt16LE(params.intervalCount, 41);
  data.writeBigInt64LE(BigInt(params.startTime), 43);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: contractPda, isSigner: false, isWritable: true },
      { pubkey: marketConfigPda, isSigner: false, isWritable: false },
      { pubkey: params.buyer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Instruction builder: Accept Offer
 */
export function buildAcceptOfferIx(params: {
  contractPda: PublicKey;
  riskTaker: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = params.programId || PROGRAM_ID;
  const data = Buffer.from([65, 99, 99, 101, 112, 116, 79, 102]);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.contractPda, isSigner: false, isWritable: true },
      { pubkey: params.riskTaker, isSigner: true, isWritable: true },
    ],
    data,
  });
}

/**
 * Instruction builder: Deposit Collateral
 */
export function buildDepositCollateralIx(params: {
  contractPda: PublicKey;
  vaultPda: PublicKey;
  depositor: PublicKey;
  amountLamports: number;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = params.programId || PROGRAM_ID;
  const data = Buffer.alloc(8 + 8);
  Buffer.from([68, 101, 112, 111, 115, 105, 116, 67]).copy(data, 0);
  data.writeBigUInt64LE(BigInt(params.amountLamports), 8);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.contractPda, isSigner: false, isWritable: true },
      { pubkey: params.vaultPda, isSigner: false, isWritable: true },
      { pubkey: params.depositor, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Instruction builder: Activate Contract
 */
export function buildActivateContractIx(params: {
  contractPda: PublicKey;
  marketConfigPda: PublicKey;
  authority: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = params.programId || PROGRAM_ID;
  const data = Buffer.from([65, 99, 116, 105, 118, 97, 116, 101]);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.contractPda, isSigner: false, isWritable: true },
      { pubkey: params.marketConfigPda, isSigner: false, isWritable: false },
      { pubkey: params.authority, isSigner: true, isWritable: true },
    ],
    data,
  });
}

/**
 * Instruction builder: Record Funding Observation
 */
export function buildRecordObservationIx(params: {
  contractPda: PublicKey;
  marketConfigPda: PublicKey;
  oracleAuthority: PublicKey;
  intervalIndex: number;
  realizedRatePpm: number;
  recordedAt: number;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = params.programId || PROGRAM_ID;
  const [observationPda] = getObservationPda(params.contractPda, params.intervalIndex, programId);

  const data = Buffer.alloc(8 + 2 + 8 + 8);
  Buffer.from([82, 101, 99, 111, 114, 100, 79, 98]).copy(data, 0);
  data.writeUInt16LE(params.intervalIndex, 8);
  data.writeBigInt64LE(BigInt(params.realizedRatePpm), 10);
  data.writeBigInt64LE(BigInt(params.recordedAt), 18);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.contractPda, isSigner: false, isWritable: true },
      { pubkey: observationPda, isSigner: false, isWritable: true },
      { pubkey: params.marketConfigPda, isSigner: false, isWritable: false },
      { pubkey: params.oracleAuthority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Instruction builder: Finalize Contract
 */
export function buildFinalizeContractIx(params: {
  contractPda: PublicKey;
  vaultPda: PublicKey;
  buyer: PublicKey;
  riskTaker: PublicKey;
  caller: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = params.programId || PROGRAM_ID;
  const data = Buffer.from([70, 105, 110, 97, 108, 105, 122, 101]);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.contractPda, isSigner: false, isWritable: true },
      { pubkey: params.vaultPda, isSigner: false, isWritable: true },
      { pubkey: params.buyer, isSigner: false, isWritable: true },
      { pubkey: params.riskTaker, isSigner: false, isWritable: true },
      { pubkey: params.caller, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Instruction builder: Cancel Unmatched Offer
 */
export function buildCancelOfferIx(params: {
  contractPda: PublicKey;
  vaultPda: PublicKey;
  buyer: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = params.programId || PROGRAM_ID;
  const data = Buffer.from([67, 97, 110, 99, 101, 108, 79, 102]);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.contractPda, isSigner: false, isWritable: true },
      { pubkey: params.vaultPda, isSigner: false, isWritable: true },
      { pubkey: params.buyer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * State enum mapper
 */
export const STATE_MAP: Record<number, ContractStatus> = {
  0: 'Open',
  1: 'Matched',
  2: 'Funded',
  3: 'Active',
  4: 'Settling',
  5: 'Settled',
  6: 'Cancelled',
  7: 'Defaulted',
};
