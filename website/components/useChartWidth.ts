"use client";

import { useEffect, useRef, useState } from "react";

/** Match the SVG coordinate system to its container so mobile labels stay readable. */
export function useChartWidth(initialWidth = 690) {
  const chartRef = useRef<SVGSVGElement>(null);
  const [chartWidth, setChartWidth] = useState(initialWidth);
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      if (width > 0) setChartWidth(width);
    });
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);
  return { chartRef, chartWidth };
}
