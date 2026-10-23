"use client";

import React, { useState, useEffect } from "react";
import { Clock, ShieldCheck, ChevronDown } from "lucide-react";

export const MarketTickerBar: React.FC = () => {
  // Real-time countdown to next 8h funding timestamp (00:00, 08:00, 16:00 UTC)
  const [countdown, setCountdown] = useState<string>("00h 00m 00s");

  useEffect(() => {
    function updateCountdown() {
      const now = new Date();
      const currentUtcHours = now.getUTCHours();
      const currentUtcMinutes = now.getUTCMinutes();
      const currentUtcSeconds = now.getUTCSeconds();

      // Next epoch hour: 0, 8, 16, or 24 (which is 0 next day)
      let nextEpochHour = 8;
      if (currentUtcHours >= 16) {
        nextEpochHour = 24;
      } else if (currentUtcHours >= 8) {
        nextEpochHour = 16;
      }

      const totalCurrentSeconds =
        currentUtcHours * 3600 + currentUtcMinutes * 60 + currentUtcSeconds;
      const targetSeconds = nextEpochHour * 3600;
      const remaining = targetSeconds - totalCurrentSeconds;

      const hrs = Math.floor(remaining / 3600);
      const mins = Math.floor((remaining % 3600) / 60);
      const secs = remaining % 60;

      const pad = (n: number) => n.toString().padStart(2, "0");
      setCountdown(`${pad(hrs)}h ${pad(mins)}m ${pad(secs)}s`);
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border-b border-zinc-800/80 bg-zinc-950/80 px-4 sm:px-6 lg:px-8 py-2 text-xs font-mono">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 overflow-x-auto no-scrollbar whitespace-nowrap">
        {/* Left Market Selector & Mark Price */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 font-bold text-zinc-100 hover:border-zinc-700 cursor-pointer transition">
            <span className="w-2 h-2 rounded-full bg-zinc-300" />
            <span>SOL-PERP</span>
            <ChevronDown className="w-3 h-3 text-zinc-500" />
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-zinc-500 text-[11px]">MARK</span>
            <span className="text-zinc-200 font-semibold">$184.20</span>
          </div>

          <div className="hidden sm:flex items-baseline gap-1.5">
            <span className="text-zinc-500 text-[11px]">INDEX</span>
            <span className="text-zinc-400">$184.15</span>
          </div>
        </div>

        {/* Center Funding Ticker Details */}
        <div className="flex items-center gap-5 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">8H FUNDING:</span>
            <span className="text-zinc-200 font-semibold">+0.0200%</span>
            <span className="text-zinc-500 text-[10px]">(+21.9% APR)</span>
          </div>

          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-zinc-500">PREDICTED:</span>
            <span className="text-zinc-300">+0.0185%</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-zinc-400" />
            <span className="text-zinc-500">NEXT EPOCH:</span>
            <span className="text-zinc-200 font-semibold">{countdown}</span>
          </div>
        </div>

        {/* Right Protocol Stats */}
        <div className="hidden lg:flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">VENUE:</span>
            <span className="text-zinc-300">Binance Futures</span>
          </div>

          <div className="flex items-center gap-1 text-zinc-400">
            <ShieldCheck className="w-3 h-3 text-zinc-300" />
            <span>100% Fully Collateralized</span>
          </div>
        </div>
      </div>
    </div>
  );
};
