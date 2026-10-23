"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Navbar, NavTab } from "../components/Navbar.tsx";
import { MarketTickerBar } from "../components/MarketTickerBar.tsx";
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

  const handleSimulateHistorical = (observations: FundingObservation[]) => {
    setCustomObservations(observations);
    setActiveTab("simulator");
  };

  const handleAcceptOfferFromBoard = () => {
    setActiveTab("replay");
  };

  return (
    <WalletContextProvider>
      <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-800 selection:text-white">
        {/* Main Protocol Header */}
        <Navbar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            if (tab !== "simulator") {
              setCustomObservations(null);
            }
            setActiveTab(tab);
          }}
        />

        {/* Perp Market Live Ticker Sub-bar */}
        <MarketTickerBar />

        {/* Main Content Viewport */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          {activeTab === "simulator" && (
            <HedgeSimulator customObservations={customObservations} />
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

        {/* Institutional Monochromatic Footer */}
        <footer className="border-t border-zinc-900 bg-zinc-950/80 py-5 text-xs text-zinc-500 font-mono">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
              <span>FundingLock Protocol v1.0 • Decentralized Funding Risk Escrow</span>
            </div>
            <div className="flex items-center gap-4 text-zinc-400">
              <a
                href={`https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-200 transition"
              >
                Explorer Contract
              </a>
              <span>•</span>
              <span>Binance SOL-PERP Normalizer</span>
              <span>•</span>
              <span className="text-zinc-500">Testnet Prototype</span>
            </div>
          </div>
        </footer>
      </div>
    </WalletContextProvider>
  );
}
