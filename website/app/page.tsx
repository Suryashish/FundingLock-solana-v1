import Link from "next/link";
import "./hero.css";
import { HeroFundingVisual } from "../components/HeroFundingVisual";
import { LandingProductPreview } from "../components/LandingProductPreview";
import {
  ArrowDown,
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronDown,
  LockKeyhole,
  Menu,
  MoveRight,
  ShieldCheck,
  SlidersHorizontal,
  Waves,
} from "lucide-react";

const appLinks = [
  { href: "/simulator", label: "Calculator" },
  { href: "/marketplace", label: "Offers" },
  { href: "/protocol", label: "Help" },
];

function Brand() {
  return (
    <Link href="/" className="landing-brand" aria-label="FundingLock home">
      <span className="landing-brand-icon">
        <LockKeyhole size={18} strokeWidth={2.3} />
      </span>
      fundinglock<span className="brand-period">.</span>
    </Link>
  );
}

const faqs = [
  [
    "What exactly am I hedging?",
    "FundingLock hedges the funding-rate payments on a perpetual futures position. You agree on a fixed rate with a counterparty, and the contract settles the difference against observed funding. Your underlying position stays on your exchange; price risk remains with that position.",
  ],
  [
    "Do I need to connect a wallet to try it?",
    "No. You can use the simulator, explore example scenarios, and read the protocol guide without a wallet. Connect a compatible Solana wallet when you want to interact with the Testnet contract.",
  ],
  [
    "How does collateral work?",
    "Both counterparties post collateral calculated from the contract’s permitted funding-rate bounds, with a buffer. The protocol guide explains the collateral model, settlement rules, and limitations. The current implementation uses SOL collateral on Solana Testnet.",
  ],
  [
    "Is FundingLock available on mainnet?",
    "FundingLock is currently a Testnet application for exploration and testing. Simulations use example or historical datasets, and Testnet transactions use Testnet SOL.",
  ],
];

