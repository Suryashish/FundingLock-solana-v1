"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  BINANCE_SOL_CONFIG,
  ContractTerms,
  FundingObservation,
  PositionSide,
} from "../lib/domain/types.ts";
import {
  buildCashFlowComparison,
  formatCurrency,
  formatRatePercent,
} from "../lib/domain/funding.ts";
import {
  DEMO_SCENARIOS,
  FIXTURE_START_TIME,
  INTERVAL_SECONDS,
} from "../lib/data/fixtures.ts";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Clock3,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import {
  Notice,
  PageHeader,
  Panel,
  SegmentedControl,
  StatCard,
} from "./ApplicationUI";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { TransactionInstruction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  buildCreateOfferIx,
  buildInitializeMarketIx,
} from "../lib/solana/client.ts";
import {
  createContractId,
  fetchContractAccount,
  fetchMarketConfig,
  formatSignature,
  simulateAndSendTransaction,
  type OnChainContractState,
  type OnChainMarketConfig,
} from "../lib/solana/transactions.ts";
import { NavTab } from "./SideNavbar.tsx";
import { WorkspaceResources } from "./WorkspaceResources";
import { FundingCostChart } from "./FundingCostChart";

interface HedgeSimulatorProps {
  customObservations?: FundingObservation[] | null;
  onNavigateTab?: (tab: NavTab) => void;
}

