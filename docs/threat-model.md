# FundingLock Threat Model and Risk Mitigations

## 1. Asset & Counterparty Risks

| Risk | Description | Mitigation in Protocol |
|---|---|---|
| **Undercollateralization** | Realized rates spike beyond collateral pool. | Collateral sized from theoretical worst-case rate bounds `[min_rate, max_rate]` + safety buffer. |
| **Premature Withdrawal** | Participant pulls collateral before contract expiry. | Collateral held in PDA-owned vault; program enforces lock until finalization. |
| **Price Risk Confusion** | Trader believes hedge protects against SOL price drop. | Prominent UI disclosure that protocol hedges **funding-rate risk only**, not underlying spot price. |
| **Oracle Manipulation** | Authorized key submits malicious or erroneous rates. | Single-publisher assumption documented for MVP. On-chain rate bounds cap extreme values. Pausable authority. |
| **Missing Observation Freeze** | Oracle misses an interval. | Missing intervals block finalization rather than treating rate as zero. Protocol halts safely. |
| **Double Settlement** | Attempting to finalize a settled contract twice. | Strict state transitions enforce finalization occurs only from `Settling` into `Settled`. |

## 2. MVP Non-Goals & Limitations

- **Not Mainnet Ready:** Tested on testnet/devnet only.
- **Single Publisher:** Decentralized consensus planned for post-MVP.
- **Fixed Notional:** If the trader adjusts perpetual position size on the venue, the hedge ratio diverges.

