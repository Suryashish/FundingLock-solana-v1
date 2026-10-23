"use client";

import React from "react";
import { Shield } from "lucide-react";
import { PROGRAM_ID } from "@/lib/contract";

export const RoadmapNotice: React.FC = () => {
  return (
    <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>FundingLock Protocol Foundation</span>
        </div>
        <p className="text-xs text-zinc-400 max-w-2xl">
          Program foundation active on Solana Testnet. Next milestones per{" "}
          <code className="text-zinc-300 font-mono">plan.md</code>: hedging
          SOL-PERP rates, fixed vs realized settlement, and collateral escrow
          vaults.
        </p>
      </div>

      <div className="text-xs font-mono text-zinc-500 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800 shrink-0">
        Program: {PROGRAM_ID.toBase58().slice(0, 8)}...
        {PROGRAM_ID.toBase58().slice(-4)}
      </div>
    </div>
  );
};

