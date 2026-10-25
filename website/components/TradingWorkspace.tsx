"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SideNavbar, type NavTab } from "./SideNavbar";
import { HedgeSimulator } from "./HedgeSimulator";
import { HistoricalDashboard } from "./HistoricalDashboard";
import { MarketplaceBoard } from "./MarketplaceBoard";
import { ReplayDemo } from "./ReplayDemo";
import { LandingOverview } from "./LandingOverview";
import type { FundingObservation } from "../lib/domain/types";
import { PROGRAM_ID } from "../lib/solana/client";

const WalletContextProvider = dynamic(
  () =>
    import("./WalletContextProvider").then((mod) => mod.WalletContextProvider),
  {
    ssr: false,
    loading: () => (
      <div className="workspace-loading">
        Opening your workspace
        <span />
      </div>
    ),
  },
);

const tabRoutes: Record<NavTab, string> = {
  simulator: "/simulator",
  historical: "/rates",
  marketplace: "/marketplace",
  replay: "/contract-flow",
  overview: "/protocol",
};

const WorkspaceContext = createContext<{
  observations: FundingObservation[] | null;
  datasetRevision: number;
  setObservations: (observations: FundingObservation[] | null) => void;
} | null>(null);

export function TradingWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [observations, setObservationState] = useState<
    FundingObservation[] | null
  >(null);
  const [datasetRevision, setDatasetRevision] = useState(0);
  const setObservations = (next: FundingObservation[] | null) => {
    setObservationState(next);
    setDatasetRevision((revision) => revision + 1);
  };
  const activeTab =
    (Object.keys(tabRoutes) as NavTab[]).find(
      (tab) => tabRoutes[tab] === pathname,
    ) ?? "simulator";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    return () => document.documentElement.classList.remove("dark");
  }, [isDark]);

  return (
    <WalletContextProvider>
      <WorkspaceContext.Provider
        value={{ observations, datasetRevision, setObservations }}
      >
        <div className="app-shell">
          <SideNavbar
            activeTab={activeTab}
            onSelectTab={(tab) => {
              if (tab !== "simulator") setObservations(null);
              router.push(tabRoutes[tab]);
            }}
            isDark={isDark}
            onToggleTheme={() => setIsDark((value) => !value)}
          />
          <div className="app-workspace-content">
            <main className="app-main">{children}</main>
            <footer className="app-footer">
              <Link
                href="/"
                className="hover:text-emerald-500 transition-colors"
              >
                © 2026 FundingLock
              </Link>
              <div className="app-footer-links">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Solana Testnet
                </span>
                <a
                  href={`https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-500"
                >
                  View contract ↗
                </a>
              </div>
            </footer>
          </div>
        </div>
      </WorkspaceContext.Provider>
    </WalletContextProvider>
  );
}

export function TradingView({ tab }: { tab: NavTab }) {
  const router = useRouter();
  const workspace = useContext(WorkspaceContext);
  const navigate = (next: NavTab) => router.push(tabRoutes[next]);
  if (tab === "simulator")
    return (
      <HedgeSimulator
        key={workspace?.datasetRevision}
        customObservations={workspace?.observations}
        onNavigateTab={navigate}
      />
    );
  if (tab === "historical")
    return (
      <HistoricalDashboard
        onSimulateHistorical={(observations) => {
          workspace?.setObservations(observations);
          navigate("simulator");
        }}
      />
    );
  if (tab === "marketplace")
    return <MarketplaceBoard onAcceptOfferClick={() => navigate("replay")} />;
  if (tab === "replay") return <ReplayDemo />;
  return <LandingOverview onNavigate={navigate} />;
}
