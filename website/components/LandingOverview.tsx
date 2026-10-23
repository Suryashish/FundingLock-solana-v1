"use client";

import React from "react";
import { ArrowRight, AlertCircle, ArrowUpRight, CheckCircle2, Lock, Scale, Zap } from "lucide-react";
import { NavTab } from "./Navbar.tsx";

interface LandingOverviewProps {
  onNavigate: (tab: NavTab) => void;
}

export const LandingOverview: React.FC<LandingOverviewProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-12 max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center space-y-4 pt-6 pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
          <span>Solana Testnet Prototype • Binance SOL-PERP (8h Epochs)</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-100 max-w-3xl mx-auto leading-tight">
          Make perpetual funding costs completely predictable.
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Agree on a fixed funding rate for your SOL perpetual position. Counterparties collateralize the opposite side in a program-controlled Solana vault. Settle the net difference once at maturity.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigate("simulator")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs sm:text-sm font-semibold transition shadow-sm"
          >
            <span>Launch Funding Simulator</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate("replay")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-800 text-xs sm:text-sm font-medium transition"
          >
            <span>Run 7-Day Guided Replay</span>
            <ArrowUpRight className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      </div>

      {/* Visual Mechanism Flowchart */}
      <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
            Protocol Architecture & Cash Flow Normalization
          </h2>
          <span className="text-xs text-zinc-500 font-mono">Zero Venue Interference</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-2">
            <div className="flex items-center gap-2 text-zinc-400">
              <Zap className="w-4 h-4 text-zinc-300" />
              <span className="text-xs font-semibold text-zinc-200">1. Exchange Position</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Trader holds a perpetual position on Binance/exchange. The exchange continues charging or paying fluctuating 8h funding fees.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-2">
            <div className="flex items-center gap-2 text-zinc-400">
              <Lock className="w-4 h-4 text-zinc-300" />
              <span className="text-xs font-semibold text-zinc-200">2. FundingLock Agreement</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Trader and counterparty agree on a fixed rate. Both deposit bound-calculated collateral into a Solana escrow vault.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-2">
            <div className="flex items-center gap-2 text-zinc-400">
              <Scale className="w-4 h-4 text-zinc-300" />
              <span className="text-xs font-semibold text-zinc-200">3. Interval Accounting</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Authorized publisher submits verified 8h realized rates. The program updates net settlement accounting with zero token transfers.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-2">
            <div className="flex items-center gap-2 text-zinc-400">
              <CheckCircle2 className="w-4 h-4 text-zinc-300" />
              <span className="text-xs font-semibold text-zinc-200">4. Final Net Settlement</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              At maturity, all intervals net together into one single collateral payment. Remaining vault collateral is returned.
            </p>
          </div>
        </div>
      </div>

      {/* Documented Proof Section */}
      <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-4">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">
              Verified Specification Example (From Plan Baseline)
            </h3>
            <p className="text-xs text-zinc-400">
              Exact mathematical proof for 7-day long hedge under constant realized funding
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 self-start">
            21 Intervals • 8h Epoch
          </span>
        </div>

        {/* 4-Box Math Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-[11px] font-mono text-zinc-500 uppercase">Hedged Notional</span>
            <div className="text-xl font-bold font-mono text-zinc-100">$10,000.00</div>
            <div className="text-[11px] text-zinc-400">Fixed for full duration</div>
          </div>

          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-[11px] font-mono text-zinc-500 uppercase">Fixed Target Rate</span>
            <div className="text-xl font-bold font-mono text-zinc-100">+0.0200%</div>
            <div className="text-[11px] text-zinc-400">$2.00 / interval target</div>
          </div>

          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-[11px] font-mono text-zinc-500 uppercase">Realized Venue Rate</span>
            <div className="text-xl font-bold font-mono text-zinc-100">+0.1000%</div>
            <div className="text-[11px] text-zinc-400">$10.00 / interval paid</div>
          </div>

          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-[11px] font-mono text-zinc-500 uppercase">Net Funding Cost</span>
            <div className="text-xl font-bold font-mono text-zinc-100">$42.00</div>
            <div className="text-[11px] text-zinc-300">Exact target achieved</div>
          </div>
        </div>

        {/* Calculation breakdown */}
        <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/80 font-mono text-xs space-y-2 text-zinc-300">
          <div className="text-zinc-500 uppercase text-[10px] tracking-wider">Arithmetic Verification:</div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-zinc-900 pb-1.5">
            <span className="text-zinc-400">1. Unhedged Perp Cost Paid on Venue:</span>
            <span>21 intervals × ($10,000 × +0.10%) = <strong className="text-zinc-100">$210.00</strong></span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-zinc-900 pb-1.5">
            <span className="text-zinc-400">2. FundingLock Settlement Transfer to Buyer:</span>
            <span>21 intervals × ($10,000 × [+0.10% - +0.02%]) = <strong className="text-zinc-100">+$168.00</strong></span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-0.5">
            <span className="text-zinc-300 font-semibold">3. Resulting Net Cash Expense:</span>
            <span>$210.00 - $168.00 = <strong className="text-zinc-100 text-sm">$42.00</strong> (Target: 21 × $2.00 = $42.00)</span>
          </div>
        </div>
      </div>

      {/* Disclosures & Non-Goals Notice */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-start gap-3 text-xs text-zinc-400">
        <AlertCircle className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <p className="font-semibold text-zinc-200">
            Important Protocol Boundaries & Risk Disclosures
          </p>
          <p>
            FundingLock is an on-chain funding-rate hedge. It does <strong>not</strong> open, close, or liquidate your perpetual position on the underlying exchange.
            It hedges <strong>funding-rate movement only</strong>, and does <strong>not</strong> protect against changes in the spot price of SOL.
            This version is an audited testnet prototype utilizing an authorized publisher key.
          </p>
        </div>
      </div>
    </div>
  );
};