"use client";

import React from "react";
import { CounterState } from "@/lib/contract";

interface Props {
  contractState: CounterState | null;
  loading: boolean;
}

export const StateCard: React.FC<Props> = ({ contractState, loading }) => {
  const isInit = contractState?.isInitialized ?? false;
  const count = contractState?.count ?? 0;

  return (
    <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800/80 p-6 flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Counter State
          </span>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
              isInit
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            }`}
          >
            {loading ? "Fetching..." : isInit ? "Initialized" : "Uninitialized"}
          </span>
        </div>

        <div className="pt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-tight text-white font-mono">
              {isInit ? count : "—"}
            </span>
            <span className="text-zinc-500 font-mono text-lg">/ 10 max</span>
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            On-chain counter data held in the PDA storage account.
          </p>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-zinc-800/80">
        <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-500"
            style={{
              width: `${isInit ? Math.min(100, (count / 10) * 100) : 0}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

