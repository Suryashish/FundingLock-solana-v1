# FundingLock Product and Implementation Plan

**Project:** FundingLock
**Document status:** Detailed build plan
**Planning baseline:** October 24, 2026
**Current repository state:** A starter Next.js website exists in `website/`. There is not yet a Solana program, backend, oracle service, database, or funding-rate dataset.

## 1. Product summary

FundingLock is a funding-rate hedge marketplace for perpetual-futures traders.

A trader who already has a SOL perpetual position can use FundingLock to agree on a fixed funding rate for a specific time period. Another participant accepts the opposite side of the agreement. At each funding interval, the contract compares the agreed fixed rate with the realized funding rate and records the difference as a payment between the two participants.

FundingLock does **not** open, close, or manage the trader's perpetual position. The trader still pays or receives funding on the exchange where the perp position exists. FundingLock is a separate collateralized contract intended to offset changes in that funding cost.

### Simple explanation

FundingLock is like buying a price guarantee for a recurring bill:

- The protection buyer wants predictable funding costs.
- The risk taker accepts changing funding rates in exchange for possible profit.
- FundingLock records the agreement, holds collateral, receives funding-rate observations, calculates the difference, and pays the correct participant.

The first version should be a safe, understandable testnet prototype rather than a production derivatives protocol.

## 2. Goals and non-goals

### Goals for the hackathon MVP

1. Explain the funding-rate problem clearly to a new user.
2. Show historical SOL perpetual funding rates and how volatile they can be.
3. Let a user simulate a fixed-rate hedge before connecting a wallet.
4. Let two test users create, accept, collateralize, and settle a simple contract.
5. Use a Solana program to store contract terms and collateral state.
6. Use a clearly identified funding-rate publisher for testnet settlement.
7. Demonstrate a week-long replay with a comparison of:
   - funding cost without FundingLock;
   - funding cost with FundingLock;
   - settlement paid by or received from FundingLock;
   - resulting net funding cost.
8. Make failure cases visible instead of hiding them, including missing data and insufficient collateral.

### Explicit non-goals for the first release

- No real-money mainnet trading.
- No attempt to replace a perpetual-futures exchange.
- No automatic opening or closing of perp positions.
- No leverage engine, liquidation engine, or margin engine for the underlying perp.
- No anonymous or permissionless oracle network in the first demo.
- No claim that FundingLock is a completely new financial primitive.
- No guarantee that a hedge removes SOL price risk; it only addresses funding-rate risk.
- No unlimited settlement promises. Payouts must be limited by explicit collateral and rate bounds.

## 3. Users and user stories

### User A: Funding protection buyer

This user expects to hold a long or short perpetual position and wants more predictable funding expenses.

User stories:

- As a trader, I can choose a market, notional amount, duration, and fixed rate.
- As a trader, I can preview the expected fixed funding cost.
- As a trader, I can see historical funding scenarios before accepting a hedge.
- As a trader, I can connect a Solana wallet and create or accept a contract.
- As a trader, I can see exactly how each settlement amount was calculated.
- As a trader, I can withdraw my remaining collateral after settlement.

### User B: Funding-rate risk taker

This user is willing to accept uncertain funding outcomes because they believe the fixed rate is attractive or wants exposure to funding-rate movements.

User stories:

- As a risk taker, I can browse compatible open offers.
- As a risk taker, I can see the maximum possible payout, collateral requirement, and oracle rules before accepting.
- As a risk taker, I can deposit collateral and monitor the contract.
- As a risk taker, I can see whether I owe money or receive money at settlement.

### Demo observer or judge

- As an observer, I can understand the product without knowing DeFi terminology.
- As an observer, I can replay a week of funding and verify the arithmetic.
- As an observer, I can see the on-chain transaction and contract state.

## 4. Product rules and terminology

### Core terms

