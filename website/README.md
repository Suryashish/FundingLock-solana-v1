# FundingLock — Web Application Frontend

This directory contains the Next.js frontend and shared TypeScript domain logic for **FundingLock**, an on-chain funding-rate hedge marketplace built on Solana.

- **Main Repository README:** [../README.md](../README.md)
- **Live Deployed Application:** [https://funding-lock-solana-v1.vercel.app/](https://funding-lock-solana-v1.vercel.app/)
- **GitHub Repository:** [https://github.com/Suryashish/FundingLock-solana-v1](https://github.com/Suryashish/FundingLock-solana-v1)
- **Program ID (Solana Testnet):** `HSMBzbTfQQgLKk9Bv7d9WkLiK1yvKCs9FkeGgBhgfZj9`

---

## Workspace Routes

- `/` — Landing page with live visual demonstration of fixed vs floating funding
- `/simulator` — Wallet-free funding rate calculator and cumulative cost visualizer
- `/marketplace` — Peer-to-peer funding offer creation, matching, and collateral deposits
- `/contract-flow` — Step-by-step Solana Testnet lifecycle replay & transaction debugger
- `/rates` — 30-day historical SOL-PERP funding rate analytics and volatility metrics
- `/protocol` — Protocol specification, threat model, and technical FAQs

---

## Development Setup

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
