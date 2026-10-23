# FundingLock Product and Implementation Plan

**Project:** FundingLock
**Document status:** Detailed build plan
**Planning baseline:** October 24, 2026
**Current repository state:** A starter Next.js website exists in `website/`. There is not yet a Solana program, backend, oracle service, database, or funding-rate dataset.

## 1. Product summary

FundingLock is a funding-rate hedge marketplace for perpetual-futures traders.

A trader who already has a SOL perpetual position can use FundingLock to agree on a fixed funding rate for a specific time period. Another participant accepts the opposite side of the agreement. At each funding interval, the contract compares the agreed fixed rate with the realized funding rate and records the signed difference. In the MVP, collateral is not transferred until the contract is finalized at maturity, when the accumulated intervals are settled as one net payment.

FundingLock does **not** open, close, or manage the trader's perpetual position. The trader still pays or receives funding on the exchange where the perp position exists. FundingLock is a separate collateralized contract intended to offset changes in that funding cost.

### Simple explanation

FundingLock is like buying a price guarantee for a recurring bill:

- The protection buyer wants predictable funding costs.
- The risk taker accepts changing funding rates in exchange for possible profit.
- FundingLock records the agreement, holds collateral, receives funding-rate observations, calculates each interval's difference, and pays the correct participant once at finalization.

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

### Hard MVP boundary

The first implementation must prove one complete, reproducible lifecycle rather than attempting to launch a full marketplace:

- one selected perpetuals venue;
- one market, planned as SOL-PERP;
- one funding-rate source and one documented normalization convention;
- one supported testnet collateral token;
- fixed notional for the full contract duration;
- short, fixed contract duration for the demo;
- long and short support in the simulator;
- long-position hedges only in the initial on-chain contract;
- one authorized testnet publisher;
- simple offer creation and acceptance, not an order book or sophisticated matching engine.

The simulator and deterministic replay must remain usable without a wallet, Solana RPC, or live data service. This gives the team a demonstrable first milestone and prevents external integrations from hiding errors in the funding economics.

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

- **Market:** The single perp market being hedged in the MVP, initially planned as `SOL-PERP` after one venue is selected.
- **Venue:** The specific perpetuals exchange or index whose funding observations are used. The venue must be selected before implementation of the funding dataset or on-chain contract.
- **Notional:** The dollar value of the underlying perp position, for example `$10,000`.
- **Position side:** The side of the underlying perp position being hedged: `long` or `short`.
- **Funding interval:** The interval defined by the selected venue. It is stored in the market configuration and must not be hardcoded as 8 hours throughout the application.
- **Fixed rate:** The rate agreed by both parties for one funding interval.
- **Realized rate:** The funding rate published for one market and interval.
- **Protection buyer:** The participant receiving compensation when realized funding is worse for their selected position side than the fixed rate would have been.
- **Risk taker:** The participant paying compensation in that case and receiving compensation when realized funding is better than the fixed rate.
- **Collateral:** Tokens deposited into the program to support possible settlement obligations.
- **Oracle publisher:** The authorized source that submits the funding-rate observation used by the contract.

### Rate convention

The MVP must use one signed convention everywhere:

- Positive funding generally means a long pays and a short receives; negative funding generally reverses those cash flows.
- Rates are stored as signed fixed-point integers, not floating-point numbers.
- The UI may display percentages, but calculations use integer basis points or a documented higher-precision scale.
- The funding observation must include the venue's interval boundaries and timestamp semantics.

The displayed wording must always identify whether a number is:

- a rate per funding interval;
- a total rate across all intervals; or
- a dollar settlement amount.

### Direction-aware funding and settlement formula

The simulator must support both long and short positions. Define a direction sign:

```text
s = +1 for a long-position hedge
s = -1 for a short-position hedge
```

Under the signed-rate convention, the underlying position's funding cost for interval `i` is:

```text
actual_funding_cost_i = s × notional × realized_rate_i
```

Positive cost means the position pays funding; negative cost means it receives funding. The fixed target cost for that interval is:

```text
fixed_funding_cost_i = s × notional × fixed_rate
```

