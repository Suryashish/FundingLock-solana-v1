"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PROGRAM_ID } from "../lib/solana/client.ts";
import { ExternalLink, Layers, Copy, Check } from "lucide-react";

export type NavTab = "simulator" | "historical" | "marketplace" | "replay" | "overview";

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

const emptySubscribe = () => () => {};

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab }) => {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Official React 19 pattern for client mount check
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

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
      } catch {
        // Silently handle RPC throttle/offline on testnet
      }
    }

    updateBalance();
    const id = setInterval(updateBalance, 10000);

    return () => {
      isSubscribed = false;
      clearInterval(id);
    };
  }, [connected, publicKey, connection]);

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const navItems: { id: NavTab; label: string }[] = [
    { id: "simulator", label: "Hedge Simulator" },
    { id: "historical", label: "Historical Rates" },
    { id: "marketplace", label: "Marketplace" },
    { id: "replay", label: "Replay Demo" },
    { id: "overview", label: "Protocol Overview" },
  ];

  return (
    <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Brand Logo & Protocol Title */}
        <div className="flex items-center gap-6">
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            onClick={() => onSelectTab("simulator")}
          >
            <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center group-hover:border-zinc-500 transition">
              <Layers className="w-4 h-4 text-zinc-100" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">
                FundingLock
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 font-mono text-zinc-400">
                v1.0
              </span>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? "bg-zinc-900 text-white font-semibold border border-zinc-800"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Section: Status Pills + Wallet */}
        <div className="flex items-center gap-2.5">
          {/* Solana Testnet Pill */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-100 animate-pulse" />
            <span className="text-[11px]">Testnet</span>
          </div>

          {/* Connected Wallet Balance */}
          {mounted && connected && publicKey && balance !== null && (
            <div
              onClick={copyAddress}
              title="Click to copy public key"
              className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 cursor-pointer transition"
            >
              <span className="font-semibold text-zinc-100">{balance.toFixed(2)} SOL</span>
              <span className="text-zinc-500">|</span>
              <span className="text-zinc-400 text-[11px] truncate max-w-[80px]">
                {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
              </span>
              {copied ? (
                <Check className="w-3 h-3 text-zinc-200" />
              ) : (
                <Copy className="w-3 h-3 text-zinc-500" />
              )}
            </div>
          )}

          {/* Explorer Link */}
          <a
            href={`https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=testnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition"
            title="View Solana Escrow Program"
          >
            <span>Contract</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>

          {/* Monochromatic Wallet Button */}
          {mounted && (
            <div>
              <WalletMultiButton />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation Tabs */}
      <div className="md:hidden flex items-center justify-around border-t border-zinc-800/80 bg-zinc-950 px-2 py-1.5 overflow-x-auto text-xs font-mono">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition ${
                isActive
                  ? "bg-zinc-800 text-white font-semibold border border-zinc-700"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
