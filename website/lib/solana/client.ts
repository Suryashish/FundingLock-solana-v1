/**
 * FundingLock Solana Client
 *
 * Provides typed PDA derivation, transaction instruction builders, account deserializers,
 * and high-level contract interaction methods.
 */

import { Buffer } from 'buffer';
import { PublicKey, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import type { ContractStatus } from '../domain/types.ts';

if (typeof window !== 'undefined') {
  (window as unknown as { Buffer?: typeof Buffer }).Buffer =
    (window as unknown as { Buffer?: typeof Buffer }).Buffer || Buffer;
}

export function writeU8(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value;
}

export function writeU16LE(buf: Uint8Array, offset: number, value: number): void {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  view.setUint16(offset, value, true);
}

export function writeU64LE(buf: Uint8Array, offset: number, value: bigint | number): void {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  view.setBigUint64(offset, BigInt(value), true);
}

export function writeI64LE(buf: Uint8Array, offset: number, value: bigint | number): void {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  view.setBigInt64(offset, BigInt(value), true);
}

export function readU16LE(buf: Uint8Array, offset: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return view.getUint16(offset, true);
}

export function readU64LE(buf: Uint8Array, offset: number): bigint {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return view.getBigUint64(offset, true);
}

export function readI64LE(buf: Uint8Array, offset: number): bigint {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return view.getBigInt64(offset, true);
}

export const PROGRAM_ID = new PublicKey('HSMBzbTfQQgLKk9Bv7d9WkLiK1yvKCs9FkeGgBhgfZj9');
export const TESTNET_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.testnet.solana.com';
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
  const encoded = new TextEncoder().encode(str.slice(0, 16));
  buf.set(encoded, 0);
  return buf;
}

export function bytes16ToString(bytes: Uint8Array): string {
  let end = bytes.indexOf(0);
  if (end === -1) end = bytes.length;
  return new TextDecoder().decode(bytes.slice(0, end));
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
  writeU16LE(indexBuf, 0, intervalIndex);
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
  writeU64LE(data, offset, params.intervalSeconds);
  offset += 8;
  writeI64LE(data, offset, params.minRatePpm);
  offset += 8;
  writeI64LE(data, offset, params.maxRatePpm);
  offset += 8;
  writeU64LE(data, offset, params.maxNotionalCents);
  offset += 8;
  writeU16LE(data, offset, params.safetyBufferBps);
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
  writeU8(data, 24, params.positionSide === 'long' ? 0 : 1);
  writeU64LE(data, 25, params.notionalCents);
  writeI64LE(data, 33, params.fixedRatePpm);
  writeU16LE(data, 41, params.intervalCount);
  writeI64LE(data, 43, params.startTime);

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
  writeU64LE(data, 8, params.amountLamports);

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
  writeU16LE(data, 8, params.intervalIndex);
  writeI64LE(data, 10, params.realizedRatePpm);
  writeI64LE(data, 18, params.recordedAt);

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
