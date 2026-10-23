"use client";

import React, { useEffect, useState, useSyncExternalStore, useRef } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PROGRAM_ID, TESTNET_ORACLE_PUBKEY } from "../lib/solana/client.ts";
import {
  Layers,
  Sparkles,
  BarChart3,
  Store,
  RotateCw,
  FileText,
  ChevronDown,
  Check,
  Copy,
  ExternalLink,
  Sun,
  Moon,
  SlidersHorizontal,
  Clock,
  Wallet,
  LogOut,
  X,
} from "lucide-react";

export type NavTab = "simulator" | "historical" | "marketplace" | "replay" | "overview";

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

const emptySubscribe = () => () => {};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  isDark = false,
  onToggleTheme,
}) => {
  const [internalDark, setInternalDark] = useState<boolean>(isDark);
  const darkMode = isDark !== undefined ? isDark : internalDark;

  const handleToggleTheme = () => {
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      const next = !internalDark;
      setInternalDark(next);
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [protocolDrawerOpen, setProtocolDrawerOpen] = useState(false);

  // Countdown timer for next 8h funding epoch (00:00, 08:00, 16:00 UTC)
  const [countdown, setCountdown] = useState<string>("00h 00m 00s");

  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Client mount check
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch balance
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
        // Silently handle RPC throttle on testnet
      }
    }

    updateBalance();
    const id = setInterval(updateBalance, 10000);

    return () => {
      isSubscribed = false;
      clearInterval(id);
    };
  }, [connected, publicKey, connection]);

  // Real-time epoch countdown
  useEffect(() => {
    function updateCountdown() {
      const now = new Date();
      const currentUtcHours = now.getUTCHours();
      const currentUtcMinutes = now.getUTCMinutes();
      const currentUtcSeconds = now.getUTCSeconds();

      let nextEpochHour = 8;
      if (currentUtcHours >= 16) {
        nextEpochHour = 24;
      } else if (currentUtcHours >= 8) {
        nextEpochHour = 16;
      }

      const totalCurrentSeconds =
        currentUtcHours * 3600 + currentUtcMinutes * 60 + currentUtcSeconds;
      const targetSeconds = nextEpochHour * 3600;
      const remaining = targetSeconds - totalCurrentSeconds;

      const hrs = Math.floor(remaining / 3600);
      const mins = Math.floor((remaining % 3600) / 60);
      const secs = remaining % 60;

      const pad = (n: number) => n.toString().padStart(2, "0");
      setCountdown(`${pad(hrs)}h ${pad(mins)}m ${pad(secs)}s`);
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: "simulator", label: "Simulator", icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: "marketplace", label: "Marketplace", icon: <Store className="w-3.5 h-3.5" /> },
    { id: "historical", label: "Historical Rates", icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: "replay", label: "Replay Demo", icon: <RotateCw className="w-3.5 h-3.5" /> },
    { id: "overview", label: "Protocol Spec", icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-zinc-950/80 border-b border-black/[0.06] dark:border-white/[0.08] transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Top Header Bar */}
          <div className="h-16 flex items-center justify-between gap-3 sm:gap-4">
            {/* Left: Brand Monogram & Title */}
            <div
              className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none group"
              onClick={() => onSelectTab("simulator")}
            >
              <div className="h-10 w-10 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shadow-md shadow-black/10 group-hover:scale-105 transition-transform duration-200">
                <Layers className="w-5 h-5 stroke-[2.4]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-zinc-950 dark:text-white">
                    FundingLock
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 font-semibold">
                    SOL-PERP
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium hidden sm:block">
                  Decentralized Fixed-Rate Hedge Escrow
                </p>
              </div>
            </div>

            {/* Center: Floating Capsule Navigation Bar (Segmented Control from Image 2) */}
            <nav className="hidden lg:flex items-center gap-1 p-1 rounded-full bg-zinc-100/90 dark:bg-zinc-900/90 border border-black/[0.04] dark:border-white/[0.06] shadow-inner">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                      isActive
                        ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right: Network Status, Account Capsule, Activity Drawer & Theme Toggle */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* SOL-PERP Live Rate Pill (Streamlined into header) */}
              <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100/90 dark:bg-zinc-900/90 border border-black/[0.04] dark:border-white/[0.06] text-xs font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-zinc-950 dark:text-white">SOL-PERP</span>
                <span className="text-zinc-600 dark:text-zinc-300">$184.20</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+0.0200%</span>
                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                <Clock className="w-3 h-3 text-zinc-400" />
                <span className="text-zinc-500 text-[11px]">{countdown}</span>
              </div>

              {/* Monochromatic Account Capsule (Exact Image 2 Style - No Purple Button!) */}
              {mounted && (
                connected && publicKey ? (
                  <div className="relative" ref={accountMenuRef}>
                    <button
                      onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08] hover:border-black/20 dark:hover:border-white/20 text-xs font-mono shadow-sm transition group"
                    >
                      <div className="w-5 h-5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center text-[10px] font-extrabold shadow-sm">
                        S
                      </div>
                      <span className="font-bold text-zinc-950 dark:text-white hidden sm:inline">
                        {balance !== null ? `${balance.toFixed(2)} SOL` : "0.00 SOL"}
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">|</span>
                      <span className="text-zinc-600 dark:text-zinc-300 font-medium">
                        {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-white transition-transform ${
                          accountMenuOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Account Dropdown Drawer */}
                    {accountMenuOpen && (
                      <div className="absolute right-0 mt-2 w-72 rounded-[24px] bg-white dark:bg-zinc-900 border border-black/[0.08] dark:border-white/[0.1] shadow-2xl p-4 z-50 space-y-3 font-mono animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-2 border-b border-black/[0.05] dark:border-white/[0.05]">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                            Connected Wallet
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Solana Testnet
                          </span>
                        </div>

                        {/* Balance display */}
                        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-black/[0.04] dark:border-white/[0.04]">
                          <span className="text-[10px] text-zinc-400 uppercase">Available Balance</span>
                          <div className="text-lg font-bold text-zinc-950 dark:text-white">
                            {balance !== null ? `${balance.toFixed(4)} SOL` : "0.0000 SOL"}
                          </div>
                        </div>

                        {/* Address + 1-Click Copy */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-zinc-400 uppercase">Public Key</span>
                          <button
                            onClick={copyAddress}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                          >
                            <span className="truncate pr-2">
                              {publicKey.toBase58().slice(0, 10)}...{publicKey.toBase58().slice(-8)}
                            </span>
                            {copied ? (
                              <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                <Check className="w-3.5 h-3.5" /> Copied
                              </span>
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-zinc-400" />
                            )}
                          </button>
                        </div>

                        {/* Action buttons */}
                        <div className="pt-2 flex items-center gap-2">
                          <a
                            href={`https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=testnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Explorer</span>
                          </a>
                          <button
                            onClick={() => {
                              disconnect();
                              setAccountMenuOpen(false);
                            }}
                            className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold transition"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Disconnect</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setVisible(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold shadow-md shadow-black/10 hover:opacity-90 active:scale-98 transition"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Connect Wallet</span>
                  </button>
                )
              )}

              {/* Protocol Spec Drawer Button (Matching Image 2's Right Menu Button) */}
              <button
                onClick={() => setProtocolDrawerOpen(true)}
                className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white shadow-sm hover:scale-105 active:scale-95 transition"
                title="View Protocol Specs & PDAs"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>

              {/* Dark / Light Theme Toggle Button */}
              <button
                onClick={handleToggleTheme}
                className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white shadow-sm hover:scale-105 active:scale-95 transition"
                title="Toggle Light / Dark Mode"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation Dock (Visible on tablet & mobile) */}
          <div className="lg:hidden pb-3 pt-1 flex items-center overflow-x-auto no-scrollbar gap-1.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm"
                      : "text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Protocol Specs & PDA Slide-Over Drawer */}
      {protocolDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 h-full p-6 shadow-2xl border-l border-black/[0.08] dark:border-white/[0.1] overflow-y-auto font-mono text-xs space-y-6 animate-in slide-in-from-right duration-250">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-950 dark:text-white font-sans">
                    Protocol Architecture
                  </h3>
                  <span className="text-[10px] text-zinc-400">Solana On-Chain Parameters</span>
                </div>
              </div>
              <button
                onClick={() => setProtocolDrawerOpen(false)}
                className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Smart Contract Program Info */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Smart Contract</span>
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-black/[0.04] dark:border-white/[0.04] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Program ID</span>
                  <a
                    href={`https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-900 dark:text-white hover:underline flex items-center gap-1"
                  >
                    {PROGRAM_ID.toBase58().slice(0, 6)}...{PROGRAM_ID.toBase58().slice(-6)}
                    <ExternalLink className="w-3 h-3 text-zinc-400" />
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Network</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Solana Testnet</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Rate Units</span>
                  <span className="text-zinc-900 dark:text-white">10⁶ Parts Per Million (PPM)</span>
                </div>
              </div>
            </div>

            {/* Venue & Oracle Specification */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Venue & Oracle Feed</span>
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-black/[0.04] dark:border-white/[0.04] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Venue</span>
                  <span className="text-zinc-900 dark:text-white font-semibold">Binance Futures</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Interval Schedule</span>
                  <span className="text-zinc-900 dark:text-white">00:00, 08:00, 16:00 UTC</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Cycle Duration</span>
                  <span className="text-zinc-900 dark:text-white">7 Days (21 Intervals)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Oracle Key</span>
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {TESTNET_ORACLE_PUBKEY.toBase58().slice(0, 6)}...{TESTNET_ORACLE_PUBKEY.toBase58().slice(-4)}
                  </span>
                </div>
              </div>
            </div>

            {/* Solvency Model */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Vault Solvency Model</span>
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-black/[0.04] dark:border-white/[0.04] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Permitted Bounds</span>
                  <span className="text-zinc-900 dark:text-white">[-0.50%, +0.50%]</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Solvency Buffer</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+5.00%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Settlement Payout</span>
                  <span className="text-zinc-900 dark:text-white">Single Net Transfer at Maturity</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Mid-Cycle Leakage</span>
                  <span className="text-zinc-900 dark:text-white font-semibold">0.00% (Accounting Only)</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setProtocolDrawerOpen(false)}
                className="w-full py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold shadow-sm transition"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
