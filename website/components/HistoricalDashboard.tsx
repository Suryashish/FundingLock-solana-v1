"use client";

import React, { useState, useMemo } from "react";
import { useChartWidth } from "./useChartWidth";
import { HISTORICAL_30D_OBSERVATIONS } from "../lib/data/fixtures.ts";
import { BINANCE_SOL_CONFIG, FundingObservation } from "../lib/domain/types.ts";
import { formatCurrency, formatRatePercent } from "../lib/domain/funding.ts";
import {
  ArrowRight,
  ChartColumnIncreasing,
  ChevronDown,
  Clock3,
  Database,
} from "lucide-react";
import { PageHeader, Panel, SegmentedControl, StatCard } from "./ApplicationUI";

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

  const { chartRef, chartWidth } = useChartWidth(920);
  const plotWidth = chartWidth - 72;
  const chartHeight = 270;
  const maxAbsPpm = Math.max(
    Math.abs(stats.maxPpm),
    Math.abs(stats.minPpm),
    500,
  );
  const chartY = (ppm: number) => 135 - (ppm / maxAbsPpm) * 105;
  const dateLabel = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  const activeHovered =
    hoveredObs &&
    filteredObservations.some(
      (observation) => observation.intervalIndex === hoveredObs.intervalIndex,
    )
      ? hoveredObs
      : null;

  return (
    <div className="app-page simple-page">
      <PageHeader
        title="Funding history"
        description="Choose an example dataset to use in the funding calculator."
        actions={
          <>
            <SegmentedControl
              label="History date range"
              value={String(rangeDays)}
              options={[
                { value: "7", label: "7D" },
                { value: "14", label: "14D" },
                { value: "30", label: "30D" },
              ]}
              onChange={(value) => {
                setRangeDays(Number(value) as 7 | 14 | 30);
                setHoveredObs(null);
              }}
            />
            <button
              className="app-button app-button-primary"
              onClick={() => onSimulateHistorical(filteredObservations)}
            >
              Use in calculator <ArrowRight size={14} />
            </button>
          </>
        }
      />
      <div className="app-stats history-stats">
        <StatCard
          label="Average funding rate"
          value={formatRatePercent(stats.avgPpm)}
          detail="Per 8-hour interval"
          accent
        />
        <StatCard
          label="Highest observed rate"
          value={formatRatePercent(stats.maxPpm)}
          detail={`Across ${stats.count} observations`}
        />
        <StatCard
          label="Lowest observed rate"
          value={formatRatePercent(stats.minPpm)}
          detail={`${rangeDays}-day example dataset`}
        />
      </div>
      <Panel
        title="Funding rate over time"
        description="SOL-PERP · Percentage per 8-hour interval"
        action={
          <span className="app-badge">
            <Database size={11} />
            Example dataset
          </span>
        }
      >
        <div className="history-chart-inspection">
          {activeHovered ? (
            <>
              <span>
                {dateLabel(activeHovered.startTime)} ·{" "}
                {new Date(activeHovered.startTime * 1000).toLocaleTimeString(
                  "en-GB",
                  { hour: "2-digit", minute: "2-digit", timeZone: "UTC" },
                )}{" "}
                UTC
              </span>
              <span className="app-accent">
                {formatRatePercent(activeHovered.ratePpm)}
                <span className="app-muted">
                  ·{" "}
                  {formatCurrency(
                    Math.round(10000 * activeHovered.rateDecimal * 100),
                  )}{" "}
                  on $10k
                </span>
              </span>
            </>
          ) : (
            <>
              <span>
                <ChartColumnIncreasing size={14} />
                Hover, tap, or focus a bar to inspect an interval.
              </span>
              <span>{stats.count} observations</span>
            </>
          )}
        </div>
        <svg
          className="history-chart"
          ref={chartRef}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label={`Funding rates for ${rangeDays} days, average ${formatRatePercent(stats.avgPpm)}`}
        >
          {[-1, -0.5, 0, 0.5, 1].map((ratio) => (
            <g key={ratio}>
              <path
                className="chart-grid"
                d={`M60 ${chartY(maxAbsPpm * ratio)}H${chartWidth - 12}`}
              />
              <text
                className="chart-text"
                x="0"
                y={chartY(maxAbsPpm * ratio) + 4}
              >
                {((maxAbsPpm * ratio) / 10000).toFixed(3)}%
              </text>
            </g>
          ))}
          {filteredObservations.map((observation, index) => {
            const width = plotWidth / filteredObservations.length;
            const height = Math.max(
              2,
              Math.abs(chartY(observation.ratePpm) - 135),
            );
            return (
              <rect
                key={observation.intervalIndex}
                className={`history-chart-bar${observation.ratePpm < 0 ? " history-chart-bar-negative" : ""}`}
                x={60 + index * width + 1}
                y={observation.ratePpm >= 0 ? 135 - height : 135}
                width={Math.max(2, width - 2)}
                height={height}
                rx="1"
                tabIndex={0}
                role="button"
                aria-label={`${dateLabel(observation.startTime)}, interval ${observation.intervalIndex + 1}, ${formatRatePercent(observation.ratePpm)}`}
                onMouseEnter={() => setHoveredObs(observation)}
                onFocus={() => setHoveredObs(observation)}
                onClick={() => setHoveredObs(observation)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setHoveredObs(observation);
                  }
                }}
              >
                <title>
                  {dateLabel(observation.startTime)}:{" "}
                  {formatRatePercent(observation.ratePpm)}
                </title>
              </rect>
            );
          })}
        </svg>
        <div className="chart-axis">
          <span>{dateLabel(filteredObservations[0].startTime)}</span>
          <span>All times UTC</span>
          <span>{dateLabel(filteredObservations.at(-1)!.endTime)}</span>
        </div>
      </Panel>
      <p className="simple-example-note">
        Example data for exploration, not a live feed or a forecast.
      </p>
      <details className="app-disclosure">
        <summary>
          <span>
            <Clock3 size={15} />
            Dataset details
          </span>
          <ChevronDown size={16} />
        </summary>
        <div className="app-panel-body">
          <dl className="app-detail-list">
            <div>
              <dt>Market reference</dt>
              <dd>Binance SOL-PERP</dd>
            </div>
            <div>
              <dt>Selected observations</dt>
              <dd>
                {stats.count} over {rangeDays} days
              </dd>
            </div>
            <div>
              <dt>Interval duration</dt>
              <dd>28,800 seconds</dd>
            </div>
            <div>
              <dt>Rate normalization</dt>
              <dd>Decimal rate × 1,000,000 = PPM</dd>
            </div>
            <div>
              <dt>Annualized average</dt>
              <dd>{stats.annualizedPct.toFixed(1)}%</dd>
            </div>
            <div>
              <dt>Rate volatility</dt>
              <dd>±{(stats.stdDevPpm / 10000).toFixed(4)}%</dd>
            </div>
          </dl>
        </div>
      </details>
    </div>
  );
};
