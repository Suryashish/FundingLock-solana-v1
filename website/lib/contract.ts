import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  Connection,
} from "@solana/web3.js";
import { Buffer } from "buffer";

if (typeof window !== "undefined") {
  window.Buffer = window.Buffer || Buffer;
}

export const PROGRAM_ID = new PublicKey(
  "HSMBzbTfQQgLKk9Bv7d9WkLiK1yvKCs9FkeGgBhgfZj9"
);

export const TESTNET_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.testnet.solana.com";

export const COUNTER_SEED = Buffer.from("counter");

export function getCounterPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([COUNTER_SEED], PROGRAM_ID);
}

// Constant PDA for seed b"counter"
export const [COUNTER_PDA, COUNTER_BUMP] = getCounterPda();

// Discriminators from IDL
export const INITIALIZE_DISCRIMINATOR = Buffer.from([
  175, 175, 109, 31, 13, 152, 155, 237,
]);

export const INCREMENT_DISCRIMINATOR = Buffer.from([
  11, 18, 104, 9, 104, 174, 59, 33,
]);

export interface CounterState {
  count: number;
  authority: string;
  lamports: number;
  isInitialized: boolean;
}

export function createInitializeInstruction(
  payer: PublicKey,
  counterPda: PublicKey = COUNTER_PDA
): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: counterPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: INITIALIZE_DISCRIMINATOR,
  });
}

export function createIncrementInstruction(
  authority: PublicKey,
  counterPda: PublicKey = COUNTER_PDA
): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: counterPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: INCREMENT_DISCRIMINATOR,
  });
}

export async function fetchCounterState(
  connection: Connection
): Promise<CounterState | null> {
  const counterPda = COUNTER_PDA;
  const accountInfo = await connection.getAccountInfo(counterPda, "confirmed");

  if (!accountInfo || !accountInfo.data || accountInfo.data.length < 48) {
    return {
      count: 0,
      authority: "",
      lamports: accountInfo ? Number(accountInfo.lamports) : 0,
      isInitialized: false,
    };
  }

  const data = Buffer.from(accountInfo.data);
  // Layout: 8 bytes discriminator, 8 bytes count (u64 LE), 32 bytes authority (PublicKey)
  const count = Number(data.readBigUInt64LE(8));
  const authorityKey = new PublicKey(data.subarray(16, 48));

  return {
    count,
    authority: authorityKey.toBase58(),
    lamports: Number(accountInfo.lamports),
    isInitialized: true,
  };
}
