import { useState, useEffect } from "react";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

export function useWalletBalance(
  connection: Connection,
  publicKey: PublicKey | null
) {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    if (!publicKey) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        const lamports = await connection.getBalance(publicKey, "confirmed");
        if (active) setBalance(lamports / LAMPORTS_PER_SOL);
      } catch (err) {
        console.error("Balance fetch error:", err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 6000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [connection, publicKey]);

  return balance;
}

