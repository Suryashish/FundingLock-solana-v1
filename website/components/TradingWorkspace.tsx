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
import type {
  FundingObservation,
  FundingOfferDraft,
} from "../lib/domain/types";

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
  offerDraft: FundingOfferDraft | null;
  offerDraftRevision: number;
  prepareOffer: (draft: FundingOfferDraft) => void;
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
  const [offerDraft, setOfferDraft] = useState<FundingOfferDraft | null>(null);
  const [offerDraftRevision, setOfferDraftRevision] = useState(0);
  const prepareOffer = (draft: FundingOfferDraft) => {
    setOfferDraft(draft);
    setOfferDraftRevision((revision) => revision + 1);
  };
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
        value={{
          observations,
          datasetRevision,
          setObservations,
          offerDraft,
          offerDraftRevision,
          prepareOffer,
        }}
      >
        <div className="app-shell">
          <SideNavbar
            activeTab={activeTab}
            onSelectTab={(tab) => {
              router.push(tabRoutes[tab]);
            }}
            isDark={isDark}
            onToggleTheme={() => setIsDark((value) => !value)}
          />
          <div className="app-workspace-content">
            <main className="app-main">{children}</main>
            <footer className="app-footer">
              <Link href="/">FundingLock</Link>
              <span>
                Solana Testnet · Example calculations and test transactions
              </span>
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
        historyRevision={workspace?.datasetRevision}
        customObservations={workspace?.observations}
        onNavigateTab={navigate}
        onPrepareOffer={(draft) => {
          workspace?.prepareOffer(draft);
          navigate("marketplace");
        }}
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
    return (
      <MarketplaceBoard
        key={workspace?.offerDraftRevision}
        initialDraft={workspace?.offerDraft}
        onAcceptOfferClick={() => navigate("replay")}
      />
    );
  if (tab === "replay") return <ReplayDemo />;
  return <LandingOverview onNavigate={navigate} />;
}
