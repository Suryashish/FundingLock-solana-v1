"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PROGRAM_ID } from "../lib/solana/client.ts";
import {
  Sparkles,
  BarChart3,
  Store,
  RotateCw,
  FileText,
  Copy,
  Check,
  ExternalLink,
  Sun,
  Moon,
  SlidersHorizontal,
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

  // Client mount check
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Fetch balance
  useEffect(() => {
    let active = true;
    if (publicKey && connected) {
      connection.getBalance(publicKey, "confirmed")
        .then((bal) => {
          if (active) setBalance(Number(bal) / Number(LAMPORTS_PER_SOL));
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [connected, publicKey, connection]);

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
    icon: React.ReactNode;
  }[] = [
    {
      id: "simulator",
      label: "Simulator",
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: "marketplace",
      label: "Marketplace",
      icon: <Store className="w-4 h-4" />,
    },
    {
      id: "replay",
      label: "Contract Flow",
      icon: <RotateCw className="w-4 h-4" />,
    },
    {
      id: "historical",
      label: "Historical Rates",
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: "overview",
      label: "Protocol Spec",
      icon: <FileText className="w-4 h-4" />,
    },
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  // Minimal, Modern Sidebar Content
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full justify-between select-none">
      {/* Top: Minimal Brand + Clean Nav Links */}
      <div className="space-y-8">
        {/* Sleek Brand Logo (Directly inspired by "■ blockey") */}
        <div
          className="flex items-center gap-2.5 cursor-pointer px-2 py-1 group"
          onClick={() => handleNavClick("simulator")}
        >
          <div className="h-6 w-6 rounded-md bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-[10px] shadow-xs group-hover:scale-105 transition-transform duration-180">
            ■
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-base tracking-tight text-zinc-950 dark:text-white lowercase">
              fundinglock
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#74f89d]" />
          </div>
        </div>

        {/* Minimalist Live Market Pill (Single sleek line instead of cluttered card!) */}
        <div className="px-2">
          <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08] text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#74f89d] animate-pulse" />
              <span className="font-bold text-zinc-900 dark:text-white">SOL-PERP</span>
              <span className="text-zinc-400">$184.20</span>
            </div>
            <span className="text-emerald-600 dark:text-[#74f89d] font-semibold text-[11px]">
              +0.02%
            </span>
          </div>
        </div>

        {/* Minimal Navigation Links */}
        <nav className="space-y-1 px-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-xs transition-all duration-150 ${
                  isActive
                    ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold shadow-xs"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.04] font-medium"
                }`}
              >
                <span className={isActive ? "text-white dark:text-zinc-950" : "text-zinc-400"}>
                  {item.icon}
                </span>
                <span className="tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Minimal Wallet + Quick Actions */}
      <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.08] space-y-3 px-1">
        {/* Minimal User Row */}
        {mounted && (
          connected && publicKey ? (
            <div className="flex items-center justify-between p-2 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-black/[0.05] dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                  ◎
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                    {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400 leading-tight">
                    {balance !== null ? `${balance.toFixed(2)} SOL` : "0.00 SOL"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={copyAddress}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition"
                  title="Copy address"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => disconnect()}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 transition"
                  title="Disconnect"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setVisible(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold shadow-xs hover:opacity-90 active:scale-98 transition"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Connect</span>
            </button>
          )
        )}

        {/* Minimal Utilities Row */}
        <div className="flex items-center justify-between text-zinc-400 px-1 pt-1">
          <button
            onClick={handleToggleTheme}
            className="p-2 rounded-xl hover:text-zinc-950 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition"
            title="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setProtocolDrawerOpen(true)}
            className="p-2 rounded-xl hover:text-zinc-950 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition"
            title="Protocol specs & PDAs"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <a
            href={`https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=testnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl hover:text-zinc-950 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition"
            title="View contract on Explorer"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Minimal Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 h-screen sticky top-0 p-5 bg-white dark:bg-[#0c0d10] border-r border-black/[0.06] dark:border-white/[0.08] z-30 font-sans transition-colors duration-200">
        {renderSidebarContent()}
      </aside>

      {/* 2. Mobile Minimal Top Header Bar */}
      <header className="lg:hidden sticky top-0 z-40 bg-white/90 dark:bg-[#0c0d10]/90 backdrop-blur-xl border-b border-black/[0.08] dark:border-white/[0.08] px-4 py-3">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => handleNavClick("simulator")}
          >
            <div className="h-6 w-6 rounded-md bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs">
              ■
            </div>
            <div className="flex items-center gap-1">
              <span className="font-extrabold text-sm tracking-tight text-zinc-950 dark:text-white lowercase">
                fundinglock
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#74f89d]" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mounted && connected && publicKey ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                <span className="w-1.5 h-1.5 rounded-full bg-[#74f89d]" />
                <span>{balance !== null ? `${balance.toFixed(2)} SOL` : "..."}</span>
              </div>
            ) : (
              <button
                onClick={() => setVisible(true)}
                className="px-3 py-1 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold shadow-xs"
              >
                Connect
              </button>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
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
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-4/5 max-w-xs h-full bg-white dark:bg-[#0c0d10] p-5 shadow-2xl z-10 flex flex-col justify-between animate-in slide-in-from-left duration-250">
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* 4. Protocol Specs Drawer */}
      {protocolDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 h-full p-6 shadow-2xl border-l border-black/[0.08] dark:border-white/[0.1] overflow-y-auto font-mono text-xs space-y-6 animate-in slide-in-from-right duration-250">
            <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-4">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs">
                  ■
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
                  <span className="text-emerald-600 dark:text-[#74f89d] font-semibold">
                    Solana Testnet
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Rate Units</span>
                  <span className="text-zinc-900 dark:text-white">10⁶ Parts Per Million (PPM)</span>
                </div>
              </div>
            </div>

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
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Vault Solvency Model</span>
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-black/[0.04] dark:border-white/[0.04] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Permitted Bounds</span>
                  <span className="text-zinc-900 dark:text-white">[-0.50%, +0.50%]</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Solvency Buffer</span>
                  <span className="text-emerald-600 dark:text-[#74f89d] font-semibold">+5.00%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Settlement Payout</span>
                  <span className="text-zinc-900 dark:text-white">Single Net Transfer at Maturity</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setProtocolDrawerOpen(false)}
                className="w-full py-2.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold shadow-xs transition"
              >
                Close Specs
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