For a simple fixed-notional contract, the settlement amount **to the protection buyer** for interval `i` is:

```text
interval_settlement_i = s × notional × (realized_rate_i - fixed_rate)
```

The total settlement owed to the protection buyer is:

```text
total_settlement = sum(interval_settlement_i)
```

Interpretation:

- If `total_settlement > 0`, the risk taker pays the protection buyer.
- If `total_settlement < 0`, the protection buyer pays the risk taker.
- The actual perp funding paid or received at the venue is separate from this contract settlement.
- `actual_funding_cost - total_settlement` should approximate the fixed funding cost, subject to fees, collateral limits, rounding, oracle rules, and default risk.
- The hedge assumes the notional remains fixed. If the trader changes the underlying position size, the hedge no longer perfectly matches the trader's actual funding exposure.

### Settlement timing and payment model

For the MVP, settlement has two separate steps:

1. **Record:** After each valid funding observation, the program calculates that interval's signed settlement and adds it to the contract's accumulated net settlement. This updates accounting only; it does not transfer tokens.
2. **Pay:** After every required interval has been recorded and the contract reaches maturity, the program finalizes the contract and transfers the single net accumulated amount to the entitled participant.

Both parties' collateral remains locked until finalization, subject to the documented unmatched-offer cancellation, pause, missing-observation, and default rules. The MVP does not make token transfers after every interval and does not pay both sides separately at maturity. It nets all interval results into one final payment.

At finalization:

- if the accumulated net settlement is positive, the program pays the protection buyer from the risk taker's locked collateral and returns each party's remaining collateral to its owner;
- if the accumulated net settlement is negative, the program pays the risk taker from the protection buyer's locked collateral and returns each party's remaining collateral to its owner;
- if the accumulated amount is zero, the program returns both collateral balances without a settlement transfer;
- the program never transfers more than the available vault balance and records any unpaid shortfall under the documented default rule.

For the MVP, an unmatched offer may be cancelled and its deposited collateral returned before activation. A paused contract cannot record new observations or finalize until the configured authority resolves the pause. A missing observation blocks finalization rather than being treated as zero.

Example for the demo:

- Notional: `$10,000`
- Position side: `long`
- Fixed rate: `0.02%` per funding interval
- Duration: 7 days
- Intervals: `21` only if the selected venue produces 21 intervals in that duration
- Realized rate: `0.10%` for every interval
- Actual funding paid by the long: `$210`
- FundingLock settlement: `$168` to the protection buyer
- Net funding cost: `$42`

The `$210 / $168 / $42` figures are an illustrative example using an 8-hour interval. The implementation must derive the interval count and timestamps from the selected venue instead of assuming that every venue uses 8-hour funding. The simulator must calculate the result from individual observations rather than hard-code the example.

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

Keep the current Next.js project in `website/`. Do not create a separate backend or every planned directory immediately. Add each folder only when its corresponding slice is implemented. The target separation is:

```text
/
├── plan.md
├── website/                         # Next.js web application and shared TypeScript domain code
│   ├── app/
│   │   ├── page.tsx                 # Product landing page and demo entry point
│   │   ├── dashboard/page.tsx       # Historical data and active contracts
│   │   ├── simulator/page.tsx       # Wallet-free funding simulator
│   │   ├── marketplace/page.tsx     # Simple open offers view
│   │   ├── contracts/[id]/          # Contract detail and settlement history
│   │   └── api/                     # Only for server-side data endpoints if needed
│   ├── components/
│   │   ├── funding-chart.tsx
│   │   ├── hedge-form.tsx
│   │   ├── settlement-table.tsx
│   │   └── wallet-connect.tsx
│   ├── lib/
│   │   ├── domain/
│   │   │   ├── funding.ts           # Pure direction-aware funding calculations
│   │   │   ├── collateral.ts
│   │   │   └── validation.ts
│   │   ├── data/
│   │   │   └── fixtures.ts          # One venue's normalized historical fixtures
│   │   └── solana/
│   │       └── client.ts
│   └── tests/
│       ├── funding.test.ts
│       └── collateral.test.ts
├── programs/
│   └── funding-lock/                # Solana program, preferably Anchor if selected
├── scripts/
│   └── funding-publisher.ts          # Testnet-only publisher; never run in the browser
├── docs/
│   ├── oracle-spec.md
│   ├── contract-spec.md
│   └── threat-model.md
└── tests/                            # Program and end-to-end tests when needed
```

