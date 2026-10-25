"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Play,
  RotateCcw,
} from "lucide-react";
import {
  BINANCE_SOL_CONFIG,
  type ContractTerms,
  type FundingObservation,
  type FundingOfferDraft,
  type PositionSide,
} from "../lib/domain/types";
import {
  buildCashFlowComparison,
  formatCurrency,
  formatRatePercent,
} from "../lib/domain/funding";
import {
  DEMO_SCENARIOS,
  FIXTURE_START_TIME,
  INTERVAL_SECONDS,
} from "../lib/data/fixtures";
import {
  Notice,
  PageHeader,
  Panel,
  SegmentedControl,
  StatCard,
} from "./ApplicationUI";
import { FundingCostChart } from "./FundingCostChart";
import type { NavTab } from "./SideNavbar";

interface HedgeSimulatorProps {
  customObservations?: FundingObservation[] | null;
  historyRevision?: number;
  onNavigateTab?: (tab: NavTab) => void;
  onPrepareOffer: (draft: FundingOfferDraft) => void;
}

export function HedgeSimulator({
  customObservations,
  historyRevision = 0,
  onNavigateTab,
  onPrepareOffer,
}: HedgeSimulatorProps) {
  const [positionSide, setPositionSide] = useState<PositionSide>("long");
  const [amount, setAmount] = useState(10000);
  const [rate, setRate] = useState(0.02);
  const [scenario, setScenario] = useState("baseline");
  const [ignoredHistoryRevision, setIgnoredHistoryRevision] = useState<
    number | null
  >(null);
  const historyActive = Boolean(
    customObservations?.length && ignoredHistoryRevision !== historyRevision,
  );
  const observations = useMemo(
    () =>
      historyActive
        ? customObservations!.map((item, index) => ({
            ...item,
            intervalIndex: index,
          }))
        : DEMO_SCENARIOS[scenario].observations,
    [historyActive, customObservations, scenario],
  );
  const terms = useMemo<ContractTerms>(() => {
    const intervalCount =
      Math.max(20, ...observations.map((item) => item.intervalIndex)) + 1;
    const startTime = observations[0]?.startTime ?? FIXTURE_START_TIME;
    return {
      contractId: "SIM-SOL-001",
      marketSymbol: "SOL-PERP",
      venueId: "BINANCE_PERP",
      positionSide,
      notionalCents: Math.round(amount * 100),
      fixedRatePpm: Math.round(rate * 10000),
      intervalCount,
      intervalSeconds: INTERVAL_SECONDS,
      startTime,
      endTime: startTime + intervalCount * INTERVAL_SECONDS,
      minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
      maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
      collateralMint: "SOL",
    };
  }, [observations, positionSide, amount, rate]);
  const result = useMemo(
    () => buildCashFlowComparison(terms, observations, BINANCE_SOL_CONFIG),
    [terms, observations],
  );
  const days = terms.intervalCount / 3;
  const incomplete = result.missingObservationsCount > 0;
  const reset = () => {
    setPositionSide("long");
    setAmount(10000);
    setRate(0.02);
    setScenario("baseline");
    setIgnoredHistoryRevision(historyRevision);
  };
  const changeScenario = (value: string) => {
    setIgnoredHistoryRevision(value === "history" ? null : historyRevision);
    if (value !== "history") setScenario(value);
  };

  return (
    <div className="app-page simple-page">
      <PageHeader
        title="Plan your funding"
        description="See what you could pay with a fixed-rate hedge before you create an offer."
        actions={
          <Link
            href="/contract-flow"
            className="app-button app-button-secondary"
          >
            <Play size={14} />
            Try guided example
          </Link>
        }
      />
      <div className="simple-calculator">
        <Panel
          title="1. Your position"
          className="simple-calculator-inputs"
          action={
            <button
              className="app-icon-button"
              aria-label="Reset calculator"
              title="Reset calculator"
              onClick={reset}
            >
              <RotateCcw size={15} />
            </button>
          }
        >
          <div className="app-stack-small">
            <div className="app-field">
              <span className="app-field-label">I hold a</span>
              <SegmentedControl
                label="Position direction"
                value={positionSide}
                options={[
                  { value: "long", label: "Long position" },
                  { value: "short", label: "Short position" },
                ]}
                onChange={setPositionSide}
              />
              <small>
                {positionSide === "long"
                  ? "A position that benefits when the price rises."
                  : "A position that benefits when the price falls."}
              </small>
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
                  step={100}
                  value={amount}
                  onChange={(event) =>
                    setAmount(
                      Math.max(0, Math.min(50000, Number(event.target.value))),
                    )
                  }
                  onBlur={() => setAmount((value) => Math.max(500, value))}
                />
                <span>USD</span>
              </div>
            </div>
            <div className="app-field">
              <label htmlFor="hedge-rate">The fixed rate I want</label>
              <div className="app-input-unit">
                <input
                  id="hedge-rate"
                  className="app-input"
                  type="number"
                  min={-0.5}
                  max={0.5}
                  step={0.0001}
                  value={rate}
                  onChange={(event) =>
                    setRate(
                      Math.max(-0.5, Math.min(0.5, Number(event.target.value))),
                    )
                  }
                />
                <span>% / 8h</span>
              </div>
              <small>
                Applied to your position for each 8-hour funding period.
              </small>
            </div>
            <div className="simple-duration">
              <span>Market</span>
              <strong>SOL-PERP</strong>
              <span>Duration</span>
              <strong>{days} days</strong>
            </div>
          </div>
        </Panel>
        <Panel
          title="2. Compare your costs"
          className="simple-calculator-result"
        >
          <div className="app-stack-small">
            <div className="app-field">
              <label htmlFor="hedge-scenario">What if funding…</label>
              <select
                id="hedge-scenario"
                className="app-select"
                value={historyActive ? "history" : scenario}
                onChange={(event) => changeScenario(event.target.value)}
              >
                {customObservations?.length && (
                  <option value="history">
                    Follows the {customObservations.length / 3}-day dataset
                  </option>
                )}
                <option value="baseline">Stays high at 0.10%</option>
                <option value="bullish">Keeps rising</option>
                <option value="bearish">Turns negative</option>
                <option value="spike">Spikes suddenly</option>
                {scenario === "missing" && (
                  <option value="missing">Has missing data</option>
                )}
              </select>
            </div>
            <div className="simple-comparison">
              <StatCard
                label="Without a hedge"
                value={
                  incomplete
                    ? "Incomplete"
                    : formatCurrency(result.totalActualFundingCostCents)
                }
                detail={
                  result.totalActualFundingCostCents < 0
                    ? `Received over ${days} days`
                    : `Paid over ${days} days`
                }
              />
              <StatCard
                label="With a fixed-rate hedge"
                value={
                  incomplete
                    ? "Incomplete"
                    : formatCurrency(result.netFundingCostCents)
                }
                detail={
                  result.netFundingCostCents < 0
                    ? `Received over ${days} days`
                    : `Paid over ${days} days`
                }
                accent
              />
            </div>
            {incomplete ? (
              <Notice tone="error">
                A funding observation is missing. The estimate is incomplete
                until every interval is recorded.
              </Notice>
            ) : (
              <p className="simple-result-explanation">
                {result.netFundingCostCents < 0 ? (
                  <>
                    Your net funding income would be{" "}
                    <strong>
                      {formatCurrency(-result.netFundingCostCents)}
                    </strong>
                  </>
                ) : (
                  <>
                    Your net funding cost would be{" "}
                    <strong>
                      {formatCurrency(result.netFundingCostCents)}
                    </strong>
                  </>
                )}{" "}
                over {days} days at the fixed rate. Your exchange position stays
                where it is.
              </p>
            )}
            <button
              className="app-button app-button-primary app-full-width"
              disabled={incomplete || amount < 500}
              onClick={() =>
                positionSide === "long"
                  ? onPrepareOffer({
                      positionSide,
                      notionalCents: terms.notionalCents,
                      fixedRatePpm: terms.fixedRatePpm,
                      intervalCount: terms.intervalCount,
                    })
                  : onNavigateTab?.("marketplace")
              }
            >
              {positionSide === "long"
                ? "Create an offer with these terms"
                : "Browse available offers"}
              <ArrowRight size={15} />
            </button>
            <p className="simple-next-step">
              {positionSide === "long"
                ? "Review the terms first. Connect a wallet when you’re ready."
                : "Short positions are available to simulate. Creating a Testnet offer currently requires a long position."}
            </p>
            {positionSide === "long" && (
              <button
                className="simple-inline-link"
                onClick={() => onNavigateTab?.("marketplace")}
              >
                Or browse available offers <ArrowUpRight size={13} />
              </button>
            )}
          </div>
        </Panel>
      </div>
      <p className="simple-example-note">
        Illustrative example, not a forecast. This hedge covers funding
        payments, not changes in the position’s price.
      </p>
      <details className="app-disclosure simple-calculation-details">
        <summary>
          <span>How this is calculated</span>
          <ChevronDown size={16} />
        </summary>
        <div className="app-panel-body app-stack">
          <dl className="app-detail-list">
            <div>
              <dt>Exchange funding</dt>
              <dd>{formatCurrency(result.totalActualFundingCostCents)}</dd>
            </div>
            <div>
              <dt>
                FundingLock payment{" "}
                {result.totalSettlementCents < 0
                  ? "to the counterparty"
                  : "to you"}
              </dt>
              <dd>{formatCurrency(Math.abs(result.totalSettlementCents))}</dd>
            </div>
            <div>
              <dt>
                Your net funding{" "}
                {result.netFundingCostCents < 0 ? "income" : "cost"}
              </dt>
              <dd>{formatCurrency(Math.abs(result.netFundingCostCents))}</dd>
            </div>
            <div>
              <dt>Estimated collateral you would deposit</dt>
              <dd>{formatCurrency(result.requiredCollateralBuyerCents)}</dd>
            </div>
          </dl>
          <FundingCostChart records={result.records} />
          <details className="simple-nested-details">
            <summary>
              View all {terms.intervalCount} funding intervals{" "}
              <ChevronDown size={14} />
            </summary>
            <div className="app-table-scroll">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Interval</th>
                    <th>Funding rate</th>
                    <th>FundingLock payment</th>
                  </tr>
                </thead>
                <tbody>
                  {result.records.map((record) => (
                    <tr key={record.intervalIndex}>
                      <td>#{record.intervalIndex + 1}</td>
                      <td>
                        {record.status === "missing"
                          ? "Missing"
                          : formatRatePercent(record.realizedRatePpm)}
                      </td>
                      <td>
                        {formatCurrency(record.intervalSettlementCents, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <div className="simple-detail-links">
            <button
              className="simple-inline-link"
              onClick={() => onNavigateTab?.("historical")}
            >
              Explore funding history <ArrowUpRight size={13} />
            </button>
            <button
              className="simple-inline-link"
              onClick={() => {
                setIgnoredHistoryRevision(historyRevision);
                setScenario("missing");
              }}
            >
              Try a missing-data example <ArrowUpRight size={13} />
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
