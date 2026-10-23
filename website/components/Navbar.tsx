"use client";

import React, { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PROGRAM_ID } from "@/lib/contract";
import { Shield, ExternalLink, Activity, Coins } from "lucide-react";

export const Navbar = () => {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let isSubscribed = true;

    async function updateBalance() {
      if (!publicKey || !connected) {
        setBalance(null);
        return;
      }
      try {
        const bal = await connection.getBalance(publicKey, "confirmed");
        if (isSubscribed) {
          setBalance(Number(bal) / Number(LAMPORTS_PER_SOL));
        }
      } catch (e) {
        console.error("Failed to fetch balance", e);
      }
    }

    updateBalance();
    const id = setInterval(updateBalance, 10000);

    return () => {
      isSubscribed = false;
      clearInterval(id);
    };
  }, [connected, publicKey, connection]);

  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Shield className="w-5 h-5 text-zinc-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">
                FundingLock
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Testnet
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Perpetual Funding Rate Hedge Protocol
            </p>
          </div>
        </div>

        {/* Right Info + Wallet */}
        <div className="flex items-center gap-3">
          {/* Network indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Solana Testnet</span>
          </div>

          {/* Connected Balance */}
          {mounted && connected && balance !== null && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs font-mono text-zinc-200">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>{balance.toFixed(3)} SOL</span>
            </div>
          )}

          {/* Program Explorer Link */}
          <a
            href={`https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=testnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 transition"
            title="View Contract on Solana Explorer"
          >
            <span>Contract</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          {/* Wallet Multi Button */}
          {mounted && (
            <div className="wallet-btn-container">
              <WalletMultiButton className="!bg-gradient-to-r !from-emerald-500 !to-teal-500 hover:!from-emerald-400 hover:!to-teal-400 !text-zinc-950 !font-semibold !text-sm !h-10 !px-4 !rounded-xl !transition !shadow-md !shadow-emerald-500/15" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