If shared types later need to be consumed by both the website and program tooling, extract them into a package only then. A separate database and backend are not required for the first simulator or the deterministic demo.

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

Because this is a Next.js App Router application, keep pages as Server Components by default. Use Client Components only for interactive charts, simulator inputs, wallet interactions, and other browser-only behavior. Read `website/AGENTS.md` and the local installed Next.js guidance before changing the starter app.

### 6.3 Domain and calculation layer

Create a framework-independent calculation module before building complex UI components. It should expose functions similar to:

```text
calculateIntervals(start, end, intervalLength)
calculateFundingCost(notional, positionSide, fundingRates)
calculateFixedCost(notional, positionSide, fixedRate, intervalCount)
calculateSettlement(notional, positionSide, fixedRate, realizedRates)
calculateCollateralRequirement(contractTerms)
buildCashFlowComparison(contractTerms, realizedRates)
```

Requirements:

- use integer arithmetic and explicit precision;
- accept `long` and `short` positions in the simulator;
- use a direction sign in the settlement calculation rather than duplicating long and short formulas;
- reject invalid rates, dates, notional values, and interval counts;
- derive interval boundaries from the selected venue configuration;
- keep rounding rules in one place;
- return an explanation object containing the inputs, per-interval calculations, totals, and rounding adjustments;
- make the module runnable in unit tests without a browser, wallet, network, or database.

### 6.4 Data service

The data layer should start with normalized fixtures and only grow into a server-side endpoint if the UI needs persistence or scheduled updates.

Responsibilities:

- ingest or load one selected venue's historical funding observations;
- normalize the venue's raw rate, timestamps, market identifier, and interval boundaries into the shared schema;
- preserve the original source metadata and normalization version;
- reject observations that are missing required fields or fall outside configured bounds;
- serve the same normalized observations to the dashboard, simulator, replay script, and publisher;
- keep the deterministic fixture path available when the external source is unavailable.

Do not add a database or separate backend before the simulator or simple offer flow needs server-side persistence. If an API is later needed, keep it read-only for historical data in the first version and keep publisher signing operations outside Next.js and outside the browser.

### 6.5 Solana program

The program should be a narrow escrow and settlement program, not a complete derivatives engine.

#### Suggested accounts

- **GlobalConfig PDA:** program authority, supported market identifiers, collateral mint, oracle authority, pause flag, and version.
- **MarketConfig PDA:** one selected venue and market, venue identifier, funding interval, timestamp convention, precision, minimum and maximum accepted rates, maximum duration, maximum notional, and active/inactive status.
- **Contract PDA:** immutable terms and mutable lifecycle state.
- **Contract vault token account:** collateral controlled by the program.
- **Oracle observation PDA:** one observation for each contract and funding interval, or a market-period observation referenced by multiple contracts.
- **Participant token accounts:** user-owned collateral accounts used for deposits and withdrawals.

#### Contract fields

At minimum, record:

- contract identifier;
- market identifier;
- venue identifier and oracle configuration version;
- protection buyer and risk-taker public keys;
- position side, initially restricted to `long` on-chain while the simulator supports both sides;
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
Open → Matched → Funded → Active → Settling → Settled
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
7. `record_funding_observation`
8. `record_interval_settlement`
9. `finalize_contract`
10. `withdraw_collateral`
11. `cancel_unmatched_offer`
12. `pause_market` / `unpause_market` for the configured authority

`record_funding_observation` and `record_interval_settlement` update on-chain accounting only. They must not transfer collateral. `finalize_contract` is the only normal instruction that transfers the net settlement and releases remaining collateral after all required intervals are recorded. The first on-chain contract should support one market, one collateral mint, fixed notional, a short fixed duration, and long-position hedges only. The account schema may include a position-side enum so short hedges can be added after the direction-aware simulator and tests are proven. The first demo may combine observation recording and interval accounting if doing so makes the program easier to audit and explain, but each authorization and state transition must remain explicit.

