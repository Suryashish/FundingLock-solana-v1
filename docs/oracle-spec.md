# FundingLock Oracle Specification

**Version:** 1.0 (MVP)  
**Selected Venue:** Binance Futures (`BINANCE_PERP`)  
**Market:** SOLUSDT Perpetual (`SOL-PERP`)

## 1. Overview and Trust Model

Solana cannot natively inspect off-chain perpetual exchange order books or funding intervals. FundingLock uses an authorized oracle publisher key for the testnet prototype.

> **Warning (MVP Assumption):** The first release uses a single authorized publisher transaction signer. This is a centralized testnet prototype architecture, not a decentralized oracle network. A compromised or offline publisher will delay or skew settlement.

## 2. Venue Normalization

### Venue Metadata
- **Venue Identifier:** `BINANCE_PERP`
- **Interval Duration:** 28,800 seconds (8 hours)
- **Interval Boundaries:** Standard UTC Epochs (00:00:00, 08:00:00, 16:00:00 UTC)
- **Convention:** `[start_inclusive, end_exclusive)`
- **Rate Representation:** Signed Parts-Per-Million (PPM, $10^6$ scale)
  - `+0.0100%` (1 basis point) = `100` PPM
  - `+0.0200%` = `200` PPM
  - `+0.1000%` = `1,000` PPM
  - `-0.0500%` = `-500` PPM

## 3. On-Chain Validation Rules

The Solana contract enforces:
1. **Transaction Signer:** Must match `market_config.oracle_authority`.
2. **Sequential Intervals:** `observation.interval_index == contract.submitted_observations_count`. No skipping or duplicate intervals.
3. **Safety Bounds:** Realized rate must be within `[min_rate_ppm, max_rate_ppm]` (default: `[-5000, +5000]` PPM or `[-0.50%, +0.50%]`).
4. **No Token Transfers:** Observation recording modifies contract accounting only. Collateral transfers occur exclusively at finalization.
5. **Missing Observations:** Any missing observation blocks finalization. Missing intervals are **never** silently treated as zero.

