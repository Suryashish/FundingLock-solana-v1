"use client";

import React from "react";
import { UserCheck, Lock, Shield } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import { CounterState } from "@/lib/contract";

interface Props {
  connected: boolean;
  publicKey: PublicKey | null;
  contractState: CounterState | null;
}

export const AuthorityCard: React.FC<Props> = ({
  connected,
  publicKey,
  contractState,
}) => {
  const isAuthority =
    connected &&
    publicKey &&
    contractState?.authority &&
    publicKey.toBase58() === contractState.authority;

  return (
    <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800/80 p-6 flex flex-col justify-between">
      <div className="space-y-3">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Authority Permission
        </span>

        {connected ? (
          <div className="space-y-3">
            <div
              className={`p-3 rounded-xl border flex items-center gap-3 ${
                isAuthority
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-zinc-950/50 border-zinc-800 text-zinc-400"
              }`}
            >
              <UserCheck
                className={`w-5 h-5 shrink-0 ${
                  isAuthority ? "text-emerald-400" : "text-zinc-500"
                }`}
              />
              <div className="text-xs">
                <p className="font-semibold text-white">
                  {isAuthority
                    ? "Designated Authority"
                    : "Non-Authority Signer"}
                </p>
                <p className="text-zinc-400 text-[11px]">
                  {isAuthority
                    ? "Authorized to execute increment()."
                    : contractState?.isInitialized
                    ? "Only initializer can increment."
                    : "Initialize to claim authority."}
                </p>
              </div>
            </div>

            <div className="text-[11px] text-zinc-500">
              <span className="font-semibold text-zinc-400">Signer:</span>{" "}
              <span className="font-mono">
                {publicKey?.toBase58().slice(0, 16)}...
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/60 text-center space-y-2">
            <Lock className="w-5 h-5 text-zinc-500 mx-auto" />
            <p className="text-xs text-zinc-400">
              Connect your wallet to execute contract instructions.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-800/80 text-[11px] text-zinc-500 flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5 text-emerald-400" />
        <span>Enforced on-chain via require_keys_eq!</span>
      </div>
    </div>
  );
};

