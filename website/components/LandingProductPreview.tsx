"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { StatCard } from "./ApplicationUI";
import { FundingCostChart } from "./FundingCostChart";
import { BASELINE_CONTRACT_TERMS, DEMO_SCENARIOS } from "../lib/data/fixtures";
import { buildCashFlowComparison, formatCurrency } from "../lib/domain/funding";

export function LandingProductPreview() {
  const [scenario, setScenario] = useState("bullish");
  const [notional, setNotional] = useState(10000);
  const comparison = useMemo(
    () =>
      buildCashFlowComparison(
        { ...BASELINE_CONTRACT_TERMS, notionalCents: notional * 100 },
        DEMO_SCENARIOS[scenario].observations,
      ),
    [scenario, notional],
  );
  return (
    <section className="landing-section landing-product-section">
      <div className="landing-section-heading">
        <div>
          <span className="landing-eyebrow">
            <span />
            THE WORKSPACE, IN FOCUS
          </span>
          <h2>
            Less noise.
            <br />
            <span>A clearer picture.</span>
          </h2>
        </div>
        <p>
          Put your position in perspective.
          <br />
          Explore a scenario and see the numbers change.
        </p>
      </div>
      <div className="landing-product-demo">
        <div className="product-demo-topbar">
          <div>
            <span className="product-demo-icon">
              <SlidersHorizontal size={17} />
            </span>
            <strong>Hedge simulator</strong>
          </div>
          <span className="app-badge app-badge-accent">
            Interactive preview
          </span>
        </div>
        <div className="product-demo-layout">
          <div className="product-demo-controls">
            <span className="app-eyebrow">YOUR POSITION</span>
            <div className="app-field">
              <label htmlFor="preview-size">Position size</label>
              <div className="product-demo-notional">
                ${notional.toLocaleString("en-US")}
                <span>USD</span>
              </div>
              <input
                id="preview-size"
                className="app-range"
                type="range"
                min={1000}
                max={25000}
                step={1000}
                value={notional}
                onChange={(event) => setNotional(Number(event.target.value))}
              />
            </div>
            <div className="app-field">
              <label htmlFor="preview-scenario">Market scenario</label>
              <select
                id="preview-scenario"
                className="app-select"
                value={scenario}
                onChange={(event) => setScenario(event.target.value)}
              >
                <option value="bullish">Rising funding</option>
                <option value="spike">Volatility spike</option>
                <option value="bearish">Negative funding</option>
              </select>
            </div>
            <dl className="app-detail-list">
              <div>
                <dt>Fixed rate</dt>
                <dd>0.02% / 8h</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>7 days</dd>
              </div>
            </dl>
            <Link href="/simulator" className="app-button app-button-primary">
              Open full simulator <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="product-demo-results">
            <div className="simulator-result-stats">
              <StatCard
                label="Without a hedge"
                value={formatCurrency(comparison.totalActualFundingCostCents)}
                detail="Example funding cost"
              />
              <StatCard
                label="Settlement offset"
                value={formatCurrency(comparison.totalSettlementCents, true)}
                detail="Between counterparties"
              />
              <StatCard
                label="Net funding cost"
                value={formatCurrency(comparison.netFundingCostCents)}
                detail="At the fixed rate"
                accent
              />
            </div>
            <div className="product-demo-chart">
              <FundingCostChart records={comparison.records} />
            </div>
          </div>
        </div>
        <div className="product-demo-caption">
          <span>Illustrative scenarios. No wallet required.</span>
          <span>SOL-PERP · 21 funding intervals</span>
        </div>
      </div>
    </section>
  );
}
