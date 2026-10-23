/**
 * FundingLock Collateral & Solvency Calculator
 *
 * Implements strict collateral requirements based on maximum possible payout
 * across configured rate bounds ([min_rate, max_rate]), NOT based on historical
 * or expected average rates.
 *
 * Ensures 100% solvency under all valid oracle observations.
 */

import { BINANCE_SOL_CONFIG } from './types.ts';
import type { ContractTerms, MarketVenueConfig } from './types.ts';
import { getDirectionSign, RATE_SCALE } from './funding.ts';

export interface CollateralRequirement {
  maxBuyerPayoutCents: number; // Maximum possible payout from risk taker to buyer
  maxBuyerPaymentCents: number; // Maximum possible payout from buyer to risk taker
  buyerCollateralCents: number; // Buyer deposit including safety buffer
  riskTakerCollateralCents: number; // Risk taker deposit including safety buffer
  safetyBufferCents: {
    buyer: number;
    riskTaker: number;
  };
  totalVaultCollateralCents: number;
  isFullyCovered: boolean;
}

/**
 * Calculates interval settlement at a given rate:
 * settlement_i(rate) = s * notional * (rate - fixed_rate)
 */
function settlementAtRate(
  notionalCents: number,
  s: number,
  fixedRatePpm: number,
  ratePpm: number
): number {
  const diffPpm = ratePpm - fixedRatePpm;
  return Math.round((s * notionalCents * diffPpm) / RATE_SCALE);
}

/**
 * Calculates exact collateral requirements for both parties under rate bounds.
 */
export function calculateCollateralRequirement(
  terms: ContractTerms,
  config: MarketVenueConfig = BINANCE_SOL_CONFIG
): CollateralRequirement {
  const s = getDirectionSign(terms.positionSide);
  const notionalCents = terms.notionalCents;
  const fixedRatePpm = terms.fixedRatePpm;
  const intervalCount = terms.intervalCount;
  const minRatePpm = terms.minRatePpm;
  const maxRatePpm = terms.maxRatePpm;
  const safetyBufferBps = config.safetyBufferBps; // e.g. 500 = 5%

  // Evaluate single interval settlement at boundary extremes
  const settlementAtMin = settlementAtRate(notionalCents, s, fixedRatePpm, minRatePpm);
  const settlementAtMax = settlementAtRate(notionalCents, s, fixedRatePpm, maxRatePpm);

  // Per interval maximums
  const maxIntervalBuyerPayout = Math.max(0, settlementAtMin, settlementAtMax);
  const maxIntervalBuyerPayment = Math.max(0, -settlementAtMin, -settlementAtMax);

  // Across all intervals
  const maxBuyerPayoutCents = maxIntervalBuyerPayout * intervalCount;
  const maxBuyerPaymentCents = maxIntervalBuyerPayment * intervalCount;

  // Add safety buffer (e.g. 5%)
  const bufferMultiplier = 1 + safetyBufferBps / 10_000;
  const riskTakerCollateralCents = Math.ceil(maxBuyerPayoutCents * bufferMultiplier);
  const buyerCollateralCents = Math.ceil(maxBuyerPaymentCents * bufferMultiplier);

  const riskTakerBuffer = riskTakerCollateralCents - maxBuyerPayoutCents;
  const buyerBuffer = buyerCollateralCents - maxBuyerPaymentCents;

  return {
    maxBuyerPayoutCents,
    maxBuyerPaymentCents,
    buyerCollateralCents,
    riskTakerCollateralCents,
    safetyBufferCents: {
      buyer: buyerBuffer,
      riskTaker: riskTakerBuffer,
    },
    totalVaultCollateralCents: buyerCollateralCents + riskTakerCollateralCents,
    isFullyCovered: true,
  };
}

/**
 * Validates if the actual deposited amounts satisfy the contract terms
 */
export function validateCollateralDeposits(
  terms: ContractTerms,
  depositedBuyerCents: number,
  depositedRiskTakerCents: number,
  config: MarketVenueConfig = BINANCE_SOL_CONFIG
): {
  isBuyerSufficient: boolean;
  isRiskTakerSufficient: boolean;
  canActivate: boolean;
  buyerShortfallCents: number;
  riskTakerShortfallCents: number;
} {
  const req = calculateCollateralRequirement(terms, config);

  const buyerShortfallCents = Math.max(0, req.buyerCollateralCents - depositedBuyerCents);
  const riskTakerShortfallCents = Math.max(0, req.riskTakerCollateralCents - depositedRiskTakerCents);

  const isBuyerSufficient = buyerShortfallCents === 0;
  const isRiskTakerSufficient = riskTakerShortfallCents === 0;

  return {
    isBuyerSufficient,
    isRiskTakerSufficient,
    canActivate: isBuyerSufficient && isRiskTakerSufficient,
    buyerShortfallCents,
    riskTakerShortfallCents,
  };
}
