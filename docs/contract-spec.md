# FundingLock Contract Specification

**Program ID:** `HSMBzbTfQQgLKk9Bv7d9WkLiK1yvKCs9FkeGgBhgfZj9`  
**Network:** Solana Testnet / Devnet  
**Collateral Asset:** Native SOL (testnet) / SPL USDC

## 1. Account Architecture

- **`MarketConfig` PDA:** `[b"market_config", market_symbol]`
- **`ContractAccount` PDA:** `[b"contract", contract_id]`
- **`Vault` PDA:** `[b"vault", contract_account_pubkey]`
- **`ObservationRecord` PDA:** `[b"observation", contract_account_pubkey, &interval_index]`

## 2. Direction-Aware Funding & Settlement Model

Under the signed-rate convention:
```text
s = +1 for long-position hedge
s = -1 for short-position hedge
```

For each interval `i`:
```text
actual_funding_cost_i = s × notional × realized_rate_i
fixed_funding_cost_i  = s × notional × fixed_rate
interval_settlement_i = s × notional × (realized_rate_i - fixed_rate)
total_settlement      = sum(interval_settlement_i)
net_funding_cost      = actual_funding_cost - total_settlement = fixed_funding_cost
```

## 3. Collateral Sizing from Rate Bounds

Collateral is determined from the **maximum possible payout** under the configured rate bounds `[min_rate, max_rate]`, **not** from historical average rates:

```text
max_buyer_payout  = sum(max(0, settlement_i(min_rate), settlement_i(max_rate)))
max_buyer_payment = sum(max(0, -settlement_i(min_rate), -settlement_i(max_rate)))
```

With safety buffer (e.g. 5%):
- Risk taker required deposit = `max_buyer_payout × 1.05`
- Protection buyer required deposit = `max_buyer_payment × 1.05`

This guarantees 100% solvency for all valid oracle observations within configured bounds.

## 4. Lifecycle State Machine

```text
Open → Matched → Funded → Active → Settling → Settled
  ↘ Cancelled
```

- **Open:** Buyer created offer, deposited optional collateral.
- **Matched:** Risk taker accepted offer.
- **Funded:** Both parties deposited required collateral.
- **Active:** Contract activated; terms are immutable.
- **Settling:** Oracle begins recording interval observations (accounting updates only).
- **Settled:** All intervals recorded. Single net settlement payout transferred from vault; remaining collateral returned.