- **Market:** The perp market being hedged, initially `SOL-PERP`.
- **Notional:** The dollar value of the underlying perp position, for example `$10,000`.
- **Funding interval:** One period used to compare rates, initially 8 hours.
- **Fixed rate:** The rate agreed by both parties for one funding interval.
- **Realized rate:** The funding rate published for one market and interval.
- **Protection buyer:** The participant receiving compensation when realized funding is worse than the fixed rate.
- **Risk taker:** The participant paying compensation in that case and receiving compensation when realized funding is better than the fixed rate.
- **Collateral:** Tokens deposited into the program to support possible settlement obligations.
- **Oracle publisher:** The authorized source that submits the funding-rate observation used by the contract.

### Rate convention

The MVP must use one signed convention everywhere:

- Positive funding means a long generally pays and a short generally receives.
- Negative funding means a long generally receives and a short generally pays.
- Rates are stored as signed fixed-point integers, not floating-point numbers.
- The UI may display percentages, but calculations use integer basis points or a documented higher-precision scale.

The displayed wording must always identify whether a number is:

- a rate per funding interval;
- a total rate across all intervals; or
- a dollar settlement amount.

### Settlement formula

For a simple fixed-notional contract, the settlement amount for interval `i` is:

```text
interval_settlement_i = notional × (realized_rate_i - fixed_rate)
```

The total amount owed to the protection buyer is:

```text
total_settlement = sum(interval_settlement_i)
```

Interpretation:

- If `total_settlement > 0`, the risk taker pays the protection buyer.
- If `total_settlement < 0`, the protection buyer pays the risk taker.
- The actual perp funding paid at the exchange is separate from this calculation.
- The hedge is intended to make the combined funding result approximate the agreed fixed rate, subject to fees, collateral limits, rounding, oracle rules, and default risk.

Example for the demo:

- Notional: `$10,000`
- Fixed rate: `0.02%` per 8 hours
- Duration: 7 days
- Intervals: `21`
- Realized rate: `0.10%` for every interval
- Actual funding paid by the long: `$210`
- FundingLock settlement: `$168` to the protection buyer
- Net funding cost: `$42`

The simulator must calculate this from the individual interval data rather than hard-code the example.

## 5. Current repository baseline

The repository currently contains:

- `website/app/page.tsx` — the default starter page;
- `website/app/layout.tsx` — the default metadata and layout;
- `website/app/globals.css` — a minimal Tailwind CSS setup;
- `website/package.json` — Next.js `16.4.2`, React `19.3.0`, TypeScript, Tailwind, and ESLint;
- `website/README.md` — the default Next.js setup instructions;
- `website/AGENTS.md` — repository guidance requiring the local Next.js documentation to be read before changing Next.js code.

There is currently no on-chain program or shared domain model. The implementation should therefore begin with a small, testable domain model shared by the simulator, UI, and future Solana client instead of building screens around duplicated formulas.

## 6. Proposed technical architecture

### 6.1 Repository structure after the MVP

The exact folders can be adjusted to the selected Solana toolchain, but the target separation should be:

```text
/
├── plan.md
├── website/                         # Next.js web application
│   ├── app/
│   │   ├── page.tsx                 # Product landing page and demo entry point
│   │   ├── dashboard/               # Historical data and active contracts
│   │   ├── create/                  # Create hedge flow
│   │   ├── marketplace/             # Open offers and matching
│   │   ├── contracts/[id]/          # Contract detail and settlement history
│   │   └── api/                     # Only if a server route is needed for the demo
│   ├── components/
│   ├── lib/
│   │   ├── funding.ts               # Pure funding and settlement calculations
│   │   ├── validation.ts
│   │   ├── demo-data.ts
│   │   └── solana-client.ts
│   └── public/
├── programs/
│   └── funding-lock/                # Solana/Anchor program, if Anchor is selected
├── tests/
│   ├── funding-calculations/        # Deterministic unit tests
│   ├── program/                     # On-chain instruction tests
│   └── e2e/                         # User-flow tests where practical
├── packages/
│   └── fundinglock-types/           # Shared schemas and serialized domain types
├── scripts/
│   ├── seed-funding-data.*
│   └── replay-settlement.*
└── docs/
    ├── oracle-spec.md
    ├── contract-spec.md
    └── threat-model.md
```