export const HedgeSimulator: React.FC<HedgeSimulatorProps> = ({
  customObservations,
  onNavigateTab,
}) => {
  const [positionSide, setPositionSide] = useState<PositionSide>("long");
  const [notionalDollars, setNotionalDollars] = useState<number>(10000);
  const [fixedRatePercent, setFixedRatePercent] = useState<number>(0.02);
  const [selectedScenarioId, setSelectedScenarioId] =
    useState<string>("baseline");
  const [useHistoricalData, setUseHistoricalData] = useState(true);

  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [marketConfig, setMarketConfig] = useState<OnChainMarketConfig | null>(
    null,
  );
  const [onChainContract, setOnChainContract] =
    useState<OnChainContractState | null>(null);
  const [chainAction, setChainAction] = useState<{
    state: "idle" | "pending" | "success" | "error";
    message: string;
  }>({ state: "idle", message: "" });

  // Real-time epoch countdown
  const [countdown, setCountdown] = useState<string>("00h 00m 00s");

  useEffect(() => {
    function updateCountdown() {
      const now = new Date();
      const currentUtcHours = now.getUTCHours();
      const currentUtcMinutes = now.getUTCMinutes();
      const currentUtcSeconds = now.getUTCSeconds();

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

  // Fetch balance
  useEffect(() => {
    if (!wallet.publicKey || !wallet.connected) {
      return;
    }
    let active = true;
    connection
      .getBalance(wallet.publicKey, "confirmed")
      .then((bal) => {
        if (active) setWalletBalance(Number(bal) / Number(LAMPORTS_PER_SOL));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [wallet.connected, wallet.publicKey, connection]);

  // Active observations
  const activeObservations = useMemo(() => {
    if (
      useHistoricalData &&
      customObservations &&
      customObservations.length > 0
    ) {
      return customObservations.map((observation, index) => ({
        ...observation,
        intervalIndex: index,
      }));
    }
    const scenario =
      DEMO_SCENARIOS[selectedScenarioId] || DEMO_SCENARIOS.baseline;
    return scenario.observations;
  }, [customObservations, selectedScenarioId, useHistoricalData]);

  // Construct active contract terms
  const terms: ContractTerms = useMemo(() => {
    const fixedRatePpm = Math.round(fixedRatePercent * 10000);
    return {
      contractId: "SIM-SOL-001",
      marketSymbol: "SOL-PERP",
      venueId: "BINANCE_PERP",
      positionSide,
      notionalCents: Math.round(notionalDollars * 100),
      fixedRatePpm,
      intervalCount:
        Math.max(
          ...activeObservations.map((observation) => observation.intervalIndex),
          20,
        ) + 1,
      intervalSeconds: INTERVAL_SECONDS,
      startTime: activeObservations[0]?.startTime ?? FIXTURE_START_TIME,
      endTime:
        (activeObservations[0]?.startTime ?? FIXTURE_START_TIME) +
        (Math.max(
          ...activeObservations.map((observation) => observation.intervalIndex),
          20,
        ) +
          1) *
          INTERVAL_SECONDS,
      minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
      maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
      collateralMint: "SOL",
    };
  }, [positionSide, notionalDollars, fixedRatePercent, activeObservations]);

  // Pure domain calculation
  const explanation = useMemo(() => {
    return buildCashFlowComparison(
      terms,
      activeObservations,
      BINANCE_SOL_CONFIG,
    );
  }, [terms, activeObservations]);

  useEffect(() => {
    let active = true;
    fetchMarketConfig(connection)
      .then((config) => {
        if (active) setMarketConfig(config);
      })
      .catch(() => {
        if (active) setMarketConfig(null);
      });
    return () => {
      active = false;
    };
  }, [connection]);

  const handleCreateOfferOnChain = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      setChainAction({
        state: "error",
        message: "Wallet not connected. Opening wallet selector...",
      });
      setVisible(true);
      return;
    }
    if (positionSide !== "long") {
      setChainAction({
        state: "error",
        message:
          "The deployed Testnet contract currently supports long offers only.",
      });
      return;
    }

    setChainAction({
      state: "pending",
      message: "Verifying Testnet balance and preparing transaction…",
    });
    try {
      const lamports = await connection.getBalance(
        wallet.publicKey,
        "confirmed",
      );
      if (lamports < 5_000_000) {
        throw new Error(
          `Insufficient Testnet SOL (balance: ${(lamports / 1e9).toFixed(4)} SOL). Need ~0.005 SOL for fees. Fund at https://faucet.solana.com.`,
        );
      }

      const config = marketConfig ?? (await fetchMarketConfig(connection));
      const instructions: TransactionInstruction[] = [];

      if (!config) {
        instructions.push(
          buildInitializeMarketIx({
            venueId: BINANCE_SOL_CONFIG.venueId,
            marketSymbol: BINANCE_SOL_CONFIG.marketSymbol,
            intervalSeconds: BINANCE_SOL_CONFIG.intervalSeconds,
            minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
            maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
            maxNotionalCents: BINANCE_SOL_CONFIG.maxNotionalCents,
            safetyBufferBps: BINANCE_SOL_CONFIG.safetyBufferBps,
            oracleAuthority: wallet.publicKey,
            admin: wallet.publicKey,
          }),
        );
      } else if (config.isPaused) {
        throw new Error("The on-chain SOL-PERP market is currently paused.");
      }

      const contractId = createContractId("SIM", wallet.publicKey);
      instructions.push(
        buildCreateOfferIx({
          contractId,
          marketSymbol: BINANCE_SOL_CONFIG.marketSymbol,
          buyer: wallet.publicKey,
          positionSide,
          notionalCents: terms.notionalCents,
          fixedRatePpm: terms.fixedRatePpm,
          intervalCount: terms.intervalCount,
          startTime: Math.floor(Date.now() / 1000),
        }),
      );

      setChainAction({
        state: "pending",
        message:
          "Awaiting wallet approval… Please approve the transaction in your wallet prompt.",
      });

      const signature = await simulateAndSendTransaction({
        connection,
        wallet,
        description: config
          ? "Create offer"
          : "Initialize market & create offer",
        instructions,
      });

      const updatedConfig = await fetchMarketConfig(connection);
      if (updatedConfig) setMarketConfig(updatedConfig);

      const account = await fetchContractAccount(connection, contractId);
      setOnChainContract(account);
      setChainAction({
        state: "success",
        message: `Offer ${contractId} created on Testnet! Tx: ${formatSignature(signature)}.`,
      });
    } catch (error) {
      setChainAction({
        state: "error",
        message:
          error instanceof Error ? error.message : "Offer creation failed.",
      });
    }
  };

  const resetToDocumentedBaseline = () => {
    setPositionSide("long");
    setNotionalDollars(10000);
    setFixedRatePercent(0.02);
    setSelectedScenarioId("baseline");
    setUseHistoricalData(false);
    setChainAction({ state: "idle", message: "" });
  };

  const durationDays = terms.intervalCount / 3;
  const historicalActive = Boolean(
    customObservations?.length && useHistoricalData,
  );

  const summaryCards = (
    <div className="simulator-result-stats">
      <StatCard
        label="Without a hedge"
        value={formatCurrency(explanation.totalActualFundingCostCents)}
        detail={`Over ${durationDays.toFixed(durationDays % 1 ? 1 : 0)} days`}
      />
      <StatCard
        label="Funding offset"
        value={formatCurrency(explanation.totalSettlementCents, true)}
        detail={
          explanation.totalSettlementCents >= 0
            ? "Received by hedger"
            : "Paid by hedger"
        }
      />
      <StatCard
        label="Net funding cost"
        value={formatCurrency(explanation.netFundingCostCents)}
        detail="After the hedge"
        accent
      />
    </div>
  );

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="PLAN YOUR POSITION"
        title="Hedge simulator"
        description="Explore your funding costs. Find a fixed rate that fits your position."
        actions={
          <button
            type="button"
            className="app-button app-button-secondary"
            onClick={resetToDocumentedBaseline}
          >
            <RotateCcw size={14} />
            Reset simulation
          </button>
        }
      />
      <div className="simulator-market-strip">
        <span>
          <span className="app-badge app-badge-accent">SOL-PERP</span>Binance
          perpetuals
        </span>
        <span>
          <Clock3 size={13} />
          8-hour intervals
        </span>
        <span>
          <ShieldCheck size={13} />
          Example data
        </span>
        <span>
          Next funding window{" "}
          <strong className="app-number">{countdown}</strong>
        </span>
      </div>
      <div className="simulator-mobile-summary">{summaryCards}</div>
      <div className="simulator-layout">
        <div className="app-stack simulator-config-column">
          <Panel
            title="Your hedge"
            description="Adjust the terms to compare outcomes."
            className="simulator-inputs"
            action={<span className="app-badge">01</span>}
          >
            <div className="app-field">
              <span className="app-field-label">Position direction</span>
              <SegmentedControl
                label="Position direction"
                value={positionSide}
                options={[
                  { value: "long", label: "Long position" },
                  { value: "short", label: "Short position" },
                ]}
                onChange={setPositionSide}
              />
            </div>
            <div className="app-field">
              <label htmlFor="hedge-notional">Position size</label>
              <div className="app-input-unit">
                <input
                  id="hedge-notional"
                  className="app-input"
                  type="number"
                  min={500}
                  max={50000}
                  step={500}
                  value={notionalDollars}
                  onChange={(event) =>
                    setNotionalDollars(
                      Math.max(0, Math.min(50000, Number(event.target.value))),
                    )
                  }
                  onBlur={() =>
                    setNotionalDollars((value) => Math.max(500, value))
                  }
                />
                <span>USD</span>
              </div>
              <input
                className="app-range"
                aria-label="Notional size in US dollars"
                type="range"
                min={500}
                max={50000}
                step={500}
                value={notionalDollars}
                onChange={(event) =>
                  setNotionalDollars(Number(event.target.value))
                }
              />
              <div className="app-presets">
                {[1000, 5000, 10000, 25000].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={notionalDollars === value}
                    onClick={() => setNotionalDollars(value)}
                  >
                    ${value / 1000}k
                  </button>
                ))}
              </div>
            </div>
            <div className="app-field">
              <label htmlFor="hedge-rate">Fixed funding rate</label>
              <div className="app-input-unit">
                <input
                  id="hedge-rate"
                  className="app-input"
                  type="number"
                  min={-0.5}
                  max={0.5}
                  step={0.005}
                  value={fixedRatePercent}
                  onChange={(event) =>
                    setFixedRatePercent(
                      Math.max(-0.5, Math.min(0.5, Number(event.target.value))),
                    )
                  }
                />
                <span>% / 8h</span>
              </div>
              <div className="app-presets">
                {[0.01, 0.02, 0.05, -0.02].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={fixedRatePercent === value}
                    onClick={() => setFixedRatePercent(value)}
                  >
                    {value > 0 ? "+" : ""}
                    {value.toFixed(2)}%
                  </button>
                ))}
              </div>
            </div>
            <div className="app-field">
              <label htmlFor="hedge-scenario">Market scenario</label>
              <select
                id="hedge-scenario"
                className="app-select"
                value={historicalActive ? "historical" : selectedScenarioId}
                onChange={(event) => {
                  setUseHistoricalData(event.target.value === "historical");
                  if (event.target.value !== "historical")
                    setSelectedScenarioId(event.target.value);
                }}
              >
                {customObservations?.length && (
                  <option value="historical">
                    Loaded history · {customObservations.length / 3} days
                  </option>
                )}
                <option value="baseline">Baseline · +0.10% funding</option>
                <option value="bullish">Rising funding</option>
                <option value="bearish">Negative funding</option>
                <option value="spike">Volatility spike</option>
                <option value="missing">Missing observation</option>
              </select>
              <small>
                {historicalActive
                  ? "Your selected history is loaded for this simulation."
                  : "Illustrative scenarios. Results are not a forecast."}
              </small>
            </div>
            <dl className="app-detail-list">
              <div>
                <dt>Hedge duration</dt>
                <dd>{durationDays.toFixed(durationDays % 1 ? 1 : 0)} days</dd>
              </div>
              <div>
                <dt>Funding intervals</dt>
                <dd>{terms.intervalCount}</dd>
              </div>
            </dl>
          </Panel>
          <Panel
            title="Collateral estimate"
            description="Based on the permitted rate bounds."
          >
            <dl className="app-detail-list">
              <div>
                <dt>Hedger collateral</dt>
                <dd>
                  {formatCurrency(explanation.requiredCollateralBuyerCents)}
                </dd>
              </div>
              <div>
                <dt>Counterparty collateral</dt>
                <dd>
                  {formatCurrency(explanation.requiredCollateralRiskTakerCents)}
                </dd>
              </div>
              <div>
                <dt>Safety buffer</dt>
                <dd>5%</dd>
              </div>
            </dl>
            <p className="app-small app-muted" style={{ marginTop: 14 }}>
              Estimates shown in USD. The Testnet contract uses SOL collateral.
            </p>
          </Panel>
        </div>
        <div className="app-stack">
          <div className="simulator-desktop-summary">{summaryCards}</div>
          <Panel
            title="A clearer view of your costs"
            description="Cumulative funding across the selected scenario."
            action={<span className="app-badge">USD</span>}
          >
            <FundingCostChart records={explanation.records} />
            <div className="simulator-equation">
              <p>Variable funding − settlement offset = net cost</p>
              <strong className="app-number">
                {formatCurrency(explanation.netFundingCostCents)}
              </strong>
            </div>
          </Panel>
          {explanation.missingObservationsCount > 0 ? (
            <Notice tone="error">
              {explanation.missingObservationsCount} observation missing.
              Settlement remains incomplete until every required interval is
              recorded.
            </Notice>
          ) : (
            <Notice>
              <strong>The hedge settles the difference.</strong> Your exchange
              position stays in place. A positive offset is paid to the hedger;
              a negative offset is paid to the counterparty.
            </Notice>
          )}
          <Panel
            title="Ready to set your terms?"
            description="Create an offer using the parameters you’ve explored."
          >
            <div className="app-stack-small">
              <button
                className="app-button app-button-primary app-full-width"
                onClick={handleCreateOfferOnChain}
                disabled={
                  chainAction.state === "pending" ||
                  explanation.missingObservationsCount > 0 ||
                  notionalDollars < 500
                }
              >
                <LockKeyhole size={15} />
                {chainAction.state === "pending"
                  ? "Preparing your offer…"
                  : wallet.connected
                    ? "Create Testnet offer"
                    : "Connect wallet to create an offer"}
                <ArrowRight size={15} />
              </button>
              <p className="simulator-cta-note">
                Solana Testnet ·{" "}
                {wallet.connected && walletBalance !== null
                  ? `${walletBalance.toFixed(4)} SOL available`
                  : "Testnet SOL required for contract interactions"}
              </p>
              {chainAction.message && (
                <Notice
                  tone={
                    chainAction.state === "error"
                      ? "error"
                      : chainAction.state === "success"
                        ? "success"
                        : "info"
                  }
                >
                  {chainAction.message}
                </Notice>
              )}
              {onChainContract && (
                <p className="app-small app-muted">
                  Contract {onChainContract.contractId} ·{" "}
                  {onChainContract.lifecycleLabel}
                </p>
              )}
              <button
                className="app-button app-button-ghost"
                onClick={() => onNavigateTab?.("marketplace")}
              >
                Or explore existing offers <ArrowUpRight size={14} />
              </button>
            </div>
          </Panel>
        </div>
      </div>
      <details className="app-disclosure">
        <summary>
          <span>
            Interval settlement ledger{" "}
            <span className="app-badge">{terms.intervalCount} intervals</span>
          </span>
          <ChevronDown size={17} />
        </summary>
        <div className="app-table-scroll">
          <table className="app-table">
            <thead>
              <tr>
                <th>Interval</th>
                <th>Observed rate</th>
                <th>Exchange funding</th>
                <th>Settlement offset</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {explanation.records.map((record) => (
                <tr key={record.intervalIndex}>
                  <td>#{record.intervalIndex + 1}</td>
                  <td>
                    {record.status === "missing"
                      ? "—"
                      : formatRatePercent(record.realizedRatePpm)}
                  </td>
                  <td>{formatCurrency(record.actualFundingCostCents)}</td>
                  <td className="app-accent">
                    {formatCurrency(record.intervalSettlementCents, true)}
                  </td>
                  <td>
                    <span
                      className={`app-badge${record.status === "recorded" ? " app-badge-accent" : ""}`}
                    >
                      {record.status === "recorded" ? "Recorded" : "Missing"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <WorkspaceResources onNavigate={(tab) => onNavigateTab?.(tab)} />
    </div>
  );
};
