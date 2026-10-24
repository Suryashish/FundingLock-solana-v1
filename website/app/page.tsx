"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { SideNavbar, NavTab } from "../components/SideNavbar.tsx";
import { LandingOverview } from "../components/LandingOverview.tsx";
import { HistoricalDashboard } from "../components/HistoricalDashboard.tsx";
import { HedgeSimulator } from "../components/HedgeSimulator.tsx";
import { MarketplaceBoard } from "../components/MarketplaceBoard.tsx";
import { ReplayDemo } from "../components/ReplayDemo.tsx";
import { FundingObservation } from "../lib/domain/types.ts";
import { PROGRAM_ID } from "../lib/solana/client.ts";

const WalletContextProvider = dynamic(
  () =>
    import("../components/WalletContextProvider.tsx").then(
      (mod) => mod.WalletContextProvider
    ),
  { ssr: false }
);

export default function Home() {
  const [activeTab, setActiveTab] = useState<NavTab>("simulator");
  const [customObservations, setCustomObservations] = useState<FundingObservation[] | null>(null);
  const [isDark, setIsDark] = useState<boolean>(true);
  const isDashboard = activeTab !== "overview";

  // Sync theme with document element
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const handleSimulateHistorical = (observations: FundingObservation[]) => {
    setCustomObservations(observations);
    setActiveTab("simulator");
  };

  const handleAcceptOfferFromBoard = () => {
    setActiveTab("replay");
  };

  return (
    <WalletContextProvider>
      <div
        className={`min-h-screen flex flex-col lg:flex-row font-sans transition-colors duration-200 ${
          isDashboard ? "dashboard-shell" : "bg-[var(--bg-app)]"
        }`}
      >
        {/* Left Side Navigation (Desktop Sticky Sidebar + Mobile Drawer) */}
        <SideNavbar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            if (tab !== "simulator") {
              setCustomObservations(null);
            }
            setActiveTab(tab);
          }}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
        />

        {/* Right Main Viewport */}
        <div className="flex-1 flex flex-col min-w-0">
          <main
            className={`flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 ${
              isDashboard ? "dashboard-main" : ""
            }`}
          >
            {activeTab === "simulator" && (
              <HedgeSimulator
                customObservations={customObservations}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === "historical" && (
              <HistoricalDashboard onSimulateHistorical={handleSimulateHistorical} />
            )}

            {activeTab === "marketplace" && (
              <MarketplaceBoard onAcceptOfferClick={handleAcceptOfferFromBoard} />
            )}

            {activeTab === "replay" && (
              <ReplayDemo />
            )}

            {activeTab === "overview" && (
              <LandingOverview onNavigate={(tab) => setActiveTab(tab)} />
            )}
          </main>

          {/* Institutional Minimalist Monochromatic Footer */}
          <footer className="border-t border-black/[0.05] dark:border-white/[0.08] py-5 text-xs text-zinc-500 font-mono dashboard-footer mt-auto">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>FundingLock Protocol v1.0 • Fixed Funding Rate Risk Offset</span>
              </div>
              <div className="flex items-center gap-4 text-zinc-500 dark:text-zinc-400">
                <a
                  href={`https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-zinc-950 dark:hover:text-white transition"
                >
                  Solana Contract
                </a>
                <span>•</span>
                <span>Binance SOL-PERP</span>
                <span>•</span>
                <span>Solana Testnet</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </WalletContextProvider>
  );
}
