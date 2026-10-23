"use client";

import React from "react";
import { Sparkles, RefreshCw, ExternalLink } from "lucide-react";
import { PROGRAM_ID } from "@/lib/contract";

interface Props {
  loading: boolean;
  onRefresh: () => void;
}

export const ContractHero: React.FC<Props> = ({ loading, onRefresh }) => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-zinc-800 p-6 md:p-8">
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Solana Testnet Deployed</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            FundingLock Program Interface
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Interact directly with the on-chain Anchor program. Test account
            initialization, PDA state management, and authorized state mutations.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition border border-zinc-700/60 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`}
            />
            <span>Refresh State</span>
          </button>
          <a
            href={`https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=testnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium transition border border-emerald-500/20"
          >
            <span>Explorer</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};