Do not create all of these directories at once. Add them when the corresponding slice is implemented.

### 6.2 Web application

Keep the existing Next.js application and build the first experience as a responsive dashboard. The first UI should be useful without a wallet so judges can understand and test the product immediately.

Recommended UI responsibilities:

- render product education and risk disclosures;
- validate user inputs;
- call pure calculation functions for previews;
- show demo data and historical charts;
- request wallet signatures only when a user chooses an on-chain action;
- display transaction status and links to the selected Solana explorer;
- never claim a contract is funded or settled until the chain state confirms it.

### 6.3 Domain and calculation layer

Create a framework-independent calculation module before building complex UI components. It should expose functions similar to:

```text
calculateIntervals(start, end, intervalLength)
calculateFundingCost(notional, fundingRates)
calculateFixedCost(notional, fixedRate, intervalCount)
calculateSettlement(notional, fixedRate, realizedRates)
calculateCollateralRequirement(contractTerms)
buildCashFlowComparison(contractTerms, realizedRates)
```

Requirements:

- use integer arithmetic and explicit precision;
- reject invalid rates, dates, notional values, and interval counts;
- keep rounding rules in one place;
- return an explanation object containing the inputs, per-interval calculations, totals, and rounding adjustments;
- make the module runnable in unit tests without a browser, wallet, network, or database.

### 6.4 Solana program

The program should be a narrow escrow and settlement program, not a complete derivatives engine.

#### Suggested accounts

- **GlobalConfig PDA:** program authority, supported market identifiers, collateral mint, oracle authority, pause flag, and version.
- **MarketConfig PDA:** market symbol, funding interval, precision, minimum and maximum accepted rates, and active/inactive status.
- **Contract PDA:** immutable terms and mutable lifecycle state.
- **Contract vault token account:** collateral controlled by the program.
- **Oracle observation PDA:** one observation for each contract and funding interval, or a market-period observation referenced by multiple contracts.
- **Participant token accounts:** user-owned collateral accounts used for deposits and withdrawals.

#### Contract fields

At minimum, record:

- contract identifier;
- market identifier;
- protection buyer and risk-taker public keys;
- notional amount;
- fixed rate;
- start and end timestamps;
- funding interval length;
- expected interval count;
- collateral mint;
- maximum and minimum settlement rates;
- required collateral for each side;
- oracle configuration/version;
- current lifecycle state;
- number of submitted observations;
- accumulated signed settlement;
- final settlement amount;
- creation and activation slots/timestamps;
- program version.

#### Suggested lifecycle

```text
Draft/Open → Matched → Funded → Active → Settling → Settled
                    ↘ Cancelled
Active/Settling → Defaulted or Paused
```

The state transitions must be enforced by the program. The UI must derive its labels from the on-chain state rather than maintaining its own independent status.

#### Suggested instructions

1. `initialize_config`
2. `initialize_market`
3. `create_offer`
4. `accept_offer`
5. `deposit_collateral`
6. `activate_contract`
7. `publish_funding_observation`
8. `settle_interval` or `record_interval`
9. `finalize_contract`
10. `withdraw_collateral`
11. `cancel_unmatched_offer`
12. `pause_market` / `unpause_market` for the configured authority

The first demo may combine some instructions if doing so makes the program easier to audit and explain, but each authorization and state transition must remain explicit.

### 6.5 Oracle and funding data

Solana cannot discover an external exchange's funding rate by itself. The MVP must make this dependency visible.

#### MVP oracle approach