### 6.6 Oracle and funding data

Solana cannot discover an external exchange's funding rate by itself. The MVP must make this dependency visible.

#### MVP oracle approach

- Use one authorized publisher key on a Solana test network. The publisher signing key must remain in the separate script/service and must never be exposed through the browser bundle.
- Generate observations from verified historical observations for the selected venue, or from clearly labeled deterministic fixtures for the testnet demo. Never present invented fixture values as real historical data.
- Include the market, venue identifier, interval start, interval end, signed rate, timestamp, and sequence number in each observation.
- Normalize the selected venue's raw data before publishing it, with the normalization rule documented and versioned.
- The publisher submits observations in transactions signed by the authorized publisher key. The program authenticates the publisher through the transaction signer; the MVP does not add a second application-level signature-verification scheme or support relayers.
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

The MVP explicitly trusts one authorized publisher. This is a centralized testnet assumption, not a decentralized oracle design.

### 6.7 Matching mechanism

Do not begin with a complex on-chain order book.

For the hackathon:

1. A user creates an offer with compatible terms.
2. Offers are displayed from local fixtures or a simple server-side store.
3. A second wallet accepts the offer.
4. The final terms are written to the Solana contract.
5. Both parties deposit collateral before activation.

Matching must compare at least:

- market;
- venue and funding interval configuration;
- direction/role;
- notional amount or permitted tolerance;
- fixed rate;
- start time;
- duration and interval count;
- collateral mint;
- oracle configuration;
- maximum rate and payout cap.

The UI should explain that matching is currently an offer board or demo matcher, not a deep liquid market.

### 6.8 Collateral and insolvency rules

The protocol must never imply that a signed rate hedge guarantees payment regardless of collateral.

For each contract, calculate the maximum amount that either participant could owe under the contract's permitted rate bounds, not from the expected or historical average rate.

For each interval `i`, define:

```text
settlement_i(rate) = direction_sign × notional × (rate - fixed_rate)
```

Then calculate:

```text
max_buyer_payout = sum(max(0, settlement_i(min_rate_i), settlement_i(max_rate_i)))
max_buyer_payment = sum(max(0, -settlement_i(min_rate_i), -settlement_i(max_rate_i)))
```

These maximums are calculated across **all permitted intervals** and the configured minimum and maximum rate bounds. Every interval uses the same signed-rate convention and the same direction-aware formula. For a constant-rate MVP, the calculation can be simplified using the interval count. The exact rate bounds, maximum duration, maximum notional, payout cap, safety buffer, and minimum collateral ratio must be stored in the market configuration or contract terms.

Recommended MVP behavior:

- require the risk taker to deposit at least `max_buyer_payout` plus the configured safety buffer;
- require the protection buyer to deposit at least `max_buyer_payment` plus the configured safety buffer;
- keep collateral in a program-controlled token vault;
- prevent activation if either side is underfunded;
- cap every submitted rate and every aggregate payout;
- record each interval's settlement without transferring collateral;
- at maturity, transfer only the net accumulated amount that the program can actually pay from the locked vault;
- with correct bounds, activation should make the permitted net settlement fully collateralized; if a payout nevertheless exceeds available collateral because of a program error or explicitly simulated default, mark the contract `Defaulted`, pay only according to the documented priority/pro-rata rule, and expose the shortfall;
- never allow the UI to display an unpaid amount as if it were fully paid.

For the demo, the default rule can be simple and deterministic, such as distributing available collateral to the entitled party and recording the unpaid remainder. It must be clearly labeled as a prototype rule, not a complete production credit model.

## 7. User experience plan

### Screen 1: Landing page

Purpose: explain the problem in less than one minute.

Content:

- headline: “Make perpetual funding costs more predictable”;
- simple diagram: perp position → changing funding → FundingLock hedge;
- short explanation of the two sides;
- illustrative example showing `$10,000`, `0.02% fixed`, the selected venue's interval count, and the target funding cost;
- prominent “Try the simulator” action;
- clear “testnet/demo only” and “not investment advice” notice.