export default function Home() {
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-nav-wrap">
          <Brand />
          <nav className="landing-nav" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <Link href="/protocol">
              Help <ArrowUpRight size={13} />
            </Link>
          </nav>
          <Link
            href="/simulator"
            className="landing-button landing-button-small"
          >
            Launch app <ArrowUpRight size={15} />
          </Link>
          <details className="landing-mobile-menu">
            <summary aria-label="Open navigation">
              <Menu size={21} />
            </summary>
            <nav aria-label="Mobile navigation">
              {appLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="hero-title">
          <div className="hero-backdrop" aria-hidden="true" />
          <div className="hero-layout">
            <div className="hero-copy">
              <div className="hero-availability">
                <span className="hero-availability-dot" />
                FUNDING-RATE HEDGES ON SOLANA
                <span className="hero-availability-tag">TESTNET</span>
              </div>
              <h1 id="hero-title">
                Your funding.
                <br />
                <span>On your terms.</span>
              </h1>
              <p className="hero-description">
                Turn unpredictable perpetual funding into a fixed rate. Keep
                your position. Take control of the cost.
              </p>
              <div className="hero-actions">
                <Link
                  href="/simulator"
                  className="landing-button hero-primary-action"
                >
                  Explore the simulator <ArrowUpRight size={17} />
                </Link>
                <a href="#how-it-works" className="hero-secondary-action">
                  How it works <ArrowDown size={15} />
                </a>
              </div>
              <div className="hero-reassurance">
                <ShieldCheck size={14} />
                <span>No wallet needed to explore.</span>
                <span className="hero-reassurance-divider" />
                <span>Your position stays yours.</span>
              </div>
            </div>
            <HeroFundingVisual />
          </div>
          <div className="hero-principles">
            <span className="hero-principles-label">ONE LESS VARIABLE.</span>
            <div>
              <span>
                <i>01</i>Choose your fixed rate
              </span>
              <span>
                <i>02</i>Keep your exchange position
              </span>
              <span>
                <i>03</i>Settle the difference on-chain
              </span>
            </div>
            <a href="#how-it-works" aria-label="Discover how FundingLock works">
              <ArrowDown size={16} />
            </a>
          </div>
        </section>

        <LandingProductPreview />

        <section
          id="why-fundinglock"
          className="landing-features landing-section"
        >
          <div className="landing-section-heading">
            <div>
              <span className="landing-eyebrow">
                <span />
                THE EDGE IS CERTAINTY
              </span>
              <h2>
                Your trade. Your thesis.
                <br />
                <span>One less thing to watch.</span>
              </h2>
            </div>
            <p>
              You chose the position. Choose your funding too.
              <br />A focused toolkit for the cost of staying in the market.
            </p>
          </div>
          <div className="landing-feature-grid">
            <article className="landing-feature-card">
              <div className="feature-card-top">
                <SlidersHorizontal size={22} />
                <span>01 / PLAN</span>
              </div>
              <h3>Know your numbers.</h3>
              <p>
                See how changing rates affect your position. Compare a
                fixed-rate hedge against unhedged funding across different
                scenarios.
              </p>
              <div className="feature-mini-chart">
                <div>
                  <span>VARIABLE RATE</span>
                  <Waves size={65} strokeWidth={1} />
                </div>
                <MoveRight size={19} />
                <div>
                  <span>FIXED RATE</span>
                  <span className="mini-fixed">
                    0.02<span>%</span>
                  </span>
                </div>
              </div>
              <Link href="/simulator">
                Simulate your hedge <ArrowUpRight size={16} />
              </Link>
            </article>
            <article className="landing-feature-card">
              <div className="feature-card-top">
                <ChartNoAxesCombined size={22} />
                <span>02 / CONNECT</span>
              </div>
              <h3>Find your other side.</h3>
              <p>
                Explore a peer-to-peer marketplace. Set your notional and fixed
                rate, then find a counterparty with a different view.
              </p>
              <div className="feature-order">
                <div>
                  <span className="order-avatar">L</span>
                  <div>
                    <strong>Long hedger</strong>
                    <span>Seeking a fixed cost</span>
                  </div>
                </div>
                <span className="order-connector">↔</span>
                <div>
                  <span className="order-avatar order-avatar-mint">T</span>
                  <div>
                    <strong>Risk taker</strong>
                    <span>Taking the other side</span>
                  </div>
                </div>
              </div>
              <Link href="/marketplace">
                Browse offers <ArrowUpRight size={16} />
              </Link>
            </article>
            <article className="landing-feature-card">
              <div className="feature-card-top">
                <ShieldCheck size={22} />
                <span>03 / SETTLE</span>
              </div>
              <h3>Clear from the start.</h3>
              <p>
                Defined rate bounds. Collateral from both sides. A transparent
                contract lifecycle you can follow on Solana.
              </p>
              <div className="feature-settlement">
                <span>
                  <span className="settlement-dot" />
                  Collateral posted
                </span>
                <span>
                  <span className="settlement-dot" />
                  Funding observed
                </span>
                <span>
                  <LockKeyhole size={13} />
                  Difference settled
                </span>
              </div>
              <Link href="/contract-flow">
                Try an example <ArrowUpRight size={16} />
              </Link>
            </article>
          </div>
        </section>

        <section id="how-it-works" className="landing-process">
          <div className="landing-section landing-process-inner">
            <div className="process-intro">
              <span className="landing-eyebrow">
                <span />
                FROM VARIABLE TO FIXED
              </span>
              <h2>
                A calmer way
                <br />
                to stay in.
              </h2>
              <p>
                Your exchange handles the trade.
                <br />
                FundingLock handles the funding difference.
              </p>
              <Link href="/protocol" className="landing-dark-button">
                Get to know the protocol <ArrowUpRight size={16} />
              </Link>
              <div className="process-footnote">
                <LockKeyhole size={14} />
                <span>No exchange API keys. No position transfers.</span>
              </div>
            </div>
            <div className="process-steps">
              {[
                {
                  title: "Set your terms.",
                  text: "Choose your position size and a fixed funding rate. Preview the costs in the simulator before you commit.",
                },
                {
                  title: "Match and collateralize.",
                  text: "Create or accept an offer. Both sides deposit the collateral required by the contract’s rate bounds.",
                },
                {
                  title: "Let the difference settle.",
                  text: "Observed funding is compared with your fixed rate. The contract settles the difference between counterparties.",
                },
              ].map((step, i) => (
                <article key={step.title}>
                  <span className="process-step-number">0{i + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-faq">
          <div>
            <span className="landing-eyebrow">
              <span />A LITTLE MORE CLARITY
            </span>
            <h2>
              Good questions.
              <br />
              <span>Clear answers.</span>
            </h2>
            <p>Get familiar before you get started.</p>
            <Link href="/protocol" className="landing-text-link">
              Read the protocol guide <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="faq-items">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <ChevronDown size={17} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="landing-final-cta">
          <div className="landing-status">
            <span />
            LESS GUESSWORK. MORE CONVICTION.
          </div>
          <h2>
            Keep your edge.
            <br />
            <span>Lock your funding.</span>
          </h2>
          <Link href="/simulator" className="landing-button">
            Find your fixed rate <ArrowUpRight size={17} />
          </Link>
          <p>Start with a simulation. No wallet required.</p>
        </section>
      </main>
      <footer className="landing-footer">
        <div>
          <Brand />
          <p>Make funding predictable.</p>
        </div>
        <nav aria-label="Footer navigation">
          {appLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="landing-footer-bottom">
          <span>© 2026 FundingLock</span>
          <span>
            <i />
            Solana Testnet · Built for exploration
          </span>
          <span>Variable markets. Fixed perspective.</span>
        </div>
      </footer>
    </div>
  );
}
