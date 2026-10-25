"use client";

import { ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import { PageHeader, Panel } from "./ApplicationUI";
import type { NavTab } from "./SideNavbar";
import { PROGRAM_ID } from "../lib/solana/client";

const questions = [
  {
    question: "What does the hedge cover?",
    answer:
      "It covers the difference between your agreed fixed funding rate and the observed funding rate for the contract’s position size and duration. Price changes in your trading position are separate.",
  },
  {
    question: "Do I need to move my trading position?",
    answer:
      "No. Your perpetual position stays on your exchange. FundingLock is a separate agreement and does not require exchange API keys or withdrawal access.",
  },
  {
    question: "Why is a deposit required?",
    answer:
      "Both parties deposit collateral to cover the agreement’s permitted funding exposure. The contract settles the funding difference at the end and returns unused collateral. You can review the required deposit before agreeing.",
  },
  {
    question: "Do I need a wallet to try it?",
    answer:
      "No wallet is needed for the calculator or example walkthrough. You need a compatible Solana wallet and Testnet SOL to publish or accept Testnet offers.",
  },
];

export function LandingOverview({
  onNavigate,
}: {
  onNavigate: (tab: NavTab) => void;
}) {
  return (
    <div className="app-page simple-page simple-guide">
      <PageHeader
        title="How it works"
        description="Funding fees change over time. A hedge lets two people agree on a fixed rate for a set period."
      />
      <Panel title="Three steps to a fixed funding rate">
        <ol className="simple-guide-steps">
          {[
            {
              title: "See what you could pay",
              description:
                "Enter your position size and fixed rate in the calculator. Compare the result across example market conditions.",
            },
            {
              title: "Agree on an offer",
              description:
                "Create an offer or review one from another trader. Once matched, both parties deposit the required collateral.",
            },
            {
              title: "Settle the difference",
              description:
                "At the end of the contract, FundingLock settles the difference between the observed and fixed funding rates. Unused collateral is returned.",
            },
          ].map((item, index) => (
            <li key={item.title}>
              <span>{index + 1}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="simple-guide-actions">
          <button
            className="app-button app-button-primary"
            onClick={() => onNavigate("simulator")}
          >
            Open the calculator <ArrowRight size={14} />
          </button>
          <button
            className="simple-inline-link"
            onClick={() => onNavigate("replay")}
          >
            Try a guided example <ArrowUpRight size={14} />
          </button>
        </div>
      </Panel>
      <Panel title="Common questions">
        {questions.map((item) => (
          <details className="guide-faq" key={item.question}>
            <summary>
              {item.question}
              <ChevronDown size={16} />
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </Panel>
      <details className="app-disclosure">
        <summary>
          <span>Technical details</span>
          <ChevronDown size={16} />
        </summary>
        <div className="app-panel-body simple-help-copy">
          <dl className="app-detail-list">
            <div>
              <dt>Environment</dt>
              <dd>Solana Testnet</dd>
            </div>
            <div>
              <dt>Market reference</dt>
              <dd>Binance SOL-PERP</dd>
            </div>
            <div>
              <dt>Funding frequency</dt>
              <dd>Every 8 hours</dd>
            </div>
            <div>
              <dt>Rate bounds</dt>
              <dd>−0.50% to +0.50%</dd>
            </div>
            <div>
              <dt>Collateral buffer</dt>
              <dd>5%</dd>
            </div>
          </dl>
          <p>
            Funding observations update an internal ledger. Settlement requires
            every interval to be recorded; missing data is never treated as
            zero.
          </p>
          <a
            href={`https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=testnet`}
            target="_blank"
            rel="noreferrer"
            className="simple-inline-link"
          >
            View the deployed contract <ArrowUpRight size={13} />
          </a>
        </div>
      </details>
    </div>
  );
}
