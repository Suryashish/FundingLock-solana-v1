"use client";

import React from "react";
import { Play, Plus, RefreshCw, CheckCircle2, Layers } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import { CounterState } from "@/lib/contract";

interface Props {
  connected: boolean;
  publicKey: PublicKey | null;
  contractState: CounterState | null;
  actionLoading: string | null;
  onInitialize: () => void;
  onIncrement: () => void;
}

export const ActionCards: React.FC<Props> = ({
  connected,
  publicKey,
  contractState,
  actionLoading,
  onInitialize,
  onIncrement,
}) => {
  const isInit = contractState?.isInitialized ?? false;
  const isAuthority =
    connected &&
    publicKey &&
    contractState?.authority &&
    publicKey.toBase58() === contractState.authority;
  const count = contractState?.count ?? 0;

  return (
    <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-6 md:p-8 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <Layers className="w-5 h-5 text-emerald-400" />
          <span>Execute Contract Instructions</span>
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Build and broadcast signed transactions directly to the deployed Anchor
          program on Solana Testnet.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Instruction 1: Initialize */}
        <div className="rounded-xl bg-zinc-950/60 border border-zinc-800 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400" />
                <span>1. initialize()</span>
              </h3>
              <span className="text-[11px] font-mono text-zinc-500">
                0xafaf6d1f
              </span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Allocates the Counter PDA account with space for the counter struct,
              sets count to 0, deposits 1 lamport rent, and designates caller as
              authority.
            </p>
          </div>

          <button
            onClick={onInitialize}
            disabled={!connected || actionLoading !== null || isInit}
            className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition shadow-md ${
              isInit
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/40"
                : !connected
                ? "bg-zinc-800/60 text-zinc-500 cursor-not-allowed border border-zinc-800"
                : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/10 cursor-pointer"
            }`}
          >
            {actionLoading === "initialize" ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Submitting to Testnet...</span>
              </>
            ) : isInit ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Already Initialized</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Initialize Counter</span>
              </>
            )}
          </button>
        </div>

        {/* Instruction 2: Increment */}
        <div className="rounded-xl bg-zinc-950/60 border border-zinc-800 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-teal-400" />
                <span>2. increment()</span>
              </h3>
              <span className="text-[11px] font-mono text-zinc-500">
                0x0b126809
              </span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Verifies authority equals caller, validates count is under 10,
              increments value by 1, and emits on-chain event log.
            </p>
          </div>

          <button
            onClick={onIncrement}
            disabled={
              !connected ||
              actionLoading !== null ||
              !isInit ||
              (isInit && !isAuthority) ||
              count >= 10
            }
            className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition shadow-md ${
              !isInit
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-800"
                : !isAuthority
                ? "bg-zinc-800/80 text-zinc-500 cursor-not-allowed border border-zinc-800"
                : count >= 10
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-800"
                : "bg-teal-500 hover:bg-teal-400 text-zinc-950 shadow-teal-500/10 cursor-pointer"
            }`}
          >
            {actionLoading === "increment" ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Incrementing...</span>
              </>
            ) : !isInit ? (
              <span>Initialize First</span>
            ) : !isAuthority ? (
              <span>Signer is Not Authority</span>
            ) : count >= 10 ? (
              <span>Max Count Reached (10)</span>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Increment Counter (+1)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