### Screen 2: Historical funding dashboard

Features:

- market label, initially only SOL-PERP;
- selected venue and funding interval label;
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

The simulator supports both long and short positions. It must show the selected venue's actual interval length and must not silently assume 8-hour funding.

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

The implementation is intentionally limited to six phases. Each phase produces something demonstrable and independently testable. The Solana program is not started until the direction-aware funding engine, venue convention, and collateral rules are verified.

### Phase 1 — Funding engine and simulator

Start here. This is the first milestone and does not require a wallet, Solana RPC, or live market data, but it has one blocking prerequisite: **select the perpetuals venue before implementing the funding engine**.

Record the selected venue identifier, market symbol, interval length, interval boundaries, timestamp semantics, rate units, historical-data source, and normalization rule. Do not build a supposedly real historical dashboard from invented values. Use verified historical observations, or use deterministic fixtures that are visibly labeled as simulated/demo data.

Build:

- a pure TypeScript calculation module;
- typed contract and funding-observation models;
- long and short position support in the simulator;
- direction-aware actual funding, fixed funding, settlement, and net cash-flow calculations;
- integer fixed-point arithmetic and centralized rounding rules;
- deterministic test data for stable, negative, and sharply increasing funding;
- collateral and maximum-payout calculations from rate bounds, not expected rates;
- tests for missing observations, duplicate observations, invalid inputs, rounding, and payout limits.

Done when:

- the documented `$10,000 / 0.02% / 21 intervals` long example returns `$42` net target cost when those 21 intervals are valid for the selected venue;
- a short-position scenario produces the opposite settlement sign for the same realized and fixed rates;
- changing one interval changes the result by exactly the expected integer amount;
- the selected venue's interval is read from configuration rather than hardcoded as 8 hours;
- all core calculations pass unit tests with no browser, wallet, network, or database dependency.

### Phase 2 — Next.js product interface

Build the complete wallet-free demo experience in the existing `website/` application.

Deliver:

- FundingLock landing page and plain-language education;
- historical funding dashboard for the one selected venue and market;
- simulator form supporting long and short positions;
- per-interval settlement ledger and cash-flow comparison;
- scenario buttons for stable, high, negative, spike, missing, and invalid data;
- clear venue, interval, timezone, and data-source labels;
- responsive loading, empty, validation, and error states;
- testnet-only and financial-risk disclosures.

Keep the simulator useful if Solana RPC or an external data source is unavailable. Pages should remain Server Components by default; use Client Components only where charts, forms, or browser wallet behavior require them.

Done when: someone unfamiliar with FundingLock can understand the problem and complete a correct simulation in under a minute without connecting a wallet.

### Phase 3 — Minimal Solana program

Build a narrowly scoped escrow and settlement program, preferably using Anchor if that is the selected toolchain.

The first contract supports only:

- one selected venue and one market;
- one supported testnet collateral token;
- fixed notional for the full contract duration;
- a short, fixed duration;
- long-position hedges on-chain;
- one authorized testnet publisher;
- maximum rate, duration, notional, and payout limits.

Implement only the instructions required for this lifecycle:

- initialize market configuration;
- create and accept a hedge;
- deposit collateral;
- activate the contract after both sides meet the maximum-bound collateral requirement;
- record validated funding observations and interval settlements without token transfers;
- finalize the contract with one net settlement transfer and release remaining collateral.

The contract schema should include a position-side enum for future short support, but the initial on-chain instruction must reject `short` until the long-only path is verified.

Done when program tests prove that unauthorized users cannot change contract terms, withdraw locked collateral, submit invalid observations, or settle the same interval twice.

### Phase 4 — Wallet and contract integration

Connect the frontend to the deployed testnet program.

Build:

- wallet connection and network validation;
- wrong-network guidance;
- transaction helpers with pending, rejected, failed, and confirmed states;
- typed Solana client methods for the program instructions;
- simple offer creation and acceptance;
- test collateral deposits;
- contract detail pages that read actual on-chain state;
- transaction signatures and explorer links.

Do not build an on-chain order book, multiple venues, or a complex matching engine. The first marketplace is a simple offer board or deterministic demo offer flow.

