"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
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
  Menu,
} from "lucide-react";

export type NavTab = "simulator" | "historical" | "marketplace" | "replay" | "overview";

interface SideNavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

const emptySubscribe = () => () => {};

export const SideNavbar: React.FC<SideNavbarProps> = ({
  activeTab,
  onSelectTab,
  isDark = true,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [protocolDrawerOpen, setProtocolDrawerOpen] = useState(false);

  // Countdown timer for next 8h funding epoch (00:00, 08:00, 16:00 UTC)
  const [countdown, setCountdown] = useState<string>("00h 00m 00s");

  // Client mount check
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

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

  const navItems: {
    id: NavTab;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    badge?: string;
  }[] = [
    {
      id: "simulator",
      label: "Hedge Simulator",
      sublabel: "Fixed-rate calculator & terms",
      icon: <Sparkles className="w-4 h-4" />,
      badge: "Calculator",
    },
    {
      id: "marketplace",
      label: "Marketplace",
      sublabel: "Live Testnet offers & orders",
      icon: <Store className="w-4 h-4" />,
      badge: "Peer-to-Peer",
    },
    {
      id: "historical",
      label: "Historical Rates",
      sublabel: "30-day Binance SOL analytics",
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: "replay",
      label: "Contract Flow",
      sublabel: "Interactive 6-step lifecycle",
      icon: <RotateCw className="w-4 h-4" />,
      badge: "Interactive",
    },
    {
      id: "overview",
      label: "Protocol Spec",
      sublabel: "Solvency math & architecture",
      icon: <FileText className="w-4 h-4" />,
    },
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  // Reusable Sidebar Inner Content
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full justify-between">
      {/* Top Section: Brand + Live Market Card + Nav Links */}
      <div className="space-y-6">
        {/* Brand Header */}
        <div
          className="flex items-center gap-3 cursor-pointer select-none group px-1"
          onClick={() => handleNavClick("simulator")}
        >
          <div className="h-10 w-10 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shadow-md shadow-black/10 group-hover:scale-105 transition-transform duration-200">
            <Layers className="w-5 h-5 stroke-[2.4]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-zinc-950 dark:text-white">
                FundingLock
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                v1.0
              </span>
            </div>
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Fixed-Rate Hedge Protocol
            </p>
          </div>
        </div>

        {/* Live Market Pulse Card */}
        <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-black/[0.06] dark:border-white/[0.08] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-mono font-bold text-zinc-900 dark:text-zinc-100">
                Binance SOL-PERP
              </span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
              Testnet
            </span>
          </div>

          <div className="flex items-baseline justify-between font-mono">
            <div>
              <span className="text-[10px] text-zinc-400 uppercase block">Index Price</span>
              <span className="text-sm font-bold text-zinc-950 dark:text-white">$184.20</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-400 uppercase block">Current Rate</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                +0.0200%
              </span>
            </div>
          </div>

          <div className="pt-1 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-zinc-400" />
              <span>Next 8h Epoch:</span>
            </div>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{countdown}</span>
          </div>
        </div>

        {/* Navigation Tabs (Vertical Stack) */}
        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-3 font-bold">
            Navigation
          </span>
          <nav className="space-y-1 pt-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-left transition-all duration-180 group ${
                    isActive
                      ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`p-1.5 rounded-xl transition ${
                        isActive
                          ? "bg-white/10 dark:bg-zinc-950/10 text-white dark:text-zinc-950"
                          : "text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white"
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold leading-tight truncate">
                        {item.label}
                      </div>
                      <div
                        className={`text-[10px] leading-tight truncate ${
                          isActive
                            ? "text-zinc-300 dark:text-zinc-600"
                            : "text-zinc-400 dark:text-zinc-500"
                        }`}
                      >
                        {item.sublabel}
                      </div>
                    </div>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ml-1 ${
                        isActive
                          ? "bg-white/20 dark:bg-zinc-950/15 text-white dark:text-zinc-950"
                          : "bg-black/[0.04] dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Section: Wallet Card + Utilities */}
      <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.08] space-y-3">
        {/* Wallet Account Card */}
        {mounted && (
          connected && publicKey ? (
            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-black/[0.06] dark:border-white/[0.08] space-y-2.5 font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center text-[10px] font-bold">
                    ◎
                  </div>
                  <span className="text-xs font-bold text-zinc-950 dark:text-white">
                    {balance !== null ? `${balance.toFixed(3)} SOL` : "0.000 SOL"}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Testnet
                </span>
              </div>

              {/* Public key + copy */}
              <div className="flex items-center justify-between bg-white dark:bg-zinc-800/80 px-2.5 py-1.5 rounded-xl border border-black/[0.04] dark:border-white/[0.04] text-[11px] text-zinc-600 dark:text-zinc-300">
                <span className="truncate pr-1">
                  {publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-4)}
                </span>
                <button
                  onClick={copyAddress}
                  className="hover:text-zinc-950 dark:hover:text-white transition p-0.5"
                  title="Copy wallet address"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                </button>
              </div>

              {/* Explorer and Disconnect buttons */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <a
                  href={`https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 transition"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Explorer</span>
                </a>
                <button
                  onClick={() => disconnect()}
                  className="flex items-center justify-center gap-1 py-1 px-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-[10px] font-semibold text-red-600 dark:text-red-400 transition"
                  title="Disconnect wallet"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setVisible(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold shadow-md shadow-black/10 hover:opacity-90 active:scale-98 transition"
            >
              <Wallet className="w-4 h-4" />
              <span>Connect Wallet</span>
            </button>
          )
        )}

        {/* Quick Utility Links (Theme, Protocol Architecture Specs, Contract Explorer) */}
        <div className="flex items-center justify-between px-1 text-xs text-zinc-500">
          <button
            onClick={handleToggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition"
            title="Toggle Light / Dark mode"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-medium">{darkMode ? "Light" : "Dark"}</span>
          </button>

          <button
            onClick={() => setProtocolDrawerOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition"
            title="View Protocol Architecture Specs & PDAs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">Specs</span>
          </button>

          <a
            href={`https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=testnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition"
            title="View Contract on Solana Explorer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">Solana</span>
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Side Navbar (Visible on lg+ screens: sticky full-height sidebar) */}
      <aside className="hidden lg:flex flex-col w-72 flex-shrink-0 h-screen sticky top-0 p-5 bg-white dark:bg-[#0c0d10] border-r border-black/[0.08] dark:border-white/[0.08] z-30 font-sans transition-colors duration-200">
        {renderSidebarContent()}
      </aside>

      {/* 2. Mobile / Tablet Top Header Bar (Visible on screens < lg) */}
      <header className="lg:hidden sticky top-0 z-40 bg-white/90 dark:bg-[#0c0d10]/90 backdrop-blur-xl border-b border-black/[0.08] dark:border-white/[0.08] px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Brand */}
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => handleNavClick("simulator")}
          >
            <div className="h-8 w-8 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4 stroke-[2.4]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-zinc-950 dark:text-white">
                  FundingLock
                </span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                  SOL-PERP
                </span>
              </div>
            </div>
          </div>

          {/* Right Header items: Wallet pill + Hamburger Toggle */}
          <div className="flex items-center gap-2">
            {mounted && connected && publicKey ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono font-semibold text-zinc-900 dark:text-zinc-100 border border-black/[0.04] dark:border-white/[0.06]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{balance !== null ? `${balance.toFixed(2)} SOL` : "..."}</span>
              </div>
            ) : (
              <button
                onClick={() => setVisible(true)}
                className="px-3 py-1.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold shadow-xs"
              >
                Connect
              </button>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* 3. Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-4/5 max-w-xs h-full bg-white dark:bg-[#0c0d10] p-5 shadow-2xl z-10 flex flex-col justify-between animate-in slide-in-from-left duration-250">
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* 4. Protocol Specs & PDA Slide-Over Drawer */}
      {protocolDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
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
                    className="text-zinc-900 dark:text-white hover:underline flex items-center gap-1 font-semibold"
                  >
                    {PROGRAM_ID.toBase58().slice(0, 6)}...{PROGRAM_ID.toBase58().slice(-6)}
                    <ExternalLink className="w-3 h-3 text-zinc-400" />
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Network</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Solana Testnet
                  </span>
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
