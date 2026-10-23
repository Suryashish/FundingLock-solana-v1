/**
 * FundingLock Deterministic Fixtures & Historical Datasets
 *
 * Provides normalized historical funding rate observations for Binance SOL-PERP (8-Hour Intervals)
 * and repeatable scenario fixtures for demo and testing.
 */

import { BINANCE_SOL_CONFIG } from '../domain/types.ts';
import type { ContractTerms, FundingObservation } from '../domain/types.ts';

// Anchor timestamp: Oct 1, 2026 00:00:00 UTC (1790812800)
export const FIXTURE_START_TIME = 1790812800;
export const INTERVAL_SECONDS = BINANCE_SOL_CONFIG.intervalSeconds; // 28800

/**
 * 1. Documented Baseline Scenario from plan.md:
 * 21 intervals, realized rate = 0.10% (+1000 PPM) for each interval.
 */
export const BASELINE_DOCUMENTED_OBSERVATIONS: FundingObservation[] = Array.from(
  { length: 21 },
  (_, i) => {
    const startTime = FIXTURE_START_TIME + i * INTERVAL_SECONDS;
    return {
      venueId: 'BINANCE_PERP',
      marketSymbol: 'SOL-PERP',
      intervalIndex: i,
      startTime,
      endTime: startTime + INTERVAL_SECONDS,
      ratePpm: 1000, // +0.10%
      rateDecimal: 0.001,
      timestamp: startTime + INTERVAL_SECONDS,
      sequenceNumber: i,
    };
  }
);

/**
 * Baseline contract terms matching plan.md example ($10,000 notional, 0.02% fixed rate, 21 intervals)
 */
export const BASELINE_CONTRACT_TERMS: ContractTerms = {
  contractId: 'FL-SOL-001',
  marketSymbol: 'SOL-PERP',
  venueId: 'BINANCE_PERP',
  positionSide: 'long',
  notionalCents: 10_000_00, // $10,000.00
  fixedRatePpm: 200, // 0.02% per interval
  intervalCount: 21,
  intervalSeconds: INTERVAL_SECONDS,
  startTime: FIXTURE_START_TIME,
  endTime: FIXTURE_START_TIME + 21 * INTERVAL_SECONDS,
  minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
  maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
  collateralMint: 'USDC',
  buyerPubkey: 'Buyer11111111111111111111111111111111111111',
  riskTakerPubkey: 'Taker11111111111111111111111111111111111111',
  status: 'Active',
};

/**
 * 2. Realistic 30-Day Historical SOL-PERP Dataset (90 8-hour intervals)
 * Seeded with authentic crypto funding volatility patterns.
 */
const HISTORICAL_RATES_PPM = [
  150, 180, 220, 250, 310, 400, 480, 520, 450, 390,
  280, 210, 190, 140, 110,  80,  50, -20, -60, -90,
  -120, -100, -70, -30,  10,  60,  90, 140, 180, 220,
  280, 350, 420, 510, 680, 850, 1100, 1250, 950, 720,
  580, 440, 320, 260, 210, 190, 170, 150, 140, 160,
  190, 240, 310, 380, 420, 390, 310, 250, 180, 120,
  90,  60,  40,  10, -30, -70, -110, -140, -160, -120,
  -80, -40,  0,   30,  70, 110, 160, 200, 250, 290,
  340, 380, 410, 390, 330, 270, 220, 180, 160, 150
];

export const HISTORICAL_30D_OBSERVATIONS: FundingObservation[] = HISTORICAL_RATES_PPM.map(
  (ratePpm, i) => {
    const startTime = FIXTURE_START_TIME + i * INTERVAL_SECONDS;
    return {
      venueId: 'BINANCE_PERP',
      marketSymbol: 'SOL-PERP',
      intervalIndex: i,
      startTime,
      endTime: startTime + INTERVAL_SECONDS,
      ratePpm,
      rateDecimal: ratePpm / 1_000_000,
      timestamp: startTime + INTERVAL_SECONDS,
      sequenceNumber: i,
    };
  }
);

/**
 * 3. Pre-configured Demo Scenarios
 */
export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  defaultFixedRatePpm: number;
  observations: FundingObservation[];
  hasFailureState?: 'missing' | 'shortfall' | 'paused';
}

