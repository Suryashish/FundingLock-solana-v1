"use client";

import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Coins,
  Database,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import type { NavTab } from "./SideNavbar";
import { CryptoHubIllustration } from "./BlockeyIllustrations";
import { formatCurrency } from "../lib/domain/funding";
import { PageHeader, Panel, SegmentedControl, StatCard } from "./ApplicationUI";

const roles = {
  long: {
    label: "Long trader",
    problem:
      "When funding rises, holding a long perpetual position can become expensive.",
    hedge:
      "Agree to a fixed funding rate with a counterparty, while your position stays on your exchange.",
    result:
      "The settlement offsets the difference between observed funding and your agreed rate.",
  },
  short: {
    label: "Short / basis trader",
    problem:
      "When funding turns negative, a short perpetual position can incur higher funding costs.",
    hedge:
      "Model a fixed-rate hedge for the short side to understand its direction and cash flows.",
    result:
      "The payment direction reverses with the position. Explore short examples in the simulator.",
  },
  taker: {
    label: "Counterparty",
    problem:
      "You may have a different view of where funding rates are heading.",
    hedge:
      "Take the other side of a fixed-rate funding agreement and post the required collateral.",
    result:
      "Your settlement is the inverse of the hedger’s. Both sides’ maximum exposure is bounded by the contract.",
  },
};
const faqs = [
  {
    question: "Does my exchange position move?",
    answer:
      "No. Your perpetual futures position remains on your exchange. FundingLock is a separate funding-rate agreement on Solana; it does not request exchange API keys or withdrawal access.",
  },
  {
    question: "What does the hedge cover?",
    answer:
      "The agreement settles the difference between the observed funding rate and the fixed rate for the agreed notional, position side, and duration. The underlying position’s price risk remains. Observed rates are handled within the contract’s permitted bounds.",
  },
  {
    question: "How is collateral calculated?",
    answer:
      "The protocol calculates maximum exposure at the permitted rate bounds of −0.50% to +0.50% per interval, then adds a 5% buffer. Both counterparties must fund their required amount before activation. Estimates are shown in USD; the Testnet implementation uses SOL deposits.",
  },
  {
    question: "Are tokens transferred every eight hours?",
    answer:
      "No. Each observation updates the contract’s settlement ledger. The net settlement and remaining collateral are distributed at maturity, rather than transferring tokens for every funding interval.",
  },
  {
    question: "What if an observation is missing?",
    answer:
      "An unrecorded interval is never treated as zero funding. Final settlement requires the complete observation set. The contract walkthrough includes a missing-observation example so you can inspect the blocked state.",
  },
  {
    question: "What do PPM and interval mean?",
    answer:
      "PPM means parts per million. A rate of 200 PPM equals 0.02%. An interval is an eight-hour funding window; a seven-day agreement contains 21 intervals.",
  },
];

