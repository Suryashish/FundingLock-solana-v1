import { useState } from "react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getCounterPda,
  createInitializeInstruction,
  createIncrementInstruction,
} from "@/lib/contract";

interface WalletContext {
  publicKey: PublicKey | null;
  signTransaction?: <T extends Transaction>(tx: T) => Promise<T>;
  sendTransaction: (
    tx: Transaction,
    connection: Connection,
    options?: any
  ) => Promise<string>;
}

export function useContractActions(
  connection: Connection,
  wallet: WalletContext,
  onSuccess: () => Promise<void>
) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const sendTx = async (tx: Transaction): Promise<string> => {
    if (!wallet.publicKey) throw new Error("Wallet not connected");

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;

    let sig: string;
    if (wallet.signTransaction) {
      const signed = await wallet.signTransaction(tx);
      sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: true,
        preflightCommitment: "confirmed",
      });
    } else {
      sig = await wallet.sendTransaction(tx, connection, {
        skipPreflight: true,
        preflightCommitment: "confirmed",
      });
    }

    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    return sig;
  };

  const handleInitialize = async () => {
    if (!wallet.publicKey) {
      setErrorMessage("Please connect your wallet first.");
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setTxSignature(null);
    setActionLoading("initialize");

    try {
      const [pda] = getCounterPda();
      const ix = createInitializeInstruction(wallet.publicKey, pda);
      const tx = new Transaction().add(ix);

      const sig = await sendTx(tx);
      setTxSignature(sig);
      setSuccessMessage("Counter successfully initialized on Solana Testnet!");
      await onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already in use")) {
        setErrorMessage("Account is already initialized on-chain.");
      } else if (msg.includes("User rejected")) {
        setErrorMessage("Transaction was cancelled in wallet.");
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleIncrement = async () => {
    if (!wallet.publicKey) {
      setErrorMessage("Please connect your wallet first.");
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setTxSignature(null);
    setActionLoading("increment");

    try {
      const [pda] = getCounterPda();
      const ix = createIncrementInstruction(wallet.publicKey, pda);
      const tx = new Transaction().add(ix);

      const sig = await sendTx(tx);
      setTxSignature(sig);
      setSuccessMessage("Counter incremented by 1 successfully!");
      await onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Unauthorized") || msg.includes("0x1770")) {
        setErrorMessage("Unauthorized: Signer is not the counter authority.");
      } else if (msg.includes("CounterOverflow") || msg.includes("0x1771")) {
        setErrorMessage("Counter has reached the maximum count (10).");
      } else if (msg.includes("User rejected")) {
        setErrorMessage("Transaction was cancelled in wallet.");
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setActionLoading(null);
    }
  };

  return {
    actionLoading,
    txSignature,
    errorMessage,
    successMessage,
    handleInitialize,
    handleIncrement,
  };
}

