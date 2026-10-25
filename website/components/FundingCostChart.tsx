"use client";

import { useChartWidth } from "./useChartWidth";
import type { IntervalSettlementRecord } from "../lib/domain/types";
import { formatCurrency } from "../lib/domain/funding";

export function FundingCostChart({
  records,
}: {
  records: IntervalSettlementRecord[];
}) {
  const { chartRef, chartWidth } = useChartWidth();
  const right = chartWidth - 12;
  const plotWidth = right - 58;
  const points = records.reduce<{ actual: number; fixed: number }[]>(
    (values, record) => {
      const previous = values.at(-1) ?? { actual: 0, fixed: 0 };
      values.push({
        actual: previous.actual + record.actualFundingCostCents,
        fixed: previous.fixed + record.fixedFundingCostCents,
      });
      return values;
    },
    [{ actual: 0, fixed: 0 }],
  );
  const values = points.flatMap((point) => [point.actual, point.fixed]);
  const min = Math.min(0, ...values);
  const max = Math.max(100, ...values);
  const y = (value: number) => 195 - ((value - min) / (max - min)) * 165;
  const path = (key: "actual" | "fixed") =>
    points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${58 + (index / Math.max(1, points.length - 1)) * plotWidth},${y(point[key])}`,
      )
      .join(" ");
  const last = points.at(-1)!;
  return (
    <figure>
      <div className="simulator-chart-legend">
        <span>
          <i />
          Without a hedge
        </span>
        <span>
          <i />
          With FundingLock
        </span>
      </div>
      <svg
        className="simulator-chart"
        ref={chartRef}
        viewBox={`0 0 ${chartWidth} 230`}
        role="img"
        aria-label={`Cumulative funding costs: ${formatCurrency(last.actual)} unhedged and ${formatCurrency(last.fixed)} at the fixed rate.`}
      >
        {[0, 0.5, 1].map((ratio) => {
          const value = min + (max - min) * ratio;
          return (
            <g key={ratio}>
              <path className="chart-grid" d={`M58 ${y(value)}H${right}`} />
              <text className="chart-text" x="0" y={y(value) + 4}>
                ${(value / 100).toFixed(0)}
              </text>
            </g>
          );
        })}
        <path
          d={`${path("fixed")} L${right} ${y(0)} L58 ${y(0)} Z`}
          fill="var(--ui-accent-bg)"
        />
        <path className="chart-variable" d={path("actual")} />
        <path className="chart-fixed" d={path("fixed")} />
        <circle cx={right} cy={y(last.fixed)} r="4" fill="var(--ui-accent)" />
      </svg>
      <figcaption className="chart-axis">
        <span>Start of hedge</span>
        <span>
          {records.length} intervals ·{" "}
          {(records.length / 3).toFixed(records.length % 3 ? 1 : 0)} days
        </span>
        <span>Maturity</span>
      </figcaption>
    </figure>
  );
}