- Use one authorized publisher key on a Solana test network.
- Generate observations from a checked-in historical fixture or a deterministic replay script.
- Include the market, venue identifier, interval start, interval end, signed rate, timestamp, sequence number, and publisher signature in each observation.
- Allow only one valid observation per market and interval.
- Reject observations outside the contract's allowed time window.
- Reject duplicate or out-of-order sequence numbers.
- Reject rates outside the configured safety bounds.
- Halt final settlement when a required observation is missing rather than silently treating it as zero.

#### Later oracle upgrade

Before mainnet use, define and implement a stronger design, such as multiple independent publishers, a medianized data service, a recognized oracle integration, or an explicit dispute window. The oracle specification must state:

- which venue or venues are used;
- how rates are normalized;
- the exact timestamp convention;
- how missing observations are handled;
- how late observations are handled;
- how corrections and disputes work;
- who can pause settlement;
- how oracle compromise is contained.

### 6.6 Matching mechanism

Do not begin with a complex on-chain order book.

For the hackathon:

1. A user creates an offer with compatible terms.
2. Offers are displayed from local fixtures or a simple server-side store.
3. A second wallet accepts the offer.
4. The final terms are written to the Solana contract.
5. Both parties deposit collateral before activation.

Matching must compare at least:

- market;
- direction/role;
- notional amount or permitted tolerance;
- fixed rate;
- start time;
- duration and interval count;
- collateral mint;
- oracle configuration;
- maximum rate and payout cap.

The UI should explain that matching is currently an offer board or demo matcher, not a deep liquid market.

### 6.7 Collateral and insolvency rules

The protocol must never imply that a signed rate hedge guarantees payment regardless of collateral.

For each contract, calculate:

```text
max_positive_payout = notional × sum(max_rate_i - fixed_rate)
max_negative_payout = notional × sum(fixed_rate - min_rate_i)
```

For a constant-rate MVP, this can be simplified using the interval count. The contract must also define a safety buffer and minimum collateral ratio.

Recommended MVP behavior:

- require the risk taker to deposit enough collateral for the maximum positive payout;
- require the protection buyer to deposit enough collateral for the maximum negative payout;
- keep collateral in a program-controlled token vault;
- prevent activation if either side is underfunded;
- cap every submitted rate and every aggregate payout;
- if a payout exceeds available collateral due to a bug or an explicitly simulated default, mark the contract `Defaulted`, pay according to the documented priority/pro-rata rule, and expose the shortfall;
- never allow the UI to display an unpaid amount as if it were fully paid.

For the demo, the default rule can be simple and deterministic. It must be clearly labeled as a prototype rule, not a complete production credit model.

## 7. User experience plan

### Screen 1: Landing page

Purpose: explain the problem in less than one minute.

Content:

- headline: “Make perpetual funding costs more predictable”;
- simple diagram: perp position → changing funding → FundingLock hedge;
- short explanation of the two sides;
- example showing `$10,000`, `0.02% fixed`, `21 intervals`, and `$42` target funding cost;
- prominent “Try the simulator” action;
- clear “testnet/demo only” and “not investment advice” notice.

### Screen 2: Historical funding dashboard

Features:

- market selector, initially only SOL-PERP;
- date range selector;
- line/bar chart of funding rates;
- positive/negative color treatment;
- summary statistics: average, minimum, maximum, volatility proxy, and number of observations;
- “simulate this period” action;
- source, venue, timezone, and interval labels.

### Screen 3: Hedge simulator

Inputs:

- market;
- position side: long or short;
- notional amount;
- fixed funding rate;
- start date and duration;
- selected historical period or generated scenario.

Outputs:

- funding cost without the hedge;
- target fixed cost;
- FundingLock settlement;
- net cost after settlement;
- best and worst interval;
- table of every interval's realized rate, actual funding, settlement, and cumulative result;
- scenario buttons for stable, high funding, negative funding, spike, and missing data.

The simulator is the main fallback demo if wallets, testnet RPC, or the oracle publisher are unavailable.

### Screen 4: Create or browse an offer

Show:

- the selected terms;
- estimated collateral on each side;
- maximum possible payout;
- rate bounds;
- oracle and venue rules;
- expiry time for an unmatched offer;
- fees, if any are later added;
- a plain-language risk summary.

### Screen 5: Contract detail

Show:

- contract address and explorer link;
- both participant wallet addresses, shortened;
- lifecycle state;
- fixed terms;
- collateral deposited by each side;
- observation progress;
- per-interval settlement ledger;
- current accumulated amount;
- actions allowed for the connected wallet;
- warnings for missing data, paused state, or collateral shortfall.

### Screen 6: Demo replay and final results

Provide a guided “play week” flow:

1. Create two demo wallets or use two test wallets.
2. Agree on the fixed rate.
3. Deposit test collateral.
4. Publish one funding observation at a time.
5. Show the settlement ledger updating.
6. Finalize the contract.
7. Compare the two cash-flow paths with a clear visual summary.

## 8. Implementation phases

### Phase 0 — Product and protocol specification

Deliverables:

- this plan refined into a short contract specification;
- signed-rate convention;
- precision and rounding rules;
- state machine;
- collateral and payout bounds;
- oracle input schema;
- explicit list of testnet-only assumptions.

Exit criteria:

- two developers can calculate the same example result independently;
- every contract state has an allowed transition and an owner;
- missing oracle data and under-collateralization have documented outcomes.

### Phase 1 — Domain model and deterministic simulator

Deliverables:

- typed contract and funding observation models;
- pure settlement functions;
- historical fixture format;
- scenario generator;
- unit tests for normal, negative, spiking, zero, rounding, and missing-data cases.

Exit criteria:

- the `$10,000 / 0.02% / 21 intervals` example returns `$42` net target cost;
- changing one interval changes the result by exactly the expected integer amount;
- no calculation depends on browser state or floating-point arithmetic.

### Phase 2 — Frontend education and simulator

Deliverables:

- branded FundingLock landing page;
- funding dashboard;
- simulator form and results table;
- responsive layout;
- loading, empty, invalid-input, and error states;
- risk and testnet disclaimers.

Exit criteria:

- a new user can complete a simulation without connecting a wallet;
- the page explains that the perp position and FundingLock contract are separate;
- the UI matches the shared calculation module.

### Phase 3 — Wallet and Solana client foundation

Deliverables:

- wallet adapter integration suitable for the selected Solana test network;
- network indicator and wrong-network guidance;
- transaction helper with confirmation and error handling;
- typed client methods for each program instruction;
- explorer links.

Exit criteria:

- a user can connect and disconnect a test wallet;
- failed, rejected, and pending transactions are distinguishable;
- no transaction is presented as successful before confirmation.

### Phase 4 — Minimal Solana escrow program

Deliverables:

- config and market accounts;
- contract creation and acceptance;
- collateral deposits;
- activation checks;
- vault accounting;
- cancellation of unmatched contracts;
- withdrawal rules.

Exit criteria:

- program tests cover authorized and unauthorized callers;
- terms cannot change after activation;
- users cannot withdraw collateral needed for an active obligation;
- token amounts and account ownership are checked by the program.

### Phase 5 — Oracle publisher and settlement

Deliverables:

- deterministic funding observation fixture;
- publisher script or service;
- observation account validation;
- one-observation-per-interval rule;
- interval settlement instruction;
- finalization and payout instruction;
- missing-data and paused-contract behavior.

Exit criteria:

- the complete week replay can be run from a clean test environment;
- the on-chain accumulated settlement matches the off-chain simulator;
- duplicate, late, out-of-range, and unauthorized observations are rejected.

### Phase 6 — Marketplace and end-to-end demo

Deliverables:

- open offers view;
- create and accept offer flows;
- contract detail page;
- collateral status;
- guided replay mode;
- transaction and explorer links;
- seeded demo data for reliable presentation.

Exit criteria:

- two wallets can complete the happy path from offer to withdrawal;
- the demo can be reset and repeated;
- the app remains understandable when chain actions fail.

### Phase 7 — Hardening, testing, and presentation

Deliverables:

- threat model;
- program and UI test report;
- stress scenarios;
- performance and RPC failure handling;
- demo script;
- limitations and future-work page;
- deployment instructions for the website and testnet program.

Exit criteria:

- all required checks pass;
- known limitations are visible in the repository and demo;
- the presentation shows both successful settlement and at least one failure scenario.

## 9. Testing strategy

### Calculation tests

Test at minimum:

- positive funding greater than fixed rate;
- positive funding lower than fixed rate;
- negative funding;
- exactly equal funding and fixed rate;
- zero notional;
- invalid negative notional;
- invalid or extreme rates;
- one interval and many intervals;
- partial final periods rejected or handled according to the specification;
- integer rounding at every boundary;
- missing observations;
- duplicate observations;
- rate spikes at the configured cap;
- settlement at the collateral limit;
- settlement exceeding collateral.

### Solana program tests

Test:

- account initialization;
- correct PDA derivation;
- participant authorization;
- wrong market or wrong collateral mint;
- underfunded activation;
- immutable terms after activation;
- unauthorized oracle publisher;
- wrong interval or duplicate interval;
- out-of-range rates;
- premature finalization;
- double finalization;
- withdrawal limits;
- pause and unpause behavior;
- default/pro-rata behavior if implemented.

### Frontend tests

Test the user-visible flow:

- simulator produces the documented example;
- invalid input produces a useful message;
- missing data is visible;
- loading and transaction states are distinct;
- wrong network is actionable;
- contract detail matches the returned chain state;
- wallet rejection does not leave the UI in a false success state.

### Manual demo checklist

1. Open the site with no wallet connected.
2. Complete a stable-funding simulation.
3. Complete a funding-spike simulation.
4. Complete a negative-funding simulation.
5. Connect two test wallets.
6. Create and accept an offer.
7. Deposit collateral from both wallets.
8. Publish observations.
9. Finalize and withdraw.
10. Demonstrate missing observation or insufficient collateral handling.

## 10. Security and risk controls

This project handles a financial-style agreement, so the risk model is part of the product rather than a later detail.

### Program safety

- Use checked arithmetic and explicit overflow handling.
- Use integer fixed-point rates; never use floating-point values on-chain.
- Validate all account owners, token mints, vault authorities, and signer roles.
- Make active contract terms immutable.
- Enforce state transitions in the program.
- Prevent double settlement and double withdrawal.
- Bound rates, payout amounts, interval counts, and contract durations.
- Include a pause mechanism with a clearly defined authority.
- Avoid unnecessary upgrade authority in the demo, and document who controls it.
- Emit events for contract creation, funding, oracle observations, settlement, default, and withdrawal.

### Oracle safety

- Identify the venue and source of every observation.
- Make data freshness and interval boundaries explicit.
- Reject unauthorized, duplicate, stale, or out-of-range observations.
- Keep an audit trail of submitted observations.
- Treat a missing value as a defined error state, never as zero.
- Explain that a compromised publisher can produce incorrect settlement data in the MVP.

### Economic safety

- Require collateral before activation.
- Cap the maximum rate and settlement.
- Show maximum loss before acceptance.
- Do not call an under-collateralized agreement “guaranteed.”
- Make fees and rounding visible.
- Explain counterparty/default risk in the UI.

### User and legal safety

- Make it clear that this is a testnet prototype.
- State that FundingLock does not eliminate SOL price risk.
- State that historical simulations do not predict future rates.
- Avoid marketing language that promises profit or guaranteed protection.
- Before any mainnet or public financial launch, obtain appropriate legal and compliance review.

## 11. Operational and observability plan

The demo should be diagnosable when a transaction or oracle update fails.

Record or display:

