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
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header with Venue & Interval Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Historical SOL-PERP Funding Rates
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
              BINANCE_PERP
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Verified 8-hour funding intervals (00:00, 08:00, 16:00 UTC) • Start-inclusive, End-exclusive
          </p>
        </div>

        {/* Date Filter & Simulate CTA */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-zinc-900 border border-zinc-800 p-0.5 text-xs font-mono">
            {([7, 14, 30] as const).map((days) => (
              <button
                key={days}
                onClick={() => setRangeDays(days)}
                className={`px-3 py-1 rounded-md transition ${
                  rangeDays === days
                    ? "bg-zinc-800 text-zinc-100 font-semibold"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {days}D
              </button>
            ))}
          </div>

          <button
            onClick={() => onSimulateHistorical(filteredObservations)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition shadow-sm"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Simulate this Period</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-zinc-500">Average Rate</span>
          <div className="text-base font-bold font-mono text-zinc-100">
            {formatRatePercent(stats.avgPpm)}
          </div>
          <span className="text-[10px] text-zinc-400">per 8-hour interval</span>
        </div>

        <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-zinc-500">Max Spike</span>
          <div className="text-base font-bold font-mono text-zinc-100">
            {formatRatePercent(stats.maxPpm)}
          </div>
          <span className="text-[10px] text-zinc-400">highest realized rate</span>
        </div>

        <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-zinc-500">Min Rate</span>
          <div className="text-base font-bold font-mono text-zinc-100">
            {formatRatePercent(stats.minPpm)}
          </div>
          <span className="text-[10px] text-zinc-400">deepest discount</span>
        </div>

        <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-zinc-500">Annualized</span>
          <div className="text-base font-bold font-mono text-zinc-100">
            {stats.annualizedPct > 0 ? `+${stats.annualizedPct.toFixed(1)}%` : `${stats.annualizedPct.toFixed(1)}%`}
          </div>
          <span className="text-[10px] text-zinc-400">annualized equivalent</span>
        </div>

        <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-zinc-500">Volatility</span>
          <div className="text-base font-bold font-mono text-zinc-100">
            ±{(stats.stdDevPpm / 10_000).toFixed(4)}%
          </div>
          <span className="text-[10px] text-zinc-400">standard deviation</span>
        </div>

        <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-zinc-500">Observations</span>
          <div className="text-base font-bold font-mono text-zinc-100">
            {stats.count}
          </div>
          <span className="text-[10px] text-zinc-400">verified intervals</span>
        </div>
      </div>

      {/* Monochromatic Interactive SVG Chart */}
      <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase text-zinc-400">
            Historical Realized Funding Rate (% per 8h Epoch)
          </span>
          {hoveredObs ? (
            <div className="text-xs font-mono text-zinc-200 flex items-center gap-3">
              <span>Epoch: {new Date(hoveredObs.startTime * 1000).toLocaleDateString()}</span>
              <span>Rate: <strong className="text-white">{formatRatePercent(hoveredObs.ratePpm)}</strong></span>
              <span>Cost on $10k: {formatCurrency(Math.round(10_000 * (hoveredObs.ratePpm / 1_000_000) * 100), true)}</span>
            </div>
          ) : (
            <span className="text-xs text-zinc-500 font-mono">Hover bar for details</span>
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
              stroke="#3f3f46"
              strokeWidth="1"
              strokeDasharray="3 3"
            />

            {/* Render Bars */}
            {filteredObservations.map((obs, i) => {
              const barWidth = Math.max(3, chartWidth / filteredObservations.length - 2);
              const x = i * (chartWidth / filteredObservations.length) + 1;
              const normalizedHeight = (Math.abs(obs.ratePpm) / maxAbsPpm) * (chartHeight / 2 - 10);
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
                  fill={isHovered ? "#ffffff" : isPositive ? "#d4d4d8" : "#71717a"}
                  opacity={isHovered ? 1 : 0.85}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => setHoveredObs(obs)}
                  onMouseLeave={() => setHoveredObs(null)}
                />
              );
            })}
          </svg>

          {/* X Axis Labels */}
          <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-800">
            <span>{new Date(filteredObservations[0]?.startTime * 1000).toLocaleDateString()} (00:00 UTC)</span>
            <span>Zero Baseline</span>
            <span>{new Date(filteredObservations[filteredObservations.length - 1]?.endTime * 1000).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Dataset Metadata Note */}
      <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 flex items-start gap-3 text-xs text-zinc-400 font-mono">
        <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Normalization rule: Raw decimal rates are multiplied by 1,000,000 into signed parts-per-million integers.
          Interval duration is fixed at 28,800 seconds. No external network request is required to run the simulator.
        </p>
      </div>
    </div>
  );
};