Done when two test wallets can create, accept, fund, and inspect the same long-position contract, and the interface never reports an unconfirmed transaction as successful.

### Phase 5 — Funding data publisher and settlement

Build a separate trusted publisher script or service. Its signing key must never be available to the browser.

Build:

- one venue-specific verified historical dataset or clearly labeled deterministic replay input;
- raw-data normalization into the shared observation schema;
- on-chain validation of the authorized transaction signer, market, venue, timestamps, sequence numbers, and rate bounds;
- one-observation-per-interval enforcement;
- interval accounting with no token transfer;
- net settlement and collateral release only at finalization;
- explicit missing-data, late-data, paused-state, and invalid-data behavior;
- an off-chain/on-chain reconciliation command.

Done when a complete seven-day replay produces the same result in the TypeScript calculation engine and on-chain contract, with explicit handling for missing or invalid observations.

### Phase 6 — Final demo and hardening

Build a repeatable end-to-end demonstration rather than production-grade market infrastructure.

Include:

- stable, negative, and spiking funding replays;
- two users agreeing on a long-position hedge;
- collateral deposits and settlement finalization;
- a missing-observation demonstration;
- an insufficient-collateral or shortfall demonstration using the documented prototype rule;
- resettable seeded demo data;
- threat model, limitations, and testnet-only documentation;
- website, program, calculation, and replay check instructions.

Done when the entire demo can be reset and repeated with reproducible results, and the presentation shows both successful settlement and at least one visible failure scenario.

## 9. Testing strategy

### Calculation tests

Test at minimum:

- long position with realized funding greater than fixed rate;
- long position with realized funding lower than fixed rate;
- short position with the same rates and the opposite settlement direction;
- fixed notional maintained across all intervals;
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
- venue-specific interval boundaries and timestamps;
- unsupported or mismatched venue identifiers;
- maximum payout derived from the permitted rate bounds;
- collateral requirement based on maximum possible settlement rather than expected funding;
- rate spikes at the configured cap;
- settlement at the collateral limit;
- settlement exceeding collateral.

### Solana program tests

Test:

- account initialization;
- one-market, one-venue, one-collateral configuration checks;
- correct PDA derivation;
- participant authorization;
- wrong market or wrong collateral mint;
- underfunded activation;
- immutable terms after activation;
- unauthorized oracle publisher;
- wrong interval or duplicate interval;
- out-of-range rates;
- rejected short-position contract while the first on-chain version is long-only;
- interval recording changes accounting without transferring collateral;
- finalization nets all recorded intervals into one settlement transfer;
- finalization returns remaining collateral to both parties;
- finalization cannot transfer more than the vault can pay;
- missing observations block finalization;
- paused contracts block observation recording and finalization;
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
- Keep the notional fixed for the contract duration in the MVP; do not silently net settlement against a changing position size.
- Include a pause mechanism with a clearly defined authority.
- Avoid unnecessary upgrade authority in the demo, and document who controls it.
- Emit events for contract creation, funding, oracle observations, settlement, default, and withdrawal.

### Oracle safety

- Identify the venue and source of every observation.
- Store and validate the venue-specific interval and timestamp convention.
- Make data freshness and interval boundaries explicit.
- Reject unauthorized, duplicate, stale, or out-of-range observations.
- Keep an audit trail of submitted observations.
- Treat a missing value as a defined error state, never as zero.
- Explain that a compromised publisher can produce incorrect settlement data in the MVP.

### Economic safety

- Require collateral before activation.
- Calculate collateral from the maximum permitted settlement under the configured rate bounds, not from an expected or average funding rate.
- Cap the maximum rate, duration, notional, and settlement.
- Keep the publisher signing key outside the browser and outside committed files.
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
- The simulator supports both long and short positions and calculates the documented example correctly.
- The selected venue, interval, timestamps, and normalization convention are visible in the UI.
- Two test users can agree on a long-position hedge and deposit collateral.
- The program stores the contract and vault state on Solana testnet.
- An authorized publisher can submit the required funding observations.
- The program or verified client calculates and settles the difference.
- Both sides can see the full settlement ledger and final result.
- The app handles missing data, rejected transactions, wrong network, and under-collateralization visibly.
- Collateral requirements are based on maximum permitted payout, not expected funding.
- The initial on-chain contract is explicitly limited to one venue, one market, one collateral token, fixed notional, and long hedges.
- The demo does not claim that FundingLock protects against SOL price movement.
- The repository has repeatable setup, test, lint, build, and demo instructions.

