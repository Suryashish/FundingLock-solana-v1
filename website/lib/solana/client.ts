/**
 * FundingLock Solana Client
 *
 * Provides typed PDA derivation, transaction instruction builders, account deserializers,
 * and high-level contract interaction methods.
 */

import { PublicKey, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import type { ContractStatus } from '../domain/types.ts';

export const PROGRAM_ID = new PublicKey('HSMBzbTfQQgLKk9Bv7d9WkLiK1yvKCs9FkeGgBhgfZj9');
export const TESTNET_ORACLE_PUBKEY = new PublicKey('A5oiFqG3hn39WSCGvCvSCbkWQJ8kzjNQM135WXnowv3E');

export const SEEDS = {
  MARKET_CONFIG: Buffer.from('market_config'),
  CONTRACT: Buffer.from('contract'),
  VAULT: Buffer.from('vault'),
  OBSERVATION: Buffer.from('observation'),
};

// Anchor instruction discriminators for the current on-chain program.
// These must be the SHA-256("global:<instruction>") first eight bytes;
// ASCII instruction names are not valid Anchor discriminators.
const INSTRUCTION_DISCRIMINATORS = {
  initializeMarket: Buffer.from([35, 35, 189, 193, 155, 48, 170, 203]),
  createOffer: Buffer.from([237, 233, 192, 168, 248, 7, 249, 241]),
  acceptOffer: Buffer.from([227, 82, 234, 131, 1, 18, 48, 2]),
  depositCollateral: Buffer.from([156, 131, 142, 116, 146, 247, 162, 120]),
  activateContract: Buffer.from([204, 69, 36, 86, 236, 147, 218, 39]),
  recordFundingObservation: Buffer.from([240, 5, 202, 73, 254, 50, 86, 35]),
  finalizeContract: Buffer.from([49, 201, 251, 177, 252, 136, 109, 178]),
  cancelUnmatchedOffer: Buffer.from([208, 157, 107, 124, 5, 55, 81, 222]),
} as const;

export function getInstructionDiscriminator(
  name: keyof typeof INSTRUCTION_DISCRIMINATORS
): Buffer {
  return Buffer.from(INSTRUCTION_DISCRIMINATORS[name]);
}

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
 * Instruction builder: Initialize the SOL-PERP market configuration.
 * This is a one-time testnet setup action; the first signer becomes admin.
 */
export function buildInitializeMarketIx(params: {
  venueId: string;
  marketSymbol: string;
  intervalSeconds: number;
  minRatePpm: number;
  maxRatePpm: number;
  maxNotionalCents: number;
  safetyBufferBps: number;
  oracleAuthority: PublicKey;
  admin: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = params.programId || PROGRAM_ID;
  const [marketConfigPda] = getMarketConfigPda(params.marketSymbol, programId);
  const data = Buffer.alloc(8 + 16 + 16 + 8 + 8 + 8 + 8 + 2 + 32);
  let offset = 0;

  getInstructionDiscriminator('initializeMarket').copy(data, offset);
  offset += 8;
  stringToBytes16(params.venueId).copy(data, offset);
  offset += 16;
  stringToBytes16(params.marketSymbol).copy(data, offset);
  offset += 16;
  data.writeBigUInt64LE(BigInt(params.intervalSeconds), offset);
  offset += 8;
  data.writeBigInt64LE(BigInt(params.minRatePpm), offset);
  offset += 8;
  data.writeBigInt64LE(BigInt(params.maxRatePpm), offset);
  offset += 8;
  data.writeBigUInt64LE(BigInt(params.maxNotionalCents), offset);
  offset += 8;
  data.writeUInt16LE(params.safetyBufferBps, offset);
  offset += 2;
  params.oracleAuthority.toBuffer().copy(data, offset);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: marketConfigPda, isSigner: false, isWritable: true },
      { pubkey: params.admin, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
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

  // Instruction data buffer: discriminator + id + side + notional + rate + count + start.
  const data = Buffer.alloc(8 + 16 + 1 + 8 + 8 + 2 + 8);
  getInstructionDiscriminator('createOffer').copy(data, 0);
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
  const data = getInstructionDiscriminator('acceptOffer');

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
  getInstructionDiscriminator('depositCollateral').copy(data, 0);
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
  const data = getInstructionDiscriminator('activateContract');

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
  getInstructionDiscriminator('recordFundingObservation').copy(data, 0);
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
  const data = getInstructionDiscriminator('finalizeContract');

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
  const data = getInstructionDiscriminator('cancelUnmatchedOffer');

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
