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
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
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

  // Handle passed custom observations (e.g. from historical tab)
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

  // Calculate full cash flow comparison using pure domain engine
  const explanation = useMemo(() => {
    return buildCashFlowComparison(terms, activeObservations, BINANCE_SOL_CONFIG);
  }, [terms, activeObservations]);

  // Quick reset to documented baseline
  const resetToDocumentedBaseline = () => {
    setPositionSide("long");
    setNotionalDollars(10000);
    setFixedRatePercent(0.02);
    setSelectedScenarioId("baseline");
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header and Quick Reset */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Funding Rate Hedge Simulator
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
              SOL-PERP • 8h Epoch
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Simulate direction-aware fixed-rate hedge performance before executing or collateralizing on-chain
          </p>
        </div>

        <button
          onClick={resetToDocumentedBaseline}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white transition"
        >
          <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
          <span>Reset Baseline ($42 Net)</span>
        </button>
      </div>

      {/* Inputs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Order & Hedge Parameters */}
        <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-5 lg:col-span-1">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              Hedge Parameters
            </span>
            <span className="text-[10px] font-mono text-zinc-500">Fixed Notional</span>
          </div>

          {/* Position Side Toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">
              Perpetual Position Side
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950 rounded-lg border border-zinc-800 text-xs font-mono">
              <button
                type="button"
                onClick={() => setPositionSide("long")}
                className={`py-2 rounded-md font-semibold transition ${
                  positionSide === "long"
                    ? "bg-zinc-800 text-white shadow-sm border border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                LONG (s = +1)
              </button>
              <button
                type="button"
                onClick={() => setPositionSide("short")}
                className={`py-2 rounded-md font-semibold transition ${
                  positionSide === "short"
                    ? "bg-zinc-800 text-white shadow-sm border border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                SHORT (s = -1)
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">
              {positionSide === "long"
                ? "Hedging funding payments for a long perpetual position."
                : "Hedging funding payments/receipts for a short perpetual position."}
            </p>
          </div>

          {/* Notional Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="font-medium text-zinc-300">Position Notional</label>
              <span className="text-white font-bold">${notionalDollars.toLocaleString()} USD</span>
            </div>
            <input
              type="range"
              min="1000"
              max="100000"
              step="1000"
              value={notionalDollars}
              onChange={(e) => setNotionalDollars(Number(e.target.value))}
              className="w-full accent-white bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex items-center gap-1.5 text-xs font-mono">
              {[5000, 10000, 25000, 50000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setNotionalDollars(amt)}
                  className={`px-2 py-0.5 rounded text-[11px] border transition ${
                    notionalDollars === amt
                      ? "bg-zinc-800 text-white border-zinc-600 font-semibold"
                      : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  ${amt / 1000}k
                </button>
              ))}
            </div>
          </div>

          {/* Fixed Funding Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="font-medium text-zinc-300">Target Fixed Rate</label>
              <span className="text-white font-bold">
                {fixedRatePercent > 0 ? `+${fixedRatePercent.toFixed(4)}%` : `${fixedRatePercent.toFixed(4)}%`} / 8h
              </span>
            </div>
            <input
              type="number"
              step="0.005"
              min="-0.50"
              max="0.50"
              value={fixedRatePercent}
              onChange={(e) => setFixedRatePercent(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-white focus:outline-none focus:border-zinc-600"
            />
            {/* Quick rate chips */}
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
                  className={`px-2 py-0.5 rounded text-[10px] border transition ${
                    Math.abs(fixedRatePercent - chip.val) < 0.0001
                      ? "bg-zinc-800 text-white border-zinc-600 font-semibold"
                      : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-1 border-t border-zinc-850">
              <span>Per interval: {formatCurrency(Math.round(notionalDollars * (fixedRatePercent / 100) * 100), true)}</span>
              <span>7D Target: {formatCurrency(Math.round(notionalDollars * (fixedRatePercent / 100) * 21 * 100), true)}</span>
            </div>
          </div>

          {/* Market Scenario Presets */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <label className="text-xs font-medium text-zinc-300">
              Funding Scenario Preset
            </label>
            <div className="space-y-1.5">
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
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition ${
                      isSelected
                        ? "bg-zinc-800 border-zinc-600 text-white font-medium"
                        : "bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    <div className="font-semibold text-zinc-200">{sc.name}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">
                      {sc.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Outputs & Ledger */}
        <div className="lg:col-span-2 space-y-5">
          {/* Edge Case Warning Banner (if missing) */}
          {explanation.missingObservationsCount > 0 && (
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700 flex items-start gap-3 text-xs text-zinc-300">
              <AlertTriangle className="w-4 h-4 text-zinc-200 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Oracle Integrity Alert: Observation #14 Missing</strong>
                <p className="text-zinc-400 mt-1">
                  The protocol enforces strict sequential observation continuity. Finalization and token transfers remain safely paused until interval data is recovered or dispute authority unblocks the contract.
                </p>
              </div>
            </div>
          )}

          {/* 4 Summary Result KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-1">
              <span className="text-[10px] font-mono uppercase text-zinc-500">Unhedged Venue Cost</span>
              <div className="text-lg font-bold font-mono text-zinc-200">
                {formatCurrency(explanation.totalActualFundingCostCents)}
              </div>
              <span className="text-[10px] text-zinc-500">paid/rec&apos;d on venue</span>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-1">
              <span className="text-[10px] font-mono uppercase text-zinc-500">Target Fixed Cost</span>
              <div className="text-lg font-bold font-mono text-zinc-200">
                {formatCurrency(explanation.totalFixedFundingCostCents)}
              </div>
              <span className="text-[10px] text-zinc-500">agreed fixed expense</span>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-1">
              <span className="text-[10px] font-mono uppercase text-zinc-500">FundingLock Payout</span>
              <div className="text-lg font-bold font-mono text-white">
                {formatCurrency(explanation.totalSettlementCents, true)}
              </div>
              <span className="text-[10px] text-zinc-500">net transfer at maturity</span>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-700 space-y-1">
              <span className="text-[10px] font-mono uppercase text-zinc-300 font-semibold">Net Cost After Hedge</span>
              <div className="text-lg font-bold font-mono text-white">
                {formatCurrency(explanation.netFundingCostCents)}
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">0.00% variance</span>
            </div>
          </div>

          {/* Collateral Requirements & Solvency Card */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-zinc-200" />
                <span className="text-xs font-semibold text-zinc-200">
                  Vault Collateral & Solvency Allocation
                </span>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">
                [-0.50%, +0.50%] Rate Bounds + 5% Buffer
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-850">
                <span className="text-zinc-500 block text-[10px]">BUYER COLLATERAL</span>
                <strong className="text-zinc-100 text-sm">{formatCurrency(explanation.requiredCollateralBuyerCents)}</strong>
                <span className="text-zinc-500 block text-[10px] mt-0.5">Maximum downside deposit</span>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-850">
                <span className="text-zinc-500 block text-[10px]">RISK TAKER COLLATERAL</span>
                <strong className="text-zinc-100 text-sm">{formatCurrency(explanation.requiredCollateralRiskTakerCents)}</strong>
                <span className="text-zinc-500 block text-[10px] mt-0.5">Full payout coverage</span>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-850">
                <span className="text-zinc-500 block text-[10px]">MAX PAYOUT CAP</span>
                <strong className="text-zinc-100 text-sm">{formatCurrency(explanation.payoutCapCents)}</strong>
                <span className="text-zinc-500 block text-[10px] mt-0.5">100% Solvency Guaranteed</span>
              </div>
            </div>
          </div>

          {/* Per-Interval Settlement Ledger Table */}
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <span className="text-xs font-mono uppercase text-zinc-400 font-semibold">
                Per-Interval Settlement Accounting Ledger
              </span>
              <span className="text-xs font-mono text-zinc-500">
                {explanation.records.length} Intervals Recorded
              </span>
            </div>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="text-[10px] uppercase text-zinc-500 border-b border-zinc-800 sticky top-0 bg-zinc-950">
                  <tr>
                    <th className="py-2 px-2.5">#</th>
                    <th className="py-2 px-2.5">Epoch Start (UTC)</th>
                    <th className="py-2 px-2.5">Realized Rate</th>
                    <th className="py-2 px-2.5">Unhedged Cost</th>
                    <th className="py-2 px-2.5">Settlement</th>
                    <th className="py-2 px-2.5">Cumulative</th>
                    <th className="py-2 px-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {explanation.records.map((rec) => {
                    const isMissing = rec.status === "missing";
                    return (
                      <tr
                        key={rec.intervalIndex}
                        className={`hover:bg-zinc-800/40 transition ${
                          isMissing ? "bg-zinc-900 text-zinc-400" : ""
                        }`}
                      >
                        <td className="py-1.5 px-2.5 text-zinc-500">{rec.intervalIndex}</td>
                        <td className="py-1.5 px-2.5 text-zinc-400">
                          {new Date(rec.startTime * 1000).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "UTC",
                          })}
                        </td>
                        <td className="py-1.5 px-2.5 font-semibold text-zinc-200">
                          {isMissing ? "MISSING" : formatRatePercent(rec.realizedRatePpm)}
                        </td>
                        <td className="py-1.5 px-2.5 text-zinc-300">
                          {isMissing ? "-" : formatCurrency(rec.actualFundingCostCents)}
                        </td>
                        <td className="py-1.5 px-2.5 text-zinc-200">
                          {isMissing ? "-" : formatCurrency(rec.intervalSettlementCents, true)}
                        </td>
                        <td className="py-1.5 px-2.5 font-bold text-white">
                          {formatCurrency(rec.cumulativeSettlementCents, true)}
                        </td>
                        <td className="py-1.5 px-2.5">
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                              isMissing
                                ? "bg-zinc-800 text-zinc-300 border border-zinc-700"
                                : "bg-zinc-900 text-zinc-400"
                            }`}
                          >
                            {rec.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