## 13. Suggested development order for the current repository

Implement in this order to reduce rework:

1. Read the local Next.js guidance in `website/AGENTS.md` and the relevant installed Next.js documentation before editing the app.
2. Select one venue and document its funding interval, timestamps, rate units, and normalization rules.
3. Build the pure direction-aware funding engine, collateral calculator, deterministic fixtures, and unit tests.
4. Replace the starter page with the FundingLock landing page, historical dashboard, and wallet-free simulator.
5. Choose and document the Solana toolchain, test network, collateral mint, wallet adapter, and long-only contract schema.
6. Build and test the minimal escrow program independently from the website.
7. Add the typed Solana client, wallet connection, simple offer creation/acceptance, and collateral flows.
8. Add the separate authorized funding publisher and interval settlement.
9. Add the guided two-wallet replay, missing-data scenario, and collateral-shortfall scenario.
10. Run the complete check suite and prepare the repeatable demo script.

Do not begin with live multi-venue ingestion, a complex marketplace, short-position on-chain contracts, or a sophisticated oracle network. The simulator and deterministic fixture path should remain available even when external services are unavailable.

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

## 15. MVP decisions and implementation gates

These decisions must be documented before Phase 3 begins. The unresolved venue choice is the first gate because it affects every funding observation, interval calculation, UI label, oracle input, and contract term.

| Decision | MVP recommendation |
| --- | --- |
| Perpetuals venue | Choose one venue with accessible historical funding data and clearly documented conventions. Do not support multiple venues initially. |
| Market | Support one market, planned as SOL-PERP. |
| Funding interval | Match the selected venue's actual interval and timestamp semantics; do not hardcode 8 hours. |
| Rate convention | Store a signed normalized rate and document how the venue's raw value maps to it. |
| Position direction | Support long and short in the simulator; start with long-position hedges on-chain and add short contracts only after the sign model is verified. |
| Collateral | Use one supported testnet token with explicit token-mint validation. |
| Notional | Keep it fixed for the full contract duration. |
| Contract duration | Use a short, fixed duration for the demo. |
| Oracle | Use one authorized publisher with historical replay data, clearly labeled as a prototype. Keep its signing key outside the browser. |
| Matching | Use simple offer creation and acceptance or deterministic demo offers; do not build an order book. |
| Payout limits | Set maximum rates, duration, notional, and aggregate payout. Require collateral for the maximum permitted settlement plus the configured buffer before activation. |
| Missing observations | Pause final settlement until the documented recovery or timeout rule is applied; never treat missing data as zero. |
| Insufficient collateral | Activation should fail when required collateral is missing. If an unexpected shortfall occurs after activation, mark the contract defaulted, distribute available collateral according to the prototype rule, and record the unpaid amount. |
| Time boundaries | Define whether start and end timestamps are inclusive or exclusive and use the same rule off-chain and on-chain. |
| Fees | Omit fees from the first demo unless they are needed to explain a specific cost; if added, show them separately from funding settlement. |
| Testnet and wallet | Select one Solana test network and wallet adapter before integration. |
| Backend | Do not add a database or separate backend until the simulator or simple offer flow requires server-side persistence. |
| Demo-only boundaries | Clearly identify the testnet publisher, fixture data, collateral model, and default behavior as prototype-only. |

## 16. Final product promise

The honest promise of the first FundingLock release is:

> FundingLock helps a perpetual trader model and, in a collateralized testnet contract, offset changes in funding rates. It does not guarantee payment, remove counterparty risk, or protect the value of the underlying SOL position.

That promise is narrow enough to build, test, and demonstrate credibly. Once the MVP works, deeper liquidity, better oracle decentralization, dynamic collateral, additional markets, and production-grade legal and security review can be evaluated separately.
