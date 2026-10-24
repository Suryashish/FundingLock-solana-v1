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
    <div className="dashboard-page space-y-8 pb-16">
      {/* Header with Venue & Interval Metadata */}
      <div className="dashboard-toolbar">
        <div>
          <span className="dashboard-eyebrow">Market intelligence · Binance perpetuals</span>
          <h1>Historical funding rates</h1>
          <p>
            Verified 8-hour funding intervals (00:00, 08:00, 16:00 UTC) • Start-inclusive, End-exclusive
          </p>
        </div>

        {/* Date Filter & Simulate CTA */}
        <div className="dashboard-toolbar-actions">
          <div className="dashboard-segmented">
            {([7, 14, 30] as const).map((days) => (
              <button
                key={days}
                onClick={() => setRangeDays(days)}
                data-active={rangeDays === days}
              >
                {days}D
              </button>
            ))}
          </div>

          <button
            onClick={() => onSimulateHistorical(filteredObservations)}
            className="dashboard-control flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Simulate this Period</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="dashboard-stat-grid">
        <div className="dashboard-stat">
          <span className="dashboard-stat-label">Average rate</span>
            <div className="dashboard-stat-value">
            {formatRatePercent(stats.avgPpm)}
          </div>
          <span className="dashboard-stat-detail">per 8-hour interval</span>
        </div>

        <div className="dashboard-stat">
          <span className="dashboard-stat-label">Max spike</span>
            <div className="dashboard-stat-value">
            {formatRatePercent(stats.maxPpm)}
          </div>
          <span className="dashboard-stat-detail">highest realized rate</span>
        </div>

        <div className="dashboard-stat">
          <span className="dashboard-stat-label">Min rate</span>
            <div className="dashboard-stat-value">
            {formatRatePercent(stats.minPpm)}
          </div>
          <span className="dashboard-stat-detail">deepest discount</span>
        </div>

        <div className="dashboard-stat">
          <span className="dashboard-stat-label">Annualized</span>
            <div className="dashboard-stat-value">
            {stats.annualizedPct > 0 ? `+${stats.annualizedPct.toFixed(1)}%` : `${stats.annualizedPct.toFixed(1)}%`}
          </div>
          <span className="dashboard-stat-detail">annualized equivalent</span>
        </div>

        <div className="dashboard-stat">
          <span className="dashboard-stat-label">Volatility</span>
            <div className="dashboard-stat-value">
            ±{(stats.stdDevPpm / 10_000).toFixed(4)}%
          </div>
          <span className="dashboard-stat-detail">standard deviation</span>
        </div>

        <div className="dashboard-stat">
          <span className="dashboard-stat-label">Observations</span>
            <div className="dashboard-stat-value">
            {stats.count}
          </div>
          <span className="dashboard-stat-detail">verified intervals</span>
        </div>
      </div>

      {/* Monochromatic Interactive SVG Chart */}
      <div className="dashboard-card p-6 rounded-[28px] bg-white border border-black/[0.08] space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase text-zinc-400">
            Historical Realized Funding Rate (% per 8h Epoch)
          </span>
          {hoveredObs ? (
            <div className="text-xs font-mono text-zinc-900 flex items-center gap-3">
              <span>Epoch: {new Date(hoveredObs.startTime * 1000).toLocaleDateString()}</span>
              <span>Rate: <strong className="text-zinc-950">{formatRatePercent(hoveredObs.ratePpm)}</strong></span>
              <span>Cost on $10k: {formatCurrency(Math.round(10_000 * (hoveredObs.ratePpm / 1_000_000) * 100), true)}</span>
            </div>
          ) : (
              <span className="text-xs text-zinc-500 font-mono">Hover a bar for details</span>
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
                  fill={isHovered ? "#080808" : isPositive ? "#7af6a7" : "#a1a1aa"}
                  opacity={isHovered ? 1 : 0.85}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => setHoveredObs(obs)}
                  onMouseLeave={() => setHoveredObs(null)}
                />
              );
            })}
          </svg>

          {/* X Axis Labels */}
          <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 pt-1 border-t border-black/[0.08]">
            <span>{new Date(filteredObservations[0]?.startTime * 1000).toLocaleDateString()} (00:00 UTC)</span>
            <span>Zero Baseline</span>
            <span>{new Date(filteredObservations[filteredObservations.length - 1]?.endTime * 1000).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Dataset Metadata Note */}
      <div className="dashboard-dark-card p-4 rounded-2xl flex items-start gap-3 text-xs text-zinc-400 font-mono">
        <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Normalization rule: Raw decimal rates are multiplied by 1,000,000 into signed parts-per-million integers.
          Interval duration is fixed at 28,800 seconds. No external network request is required to run the simulator.
        </p>
      </div>
    </div>
  );
};
