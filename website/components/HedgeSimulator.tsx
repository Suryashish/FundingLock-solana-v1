"use client";

import React, { useState, useMemo } from "react";
import {
  BINANCE_SOL_CONFIG,
  ContractTerms,
  FundingObservation,
  PositionSide,
} from "../lib/domain/types.ts";
import {
  buildCashFlowComparison,
  formatCurrency,
  formatRatePercent,
} from "../lib/domain/funding.ts";
import {
  DEMO_SCENARIOS,
  FIXTURE_START_TIME,
  INTERVAL_SECONDS,
} from "../lib/data/fixtures.ts";
import {
  AlertTriangle,
  RotateCcw,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ChevronDown,
  MoreHorizontal,
  CheckCircle2,
} from "lucide-react";

interface HedgeSimulatorProps {
  customObservations?: FundingObservation[] | null;
}

export const HedgeSimulator: React.FC<HedgeSimulatorProps> = ({
  customObservations,
}) => {
  const [positionSide, setPositionSide] = useState<PositionSide>("long");
  const [notionalDollars, setNotionalDollars] = useState<number>(10000);
  const [fixedRatePercent, setFixedRatePercent] = useState<number>(0.02);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("baseline");
  const [showVaultDetails, setShowVaultDetails] = useState<boolean>(false);
  const [paramMenuOpen, setParamMenuOpen] = useState<boolean>(false);
  const [settlementMenuOpen, setSettlementMenuOpen] = useState<boolean>(false);

  // Active observations
  const activeObservations = useMemo(() => {
    if (customObservations && customObservations.length > 0) {
      return customObservations.slice(0, 21);
    }
    const scenario = DEMO_SCENARIOS[selectedScenarioId] || DEMO_SCENARIOS.baseline;
    return scenario.observations;
  }, [customObservations, selectedScenarioId]);

  // Construct active contract terms
  const terms: ContractTerms = useMemo(() => {
    const fixedRatePpm = Math.round(fixedRatePercent * 10000);
    return {
      contractId: "SIM-SOL-001",
      marketSymbol: "SOL-PERP",
      venueId: "BINANCE_PERP",
      positionSide,
      notionalCents: Math.round(notionalDollars * 100),
      fixedRatePpm,
      intervalCount: activeObservations.length || 21,
      intervalSeconds: INTERVAL_SECONDS,
      startTime: FIXTURE_START_TIME,
      endTime: FIXTURE_START_TIME + (activeObservations.length || 21) * INTERVAL_SECONDS,
      minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
      maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
      collateralMint: "USDC",
    };
  }, [positionSide, notionalDollars, fixedRatePercent, activeObservations.length]);

  // Pure domain calculation
  const explanation = useMemo(() => {
    return buildCashFlowComparison(terms, activeObservations, BINANCE_SOL_CONFIG);
  }, [terms, activeObservations]);

  // Reset to documented baseline ($10k notional, 0.02% fixed rate, long, baseline scenario)
  const resetToDocumentedBaseline = () => {
    setPositionSide("long");
    setNotionalDollars(10000);
    setFixedRatePercent(0.02);
    setSelectedScenarioId("baseline");
  };

  return (
    <div className="dashboard-page space-y-8 max-w-5xl mx-auto pb-16 font-sans">
      {/* 1. Hero Portfolio & Net Cost Display (Exact Image 2 Center Hero Style) */}
      <div className="text-center space-y-3 pt-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-black/[0.04] dark:border-white/[0.06] text-xs font-mono text-zinc-600 dark:text-zinc-400 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Binance SOL-PERP • 7-Day Cycle (21 Epochs)</span>
        </div>

        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-sans">
            Target Net Funding Cost
          </span>
          <div className="flex items-baseline justify-center gap-2 text-5xl sm:text-6xl font-extrabold tracking-tight text-white font-sans">
            <span>{formatCurrency(explanation.netFundingCostCents)}</span>
            <span className="text-2xl sm:text-3xl font-light text-zinc-400">
              USD
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 font-mono">
            Locked at <strong className="text-white">+{fixedRatePercent.toFixed(4)}%</strong> per 8h • 0.00% Net Variance • $10k Notional Baseline
          </p>
        </div>

        {/* 2. The Signature Action Pill Capsule (Direct from Image 2!) */}
        <div className="pt-4 flex items-center justify-center">
          <div className="inline-flex items-center p-1.5 rounded-full bg-zinc-950 dark:bg-zinc-900 text-white shadow-2xl shadow-black/20 border border-black/10 dark:border-white/10">
            {/* Long Hedge Button */}
            <button
              type="button"
              onClick={() => setPositionSide("long")}
              className={`flex items-center gap-2 px-6 sm:px-7 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 ${
                positionSide === "long"
                  ? "bg-white text-zinc-950 shadow-md scale-102"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Long Hedge</span>
            </button>

            {/* Central Holographic Metallic Dial (Direct from Image 2!) */}
            <div
              onClick={() => setPositionSide(positionSide === "long" ? "short" : "long")}
              className="mx-1.5 h-10 w-10 rounded-full metallic-dial flex items-center justify-center cursor-pointer hover:scale-108 active:scale-95 transition-transform shadow-lg"
              title="Toggle Long / Short Direction"
            >
              <Sparkles className="w-4 h-4 text-zinc-900 drop-shadow-xs" />
            </div>

            {/* Short Hedge Button */}
            <button
              type="button"
              onClick={() => setPositionSide("short")}
              className={`flex items-center gap-2 px-6 sm:px-7 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 ${
                positionSide === "short"
                  ? "bg-white text-zinc-950 shadow-md scale-102"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span>Short Hedge</span>
              <ArrowDownRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Program Escrow Solvency Vault Pill (Directly modeled on Vault Card in Image 2) */}
      <div className="dashboard-card bg-white dark:bg-zinc-900/90 rounded-[28px] border border-black/[0.05] dark:border-white/[0.08] p-5 luxury-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-center text-zinc-900 dark:text-white shadow-xs">
              <Lock className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
                Solana Solvency Vault
              </span>
              <div className="text-xl font-bold font-mono text-zinc-950 dark:text-white flex items-center gap-2">
                <span>{formatCurrency(explanation.requiredCollateralBuyerCents + explanation.requiredCollateralRiskTakerCents)}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                  100% Solvency Guaranteed
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowVaultDetails(!showVaultDetails)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold font-mono transition self-start sm:self-center"
          >
            <span>{showVaultDetails ? "Hide Allocations" : "View Allocations"}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showVaultDetails ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Collateral Breakdown Drawer */}
        {showVaultDetails && (
          <div className="pt-3 border-t border-black/[0.05] dark:border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono animate-in fade-in duration-200">
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.03] dark:border-white/[0.04] space-y-1">
              <span className="text-zinc-400 uppercase text-[10px]">Buyer Locked Margin</span>
              <div className="text-base font-bold text-zinc-950 dark:text-white">
                {formatCurrency(explanation.requiredCollateralBuyerCents)}
              </div>
              <p className="text-[10px] text-zinc-500">Max downside obligation + 5% buffer</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.03] dark:border-white/[0.04] space-y-1">
              <span className="text-zinc-400 uppercase text-[10px]">Risk-Taker Margin</span>
              <div className="text-base font-bold text-zinc-950 dark:text-white">
                {formatCurrency(explanation.requiredCollateralRiskTakerCents)}
              </div>
              <p className="text-[10px] text-zinc-500">Full buyer payout coverage + 5% buffer</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.03] dark:border-white/[0.04] space-y-1">
              <span className="text-zinc-400 uppercase text-[10px]">Guaranteed Payout Cap</span>
              <div className="text-base font-bold text-zinc-950 dark:text-white">
                {formatCurrency(explanation.payoutCapCents)}
              </div>
              <p className="text-[10px] text-zinc-500">Rate Bounds: [-0.50%, +0.50%]</p>
            </div>
          </div>
        )}
      </div>

      {/* 4. Two Sculpted Core Cards Side-by-Side (Matching Image 2's Solana SOL & Tether USDT cards!) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Solana SOL-PERP Exposure & Parameters (Exact visual match to Image 2's Solana Card) */}
        <div className="dashboard-card bg-white dark:bg-zinc-900/90 rounded-[32px] border border-black/[0.05] dark:border-white/[0.08] p-6 luxury-card flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            {/* Card Header (Icon, Title & Menu) */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-zinc-950 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  ◎
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-950 dark:text-white">
                    SOL-PERP Position
                  </h3>
                  <span className="text-[11px] text-zinc-400 font-mono">Binance Futures</span>
                </div>
              </div>

              <div className="relative">
                <button
                  onClick={() => setParamMenuOpen(!paramMenuOpen)}
                  className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {paramMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-zinc-850 border border-black/[0.08] dark:border-white/[0.1] shadow-xl p-2 z-30 font-mono text-xs animate-in fade-in duration-150">
                    <button
                      onClick={() => {
                        resetToDocumentedBaseline();
                        setParamMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-300"
                    >
                      Reset Baseline ($42 Net)
                    </button>
                    <div className="px-3 py-1.5 text-zinc-400 text-[10px]">
                      Duration: 7 Days (21 Epochs)
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Primary Value Display (Matching Image 2: Bold Number + Subtitle) */}
            <div className="space-y-0.5">
              <div className="text-3xl sm:text-4xl font-extrabold text-zinc-950 dark:text-white font-mono">
                ${notionalDollars.toLocaleString()} <span className="text-xl sm:text-2xl font-normal text-zinc-400">USD</span>
              </div>
              <p className="text-xs text-zinc-500 font-mono">
                Target Fixed Rate: <strong className="text-zinc-900 dark:text-white">{fixedRatePercent > 0 ? `+${fixedRatePercent.toFixed(4)}%` : `${fixedRatePercent.toFixed(4)}%`}</strong> per 8h
              </p>
            </div>

            {/* Interactive Slider & Stepper */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-500">Notional Size</span>
                <span className="font-bold text-zinc-900 dark:text-white">${notionalDollars.toLocaleString()} USD</span>
              </div>
              <input
                type="range"
                min="1000"
                max="100000"
                step="1000"
                value={notionalDollars}
                onChange={(e) => setNotionalDollars(Number(e.target.value))}
                className="w-full accent-zinc-950 dark:accent-white bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full appearance-none cursor-pointer"
              />
              {/* Quick Size Chips */}
              <div className="flex items-center gap-1.5 text-xs font-mono">
                {[5000, 10000, 25000, 50000, 100000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setNotionalDollars(amt)}
                    className={`flex-1 py-1 rounded-full text-[11px] transition font-medium ${
                      notionalDollars === amt
                        ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    ${amt / 1000}k
                  </button>
                ))}
              </div>
            </div>

            {/* Target Rate Input & Chips */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-500">Target Fixed Rate</span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  {fixedRatePercent > 0 ? `+${fixedRatePercent.toFixed(4)}%` : `${fixedRatePercent.toFixed(4)}%`}
                </span>
              </div>
              <input
                type="number"
                step="0.005"
                min="-0.50"
                max="0.50"
                value={fixedRatePercent}
                onChange={(e) => setFixedRatePercent(Number(e.target.value))}
                className="w-full px-4 py-2 rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-black/[0.05] dark:border-white/[0.08] text-xs font-mono font-bold text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
              />
              <div className="flex items-center gap-1.5 text-xs font-mono">
                {[
                  { label: "+0.01%", val: 0.01 },
                  { label: "+0.02%", val: 0.02 },
                  { label: "+0.05%", val: 0.05 },
                  { label: "-0.02%", val: -0.02 },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setFixedRatePercent(chip.val)}
                    className={`flex-1 py-1 rounded-full text-[10px] transition ${
                      Math.abs(fixedRatePercent - chip.val) < 0.0001
                        ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scenario Preset Selector */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                Market Scenario Preset
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {Object.values(DEMO_SCENARIOS).map((sc) => {
                  const isSelected = selectedScenarioId === sc.id && !customObservations;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => {
                        setSelectedScenarioId(sc.id);
                        setFixedRatePercent(sc.defaultFixedRatePpm / 10000);
                      }}
                      className={`text-left p-2.5 rounded-2xl border transition ${
                        isSelected
                          ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-transparent shadow-xs"
                          : "bg-zinc-50 dark:bg-zinc-800/40 border-black/[0.04] dark:border-white/[0.04] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <div className="font-bold text-[11px] truncate">{sc.name}</div>
                      <div className={`text-[10px] truncate ${isSelected ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400"}`}>
                        {sc.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Action Button (Matching Image 2's "Add to Vault" style button) */}
          <div className="pt-2">
            <button
              onClick={resetToDocumentedBaseline}
              className="w-full py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Baseline ($42 Net)</span>
            </button>
          </div>
        </div>

        {/* Card 2: USDC Settlement & Solvency (Exact visual match to Image 2's Tether Card) */}
        <div className="dashboard-card bg-white dark:bg-zinc-900/90 rounded-[32px] border border-black/[0.05] dark:border-white/[0.08] p-6 luxury-card flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            {/* Card Header (Icon, Title & Menu) */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  $
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-950 dark:text-white">
                    USDC Settlement
                  </h3>
                  <span className="text-[11px] text-zinc-400 font-mono">Escrow Vault</span>
                </div>
              </div>

              <div className="relative">
                <button
                  onClick={() => setSettlementMenuOpen(!settlementMenuOpen)}
                  className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {settlementMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-zinc-850 border border-black/[0.08] dark:border-white/[0.1] shadow-xl p-2 z-30 font-mono text-xs animate-in fade-in duration-150">
                    <div className="px-3 py-1.5 text-zinc-700 dark:text-zinc-300 font-semibold">
                      Settlement at Maturity
                    </div>
                    <div className="px-3 py-1 text-zinc-400 text-[10px]">
                      Single Net Payout
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Primary Value Display (Matching Image 2: Bold Number + Subtitle) */}
            <div className="space-y-0.5">
              <div className="text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {formatCurrency(explanation.totalSettlementCents, true)}
              </div>
              <p className="text-xs text-zinc-500 font-mono">
                Maturity Settlement Payout (Offsetting Venue Expense)
              </p>
            </div>

            {/* Comparative Breakdown Visual Blocks */}
            <div className="space-y-2.5 pt-1 font-mono text-xs">
              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase block">Unhedged Venue Cost</span>
                  <span className="font-bold text-zinc-900 dark:text-white">
                    {formatCurrency(explanation.totalActualFundingCostCents)}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-400">Paid on Binance</span>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase block">FundingLock Net Payout</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(explanation.totalSettlementCents, true)}
                  </span>
                </div>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Offset Credit</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-600 uppercase block font-bold">
                    Net Fixed Expense
                  </span>
                  <span className="text-base font-extrabold">
                    {formatCurrency(explanation.netFundingCostCents)}
                  </span>
                </div>
                <span className="text-[11px] font-bold">0.00% Variance</span>
              </div>
            </div>

            {/* Solvency Checklist */}
            <div className="space-y-1.5 pt-1 text-[11px] text-zinc-500 font-sans">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>100% Solvency Ratio sized from rate bounds</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Single net transfer at maturity (Zero mid-cycle leakage)</span>
              </div>
            </div>
          </div>

          {/* Bottom Action Button (Matching Image 2's "Add to Vault" style button) */}
          <div className="pt-2">
            <button
              onClick={() => {}}
              className="w-full py-3 rounded-2xl bg-[#7af6a7] hover:bg-[#99f9ba] text-zinc-950 text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Fixed Rate on Solana</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. 21-Interval Accounting Ledger (Activity / Transaction History in Image 2 Style) */}
      <div className="dashboard-card bg-white dark:bg-zinc-900/90 rounded-[32px] border border-black/[0.05] dark:border-white/[0.08] p-6 luxury-card space-y-4">
        <div className="flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.06] pb-4">
          <div className="flex items-center gap-2.5">
            <h3 className="font-bold text-sm text-zinc-950 dark:text-white font-sans">
              Epoch Settlement Ledger
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 font-semibold">
              {explanation.records.length} Epochs Recorded
            </span>
          </div>
          <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline">
            Single Net Payout at Maturity • 0% Mid-Cycle Leakage
          </span>
        </div>

        {/* Missing Observation Warning */}
        {explanation.missingObservationsCount > 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Missing Oracle Observation Detected</strong>
              <p className="text-[11px] text-amber-700 dark:text-amber-300/80 mt-0.5">
                Interval #14 was not published. Protocol stops finalization until all consecutive epochs are verified.
              </p>
            </div>
          </div>
        )}

        {/* Scrollable Rows */}
        <div className="overflow-x-auto max-h-88 overflow-y-auto space-y-2 pr-1 no-scrollbar">
          {explanation.records.map((rec) => {
            const isMissing = rec.status === "missing";
            return (
              <div
                key={rec.intervalIndex}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  isMissing
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                    : "bg-zinc-50/70 dark:bg-zinc-800/40 border-black/[0.03] dark:border-white/[0.04] hover:border-black/10 dark:hover:border-white/10"
                }`}
              >
                {/* Left: Epoch Number & Time */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-center font-mono text-xs font-bold text-zinc-950 dark:text-white shadow-2xs">
                    #{rec.intervalIndex}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-950 dark:text-white font-mono">
                      {new Date(rec.startTime * 1000).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "UTC",
                      })}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400">
                      {isMissing ? "Observation Missing" : `Realized Rate: ${formatRatePercent(rec.realizedRatePpm)}`}
                    </div>
                  </div>
                </div>

                {/* Right: Interval Settlement & Cumulative */}
                <div className="text-right font-mono">
                  <div className="text-xs font-bold text-zinc-950 dark:text-white">
                    {isMissing ? "HALTED" : formatCurrency(rec.intervalSettlementCents, true)}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Cum: <strong className="text-zinc-700 dark:text-zinc-300">{formatCurrency(rec.cumulativeSettlementCents, true)}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
