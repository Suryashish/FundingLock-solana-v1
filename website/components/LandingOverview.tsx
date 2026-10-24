"use client";

import React from "react";
import { ArrowRight, AlertCircle, ArrowUpRight, CheckCircle2, Lock, Scale, Zap } from "lucide-react";
import { NavTab } from "./SideNavbar.tsx";

interface LandingOverviewProps {
  onNavigate: (tab: NavTab) => void;
}

export const LandingOverview: React.FC<LandingOverviewProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16 font-sans">
      {/* Hero Section */}
      <div className="text-center space-y-4 pt-4 pb-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#74f89d]/15 text-emerald-800 dark:text-[#74f89d] border border-[#74f89d]/30 text-xs font-mono font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#74f89d]" />
          <span>Solana Testnet Prototype • Binance SOL-PERP (8h Epochs)</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white max-w-2xl mx-auto leading-tight">
          Make perpetual funding costs completely predictable.
        </h1>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Lock in a fixed funding rate for your SOL perpetual position. Counterparties collateralize the opposite side in a program-derived Solana vault. Settle the net difference once at maturity.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigate("simulator")}
            className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs sm:text-sm font-bold shadow-md hover:opacity-90 active:scale-98 transition"
          >
            <span>Launch Funding Simulator</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate("replay")}
            className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#74f89d] hover:bg-[#5df68b] text-zinc-950 text-xs sm:text-sm font-bold transition shadow-sm"
          >
            <span>Run 7-Day Guided Replay</span>
            <ArrowUpRight className="w-4 h-4 text-zinc-950" />
          </button>
        </div>
      </div>

      {/* Visual Mechanism Flowchart */}
      <div className="p-6 rounded-[28px] bg-white dark:bg-zinc-900/90 border border-black/[0.08] dark:border-white/[0.08] shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.06] pb-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold">
            Protocol Architecture & Cash Flow Normalization
          </h2>
          <span className="text-xs text-zinc-400 font-mono">Zero Venue Interference</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.04] space-y-2">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-xs">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>1. Exchange Position</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Trader holds a perpetual position on Binance. The exchange charges or pays fluctuating 8h funding fees.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.04] space-y-2">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-xs">
              <Lock className="w-4 h-4 text-emerald-500" />
              <span>2. Escrow Agreement</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Trader and counterparty agree on a fixed rate. Both deposit bound-calculated collateral into the Solana vault PDA.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.04] space-y-2">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-xs">
              <Scale className="w-4 h-4 text-blue-500" />
              <span>3. Interval Accounting</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Authorized oracle submits verified 8h realized rates. The program updates internal settlement accounting with zero mid-cycle token transfers.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.04] space-y-2">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>4. Final Net Settlement</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              At maturity, all intervals net together into one single collateral payment. Remaining vault collateral is returned.
            </p>
          </div>
        </div>
      </div>

      {/* Documented Proof Section */}
      <div className="p-6 rounded-[28px] bg-white dark:bg-zinc-900/90 border border-black/[0.08] dark:border-white/[0.08] shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.06] pb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">
              Mathematical Verification (Baseline Example)
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Exact mathematical proof for 7-day long hedge under constant realized funding
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold self-start">
            21 Intervals • 8h Epoch
          </span>
        </div>

        {/* 4-Box Math Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04] space-y-1">
            <span className="text-[10px] text-zinc-400 uppercase font-semibold">Hedged Notional</span>
            <div className="text-xl font-bold text-zinc-950 dark:text-white">$10,000.00</div>
            <div className="text-[10px] text-zinc-500">Fixed for full cycle</div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04] space-y-1">
            <span className="text-[10px] text-zinc-400 uppercase font-semibold">Target Fixed Rate</span>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">+0.0200%</div>
            <div className="text-[10px] text-zinc-500">$2.00 / epoch target</div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04] space-y-1">
            <span className="text-[10px] text-zinc-400 uppercase font-semibold">Realized Venue Rate</span>
            <div className="text-xl font-bold text-zinc-950 dark:text-white">+0.1000%</div>
            <div className="text-[10px] text-zinc-500">$10.00 / epoch paid</div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04] space-y-1">
            <span className="text-[10px] text-zinc-400 uppercase font-semibold">Net Funding Cost</span>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">$42.00</div>
            <div className="text-[10px] text-zinc-500">Exact target achieved</div>
          </div>
        </div>

        {/* Calculation breakdown */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04] font-mono text-xs space-y-2 text-zinc-700 dark:text-zinc-300">
          <div className="text-zinc-400 uppercase text-[10px] font-bold">Arithmetic Breakdown:</div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-black/[0.04] dark:border-white/[0.04] pb-1.5">
            <span className="text-zinc-500">1. Unhedged Perp Cost Paid on Binance:</span>
            <span>21 intervals × ($10,000 × +0.10%) = <strong className="text-zinc-950 dark:text-white">$210.00</strong></span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-black/[0.04] dark:border-white/[0.04] pb-1.5">
            <span className="text-zinc-500">2. FundingLock Settlement Offset to Buyer:</span>
            <span>21 intervals × ($10,000 × [+0.10% - +0.02%]) = <strong className="text-emerald-600 dark:text-emerald-400">+$168.00</strong></span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-0.5">
            <span className="font-semibold text-zinc-950 dark:text-white">3. Resulting Net Cash Expense:</span>
            <span>$210.00 - $168.00 = <strong className="text-zinc-950 dark:text-white text-sm font-bold">$42.00</strong> (Target: 21 × $2.00 = $42.00)</span>
          </div>
        </div>
      </div>

      {/* Disclosures & Non-Goals Notice */}
      <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.04] flex items-start gap-3 text-xs text-zinc-500 font-mono">
        <AlertCircle className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <p className="font-semibold text-zinc-800 dark:text-zinc-200">
            Protocol Boundaries & Risk Disclosures
          </p>
          <p>
            FundingLock is an on-chain funding-rate hedge. It does <strong>not</strong> open, close, or liquidate your perpetual position on the underlying exchange.
            It hedges <strong>funding-rate variance only</strong>, and does <strong>not</strong> protect against changes in the spot price of SOL.
          </p>
        </div>
      </div>
    </div>
  );
};