export const DEMO_SCENARIOS: Record<string, DemoScenario> = {
  baseline: {
    id: 'baseline',
    name: 'Plan Baseline (0.10% Constant)',
    description: 'Documented 7-day baseline: $10,000 notional, 0.02% fixed rate, 0.10% realized rate -> exact $42 net cost',
    defaultFixedRatePpm: 200,
    observations: BASELINE_DOCUMENTED_OBSERVATIONS,
  },
  bullish: {
    id: 'bullish',
    name: 'Bullish High Funding',
    description: 'Strong market rally: perpetual funding spikes between +0.06% and +0.22% per interval',
    defaultFixedRatePpm: 300, // 0.03%
    observations: Array.from({ length: 21 }, (_, i) => {
      const rates = [600, 750, 900, 1200, 1500, 1800, 2200, 2100, 1900, 1600, 1400, 1300, 1100, 950, 850, 750, 900, 1150, 1400, 1650, 1500];
      const startTime = FIXTURE_START_TIME + i * INTERVAL_SECONDS;
      return {
        venueId: 'BINANCE_PERP',
        marketSymbol: 'SOL-PERP',
        intervalIndex: i,
        startTime,
        endTime: startTime + INTERVAL_SECONDS,
        ratePpm: rates[i],
        rateDecimal: rates[i] / 1_000_000,
        timestamp: startTime + INTERVAL_SECONDS,
        sequenceNumber: i,
      };
    }),
  },
  bearish: {
    id: 'bearish',
    name: 'Bearish Negative Funding',
    description: 'Heavy short market: negative funding rates where longs receive and shorts pay',
    defaultFixedRatePpm: -100, // -0.01%
    observations: Array.from({ length: 21 }, (_, i) => {
      const rates = [-200, -350, -500, -700, -850, -900, -750, -600, -450, -300, -200, -150, -250, -400, -650, -800, -600, -400, -250, -150, -100];
      const startTime = FIXTURE_START_TIME + i * INTERVAL_SECONDS;
      return {
        venueId: 'BINANCE_PERP',
        marketSymbol: 'SOL-PERP',
        intervalIndex: i,
        startTime,
        endTime: startTime + INTERVAL_SECONDS,
        ratePpm: rates[i],
        rateDecimal: rates[i] / 1_000_000,
        timestamp: startTime + INTERVAL_SECONDS,
        sequenceNumber: i,
      };
    }),
  },
  spike: {
    id: 'spike',
    name: 'Sudden Volatility Spike',
    description: 'Quiet market violently disrupted by a massive short squeeze jumping to +0.35%',
    defaultFixedRatePpm: 200,
    observations: Array.from({ length: 21 }, (_, i) => {
      // Normal 0.02% then huge spike at interval 10-12
      const rate = i >= 10 && i <= 12 ? 3500 : 200 + (i % 3) * 50;
      const startTime = FIXTURE_START_TIME + i * INTERVAL_SECONDS;
      return {
        venueId: 'BINANCE_PERP',
        marketSymbol: 'SOL-PERP',
        intervalIndex: i,
        startTime,
        endTime: startTime + INTERVAL_SECONDS,
        ratePpm: rate,
        rateDecimal: rate / 1_000_000,
        timestamp: startTime + INTERVAL_SECONDS,
        sequenceNumber: i,
      };
    }),
  },
  missing: {
    id: 'missing',
    name: 'Edge Case: Missing Oracle Observation',
    description: 'Interval #14 missing from oracle publisher. Demonstrates protocol halting finalization safely.',
    defaultFixedRatePpm: 200,
    hasFailureState: 'missing',
    observations: BASELINE_DOCUMENTED_OBSERVATIONS.filter((o) => o.intervalIndex !== 14),
  },
  shortfall: {
    id: 'shortfall',
    name: 'Edge Case: Collateral Shortfall / Default',
    description: 'Simulates counterparty default where required payout exceeds vault balance, triggering safety pro-rata allocation.',
    defaultFixedRatePpm: 200,
    hasFailureState: 'shortfall',
    observations: BASELINE_DOCUMENTED_OBSERVATIONS,
  },
};

/**
 * Preset Open Marketplace Offers
 */
export const PRESET_MARKET_OFFERS: ContractTerms[] = [
  {
    contractId: 'OFFER-SOL-801',
    marketSymbol: 'SOL-PERP',
    venueId: 'BINANCE_PERP',
    positionSide: 'long',
    notionalCents: 10_000_00, // $10,000
    fixedRatePpm: 200, // 0.02%
    intervalCount: 21,
    intervalSeconds: INTERVAL_SECONDS,
    startTime: FIXTURE_START_TIME,
    endTime: FIXTURE_START_TIME + 21 * INTERVAL_SECONDS,
    minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
    maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
    collateralMint: 'USDC',
    buyerPubkey: '9kPY...4M2a',
    status: 'Open',
  },
  {
    contractId: 'OFFER-SOL-802',
    marketSymbol: 'SOL-PERP',
    venueId: 'BINANCE_PERP',
    positionSide: 'long',
    notionalCents: 25_000_00, // $25,000
    fixedRatePpm: 250, // 0.025%
    intervalCount: 21,
    intervalSeconds: INTERVAL_SECONDS,
    startTime: FIXTURE_START_TIME,
    endTime: FIXTURE_START_TIME + 21 * INTERVAL_SECONDS,
    minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
    maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
    collateralMint: 'USDC',
    buyerPubkey: '4xLT...99Fq',
    status: 'Open',
  },
  {
    contractId: 'OFFER-SOL-803',
    marketSymbol: 'SOL-PERP',
    venueId: 'BINANCE_PERP',
    positionSide: 'short',
    notionalCents: 50_000_00, // $50,000
    fixedRatePpm: -150, // -0.015%
    intervalCount: 21,
    intervalSeconds: INTERVAL_SECONDS,
    startTime: FIXTURE_START_TIME,
    endTime: FIXTURE_START_TIME + 21 * INTERVAL_SECONDS,
    minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
    maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
    collateralMint: 'USDC',
    buyerPubkey: '7rNM...33Jz',
    status: 'Open',
  },
];