export function LandingOverview({
  onNavigate,
}: {
  onNavigate: (tab: NavTab) => void;
}) {
  const [persona, setPersona] = useState<keyof typeof roles>("long");
  const [notional, setNotional] = useState("10000");
  const [scenario, setScenario] = useState("bull");
  const variableRate =
    scenario === "bull" ? 1000 : scenario === "neutral" ? 300 : -500;
  const exchangeCost = Math.round(
    ((Number(notional) * 100 * variableRate) / 1000000) * 21,
  );
  const fixedCost = Math.round(((Number(notional) * 100 * 200) / 1000000) * 21);
  const offset = exchangeCost - fixedCost;
  const role = roles[persona];

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="GET TO KNOW FUNDINGLOCK"
        title="Protocol guide"
        description="The mechanics, the cash flows, and the details behind a fixed-rate funding hedge."
        actions={
          <button
            className="app-button app-button-secondary"
            onClick={() => onNavigate("replay")}
          >
            Try the walkthrough <ArrowUpRight size={14} />
          </button>
        }
      />
      <section className="guide-intro">
        <div>
          <span className="app-eyebrow">
            ONE AGREEMENT. TWO COUNTERPARTIES.
          </span>
          <h2>A fixed rate for a variable part of your trade.</h2>
          <p>
            FundingLock is a fixed-for-floating funding-rate agreement. Two
            counterparties agree on a rate, post collateral, and settle the
            funding difference at maturity. The underlying trade stays where it
            is.
          </p>
        </div>
        <CryptoHubIllustration className="guide-illustration" />
      </section>
      <Panel
        title="Where do you fit?"
        description="The same agreement, from three perspectives."
        action={
          <span className="app-badge">
            <BookOpen size={11} />
            The basics
          </span>
        }
      >
        <div className="app-stack-small">
          <div>
            <SegmentedControl
              label="Trading perspective"
              value={persona}
              options={[
                { value: "long", label: "Long trader" },
                { value: "short", label: "Short / basis" },
                { value: "taker", label: "Counterparty" },
              ]}
              onChange={setPersona}
            />
          </div>
          <div className="guide-role-grid">
            {[
              { title: "The exposure", text: role.problem },
              { title: "The agreement", text: role.hedge },
              { title: "The outcome", text: role.result },
            ].map((item, index) => (
              <div key={item.title}>
                <span className="app-section-label">0{index + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </Panel>
      <Panel
        title="Follow the cash flows"
        description="An illustrative long-position hedge: 7 days, 21 intervals, 0.02% fixed funding."
      >
        <div className="guide-calculator-controls">
          <div>
            <label>Position size</label>
            <SegmentedControl
              label="Example position size"
              value={notional}
              options={[
                { value: "1000", label: "$1,000" },
                { value: "10000", label: "$10,000" },
                { value: "50000", label: "$50,000" },
              ]}
              onChange={setNotional}
            />
          </div>
          <div>
            <label>Observed funding / 8h</label>
            <SegmentedControl
              label="Example market scenario"
              value={scenario}
              options={[
                { value: "bull", label: "High · +0.10%" },
                { value: "neutral", label: "Normal · +0.03%" },
                { value: "bear", label: "Negative · −0.05%" },
              ]}
              onChange={setScenario}
            />
          </div>
        </div>
        <div className="guide-comparison">
          <StatCard
            label="Exchange funding"
            value={formatCurrency(exchangeCost)}
            detail={
              exchangeCost >= 0
                ? "Paid to the exchange"
                : "Received from the exchange"
            }
          />
          <StatCard
            label="Settlement offset"
            value={formatCurrency(offset, true)}
            detail={
              offset >= 0 ? "Received by the hedger" : "Paid by the hedger"
            }
          />
          <StatCard
            label="Net funding cost"
            value={formatCurrency(fixedCost)}
            detail="The fixed-rate outcome"
            accent
          />
        </div>
        <div className="guide-formula">
          <span>{formatCurrency(exchangeCost)} exchange funding</span>
          <span>−</span>
          <span>{formatCurrency(offset)} settlement</span>
          <span>=</span>
          <strong>{formatCurrency(fixedCost)} net cost</strong>
        </div>
      </Panel>
      <Panel
        title="Designed around clear rules"
        description="The mechanics that define each agreement."
      >
        <div className="guide-principles">
          {[
            {
              icon: ShieldCheck,
              title: "Collateral before activation",
              text: "Both sides fund their exposure at the permitted rate bounds, with a safety buffer. The agreement cannot activate while required collateral is missing.",
            },
            {
              icon: Database,
              title: "Accounting between intervals",
              text: "Each observed funding rate updates an internal settlement ledger. Tokens stay in the collateral vault during the funding period.",
            },
            {
              icon: Coins,
              title: "A net settlement at maturity",
              text: "After all required observations are recorded, the contract settles the accumulated difference and returns remaining collateral.",
            },
            {
              icon: LockKeyhole,
              title: "Your trade stays in place",
              text: "The funding hedge is separate from your perpetual position. You keep control of the position on your exchange.",
            },
          ].map((item) => (
            <article key={item.title}>
              <item.icon size={20} />
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </Panel>
      <Panel
        title="The details, explained"
        description="Answers to common questions about the agreement."
      >
        {faqs.map((item) => (
          <details className="guide-faq" key={item.question}>
            <summary>
              {item.question}
              <ChevronDown size={16} />
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </Panel>
      <div className="app-row-between">
        <p className="app-small app-muted">
          Ready to explore a position of your own?
        </p>
        <button
          className="app-button app-button-primary"
          onClick={() => onNavigate("simulator")}
        >
          Open the simulator <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
