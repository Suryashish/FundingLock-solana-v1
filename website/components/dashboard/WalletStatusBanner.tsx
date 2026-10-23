"use client";

import React from "react";
import { Shield, AlertTriangle } from "lucide-react";
import { PublicKey } from "@solana/web3.js";

interface Props {
  publicKey: PublicKey | null;
  balance: number | null;
}

export const WalletStatusBanner: React.FC<Props> = ({
  publicKey,
  balance,
}) => {
  if (!publicKey) return null;

  const isLowBalance = balance !== null && balance < 0.002;

  return (
    <div className="rounded-xl bg-zinc-900/90 border border-zinc-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3 text-xs">
        <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
        <div className="space-y-0.5">
          <p className="text-zinc-200">
            Connected:{" "}
            <span className="font-mono text-white font-medium">
              {publicKey.toBase58()}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Testnet Balance:</span>
            <span
              className={`font-semibold font-mono ${
                isLowBalance ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {balance !== null ? `${balance.toFixed(4)} SOL` : "Fetching..."}
            </span>
            {isLowBalance && (
              <span className="inline-flex items-center gap-1 text-rose-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Low balance (Ensure you use the funded testnet account)</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 self-start sm:self-auto">
        Solana Testnet
      </div>
    </div>
  );
};

