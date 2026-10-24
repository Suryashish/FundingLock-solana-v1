"use client";

import React, { useState, useMemo } from "react";
import { HISTORICAL_30D_OBSERVATIONS } from "../lib/data/fixtures.ts";
import { BINANCE_SOL_CONFIG, FundingObservation } from "../lib/domain/types.ts";
import { formatCurrency, formatRatePercent } from "../lib/domain/funding.ts";
import { Play, Info } from "lucide-react";

interface HistoricalDashboardProps {
  onSimulateHistorical: (observations: FundingObservation[]) => void;
}

export const HistoricalDashboard: React.FC<HistoricalDashboardProps> = ({
  onSimulateHistorical,
}) => {
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(30);
  const [hoveredObs, setHoveredObs] = useState<FundingObservation | null>(null);

  // Filter observations based on selected range
  const filteredObservations = useMemo(() => {
    const count = rangeDays * BINANCE_SOL_CONFIG.intervalsPerDay;
    return HISTORICAL_30D_OBSERVATIONS.slice(-count);
  }, [rangeDays]);

  // Compute summary statistics
  const stats = useMemo(() => {
    const rates = filteredObservations.map((o) => o.ratePpm);
    const sum = rates.reduce((a, b) => a + b, 0);
    const avg = sum / rates.length;
    const max = Math.max(...rates);
    const min = Math.min(...rates);

    // Standard deviation
    const variance =
      rates.reduce((acc, r) => acc + Math.pow(r - avg, 2), 0) / rates.length;
    const stdDev = Math.sqrt(variance);

    // Annualized: 3 intervals per day * 365 = 1095 intervals/yr
    const annualizedPct = (avg * 1095) / 10_000;

    return {
      count: rates.length,
      avgPpm: Math.round(avg),
      maxPpm: max,
      minPpm: min,
      stdDevPpm: Math.round(stdDev),
      annualizedPct,
    };
  }, [filteredObservations]);

  // Chart dimensions
  const chartHeight = 200;
  const chartWidth = 800;
  const maxAbsPpm = Math.max(Math.abs(stats.maxPpm), Math.abs(stats.minPpm), 1000);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 font-sans">
      {/* Header with Venue & Interval Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.08] dark:border-white/[0.08]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-semibold mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Binance Futures Historical Dataset</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
            SOL-PERP Historical Funding Rates
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Analyze historical 8-hour funding rates to evaluate basis drift and size your hedge parameters.
          </p>
        </div>

        {/* Date Filter & Simulate CTA */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="p-1 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-1 font-mono text-xs">
            {([7, 14, 30] as const).map((days) => (
              <button
                key={days}
                onClick={() => setRangeDays(days)}
                className={`px-3 py-1.5 rounded-full transition ${
                  rangeDays === days
                    ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                }`}
              >
                {days}D
              </button>
            ))}
          </div>

          <button
            onClick={() => onSimulateHistorical(filteredObservations)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#74f89d] hover:bg-[#5df68b] text-zinc-950 text-xs font-bold font-mono shadow-md active:scale-98 transition"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Load into Calculator</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-black/[0.08] dark:border-white/[0.08] space-y-1">
          <span className="text-[10px] text-zinc-400 uppercase font-semibold">Average Rate</span>
          <div className="text-lg font-bold text-zinc-950 dark:text-white">
            {formatRatePercent(stats.avgPpm)}
          </div>
          <span className="text-[10px] text-zinc-500">per 8h interval</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-black/[0.08] dark:border-white/[0.08] space-y-1">
          <span className="text-[10px] text-zinc-400 uppercase font-semibold">Max Positive Spike</span>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {formatRatePercent(stats.maxPpm)}
          </div>
          <span className="text-[10px] text-zinc-500">highest realized</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-black/[0.08] dark:border-white/[0.08] space-y-1">
          <span className="text-[10px] text-zinc-400 uppercase font-semibold">Deepest Discount</span>
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {formatRatePercent(stats.minPpm)}
          </div>
          <span className="text-[10px] text-zinc-500">lowest rate</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-black/[0.08] dark:border-white/[0.08] space-y-1">
          <span className="text-[10px] text-zinc-400 uppercase font-semibold">Annualized</span>
          <div className="text-lg font-bold text-zinc-950 dark:text-white">
            {stats.annualizedPct > 0 ? `+${stats.annualizedPct.toFixed(1)}%` : `${stats.annualizedPct.toFixed(1)}%`}
          </div>
          <span className="text-[10px] text-zinc-500">annualized basis</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-black/[0.08] dark:border-white/[0.08] space-y-1">
          <span className="text-[10px] text-zinc-400 uppercase font-semibold">Volatility</span>
          <div className="text-lg font-bold text-zinc-950 dark:text-white">
            ±{(stats.stdDevPpm / 10_000).toFixed(4)}%
          </div>
          <span className="text-[10px] text-zinc-500">standard dev</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-black/[0.08] dark:border-white/[0.08] space-y-1">
          <span className="text-[10px] text-zinc-400 uppercase font-semibold">Sample Size</span>
          <div className="text-lg font-bold text-zinc-950 dark:text-white">
            {stats.count}
          </div>
          <span className="text-[10px] text-zinc-500">8h intervals</span>
        </div>
      </div>

      {/* Interactive SVG Chart Card */}
      <div className="p-6 rounded-[28px] bg-white dark:bg-zinc-900/90 border border-black/[0.08] dark:border-white/[0.08] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.06] pb-3">
          <span className="text-xs font-mono uppercase text-zinc-400 font-bold">
            Realized Funding Rate Profile (% per 8h Epoch)
          </span>
          {hoveredObs ? (
            <div className="text-xs font-mono text-zinc-800 dark:text-zinc-200 flex flex-wrap items-center gap-3">
              <span>Epoch: <strong>{new Date(hoveredObs.startTime * 1000).toLocaleDateString()}</strong></span>
              <span>Rate: <strong className="text-emerald-600 dark:text-emerald-400">{formatRatePercent(hoveredObs.ratePpm)}</strong></span>
              <span>Cost on $10k: <strong>{formatCurrency(Math.round(10_000 * (hoveredObs.ratePpm / 1_000_000) * 100), true)}</strong></span>
            </div>
          ) : (
            <span className="text-xs text-zinc-400 font-mono">Hover over any bar to inspect interval cost</span>
          )}
        </div>

        {/* SVG Container */}
        <div className="relative w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-48 select-none"
            preserveAspectRatio="none"
          >
            {/* Zero Baseline */}
            <line
              x1="0"
              y1={chartHeight / 2}
              x2={chartWidth}
              y2={chartHeight / 2}
              stroke="#52525b"
              strokeWidth="1"
              strokeDasharray="4 4"
            />

            {/* Render Bars */}
            {filteredObservations.map((obs, i) => {
              const barWidth = Math.max(3, chartWidth / filteredObservations.length - 2);
              const x = i * (chartWidth / filteredObservations.length) + 1;
              const normalizedHeight = (Math.abs(obs.ratePpm) / maxAbsPpm) * (chartHeight / 2 - 12);
              const isPositive = obs.ratePpm >= 0;
              const y = isPositive ? chartHeight / 2 - normalizedHeight : chartHeight / 2;

              const isHovered = hoveredObs?.intervalIndex === obs.intervalIndex;

              return (
                <rect
                  key={obs.intervalIndex}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(2, normalizedHeight)}
                  rx="1"
                  fill={isHovered ? "#10b981" : isPositive ? "#34d399" : "#94a3b8"}
                  opacity={isHovered ? 1 : 0.8}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => setHoveredObs(obs)}
                  onMouseLeave={() => setHoveredObs(null)}
                />
              );
            })}
          </svg>

          {/* X Axis Labels */}
          <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <span>{new Date(filteredObservations[0]?.startTime * 1000).toLocaleDateString()} (00:00 UTC)</span>
            <span>Zero Baseline</span>
            <span>{new Date(filteredObservations[filteredObservations.length - 1]?.endTime * 1000).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Dataset Metadata Note */}
      <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.04] flex items-start gap-3 text-xs text-zinc-500 font-mono">
        <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Normalization rule: Raw decimal rates are multiplied by 1,000,000 into signed integer PPMs.
          Epoch intervals are 28,800 seconds (8 hours), matching the standard Binance settlement cycle.
        </p>
      </div>
    </div>
  );
};