- selected network and RPC endpoint label;
- contract address;
- transaction signature;
- instruction name;
- confirmation status;
- oracle observation sequence;
- last accepted observation timestamp;
- expected versus received interval count;
- collateral deposited and remaining;
- accumulated settlement;
- program errors translated into user-readable messages.

Use structured logs in scripts and keep private keys, wallet secrets, and RPC credentials out of the repository.

## 12. Definition of done for the hackathon demo

The MVP is complete when all of the following are true:

- A visitor understands the problem and product without prior DeFi knowledge.
- The historical dashboard shows a real or clearly labeled fixture dataset.
- The simulator calculates the documented example correctly.
- Two test users can agree on terms and deposit collateral.
- The program stores the contract and vault state on Solana testnet.
- An authorized publisher can submit the required funding observations.
- The program or verified client calculates and settles the difference.
- Both sides can see the full settlement ledger and final result.
- The app handles missing data, rejected transactions, wrong network, and under-collateralization visibly.
- The demo does not claim that FundingLock protects against SOL price movement.
- The repository has repeatable setup, test, lint, build, and demo instructions.

## 13. Suggested development order for the current repository

Implement in this order to reduce rework:

1. Read the local Next.js guidance in `website/AGENTS.md` and the relevant installed Next.js documentation before editing the app.
2. Replace the starter page with the FundingLock landing page and a simple static simulator shell.
3. Add the pure funding calculation module and tests before connecting UI inputs to it.
4. Add deterministic fixture data and the historical dashboard.
5. Decide and document the Solana toolchain, test network, collateral mint, wallet adapter, and program account schema.
6. Build and test the escrow program independently from the website.
7. Add the typed Solana client to the website.
8. Add wallet connection, offer creation, acceptance, and collateral flows.
9. Add the authorized oracle publisher and interval settlement.
10. Add the guided two-wallet replay and failure demonstrations.
11. Run the complete check suite and prepare the demo script.

Do not begin with live external funding-rate ingestion or a complex marketplace. The simulator and deterministic fixture path should remain available even when external services are unavailable.

## 14. Proposed checks and commands

The existing website package currently exposes:

```bash
pnpm dev
pnpm lint
pnpm build
```

Run website commands from `website/`.

As the project grows, add explicit scripts rather than relying on undocumented commands, for example:

```bash
pnpm test
pnpm test:unit
pnpm test:e2e
pnpm typecheck
pnpm program:test
pnpm oracle:replay
```

The exact Solana commands depend on the selected program framework and should be added only after that toolchain is chosen and installed. A check is only considered complete when it has actually run successfully in a clean or documented environment.

## 15. Decisions to make before implementation reaches testnet

These choices affect the contract and should be written down before program development:

1. Which venue or index defines the SOL funding rate?
2. Is the first rate convention based on a long payer, a short payer, or a neutral signed index?
3. Which collateral token is used on testnet?
4. Is the fixed rate quoted per 8 hours, per day, or another interval?
5. Are start and end timestamps inclusive or exclusive?
6. What happens when a funding observation is late or missing?
7. What are the maximum rate, duration, notional, and payout limits?
8. How much collateral must each party post?
9. Who can pause the market or change the oracle authority?
10. What is the default rule if collateral cannot cover the calculated amount?
11. Are fees charged, and who receives them?
12. Which testnet and wallet adapter will be supported first?
13. Will matching use local fixtures, a server-side store, or an on-chain offer board?
14. Which parts are intentionally demo-only and must not be used with real funds?

## 16. Final product promise

The honest promise of the first FundingLock release is:

> FundingLock helps a perpetual trader model and, in a collateralized testnet contract, offset changes in funding rates. It does not guarantee payment, remove counterparty risk, or protect the value of the underlying SOL position.

That promise is narrow enough to build, test, and demonstrate credibly. Once the MVP works, deeper liquidity, better oracle decentralization, dynamic collateral, additional markets, and production-grade legal and security review can be evaluated separately.
