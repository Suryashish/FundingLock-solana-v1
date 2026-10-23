"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { CounterState } from "@/lib/contract";

interface Props {
  counterPda: string;
  contractState: CounterState | null;
}

export const MetadataCard: React.FC<Props> = ({
  counterPda,
  contractState,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800/80 p-6 flex flex-col justify-between">
      <div className="space-y-3">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Account Metadata
        </span>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Counter PDA</span>
            <button
              onClick={() => copy(counterPda, "pda")}
              className="hover:text-zinc-200 transition text-[11px] flex items-center gap-1"
            >
              {copiedKey === "pda" ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>{copiedKey === "pda" ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <p className="text-xs font-mono text-zinc-200 bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/60 truncate">
            {counterPda || "Loading..."}
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Authority Address</span>
            {contractState?.authority && (
              <button
                onClick={() => copy(contractState.authority, "auth")}
                className="hover:text-zinc-200 transition text-[11px] flex items-center gap-1"
              >
                {copiedKey === "auth" ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedKey === "auth" ? "Copied" : "Copy"}</span>
              </button>
            )}
          </div>
          <p className="text-xs font-mono text-zinc-200 bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/60 truncate">
            {contractState?.authority || "Not initialized yet"}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
        <span className="text-zinc-400">Rent Exemption:</span>
        <span className="font-mono text-zinc-200">
          {contractState?.lamports
            ? `${(contractState.lamports / LAMPORTS_PER_SOL).toFixed(5)} SOL`
            : "0 SOL"}
        </span>
      </div>
    </div>
  );
};

