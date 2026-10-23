/**
 * FundingLock Pure Calculation Engine
 *
 * Implements direction-aware funding cost, settlement amounts, and cumulative cash flows.
 * Uses integer fixed-point arithmetic (PPM for rates, cents for currency) to eliminate
 * floating point rounding discrepancies between frontend, simulation, and on-chain logic.
 */

import { BINANCE_SOL_CONFIG } from './types.ts';
import type {
  ContractTerms,
  FundingObservation,
  IntervalSettlementRecord,
  MarketVenueConfig,
  PositionSide,
  SettlementExplanation,
} from './types.ts';
import { calculateCollateralRequirement } from './collateral.ts';

export const RATE_SCALE = 1_000_000; // 1e6 Parts Per Million (1% = 10,000 PPM, 0.01% = 100 PPM)

/**
 * Returns direction sign:
 * +1 for long hedge (pays funding when rate > 0)
 * -1 for short hedge (receives funding when rate > 0)
 */
export function getDirectionSign(positionSide: PositionSide): number {
  return positionSide === 'long' ? 1 : -1;
}

/**
 * Convert PPM (e.g. 200 = 0.02%) to decimal (0.0002)
 */
export function ppmToDecimal(ppm: number): number {
  return ppm / RATE_SCALE;
}

/**
 * Convert decimal (0.0002) to PPM (200)
 */
export function decimalToPpm(decimal: number): number {
  return Math.round(decimal * RATE_SCALE);
}

/**
 * Convert cents to USD string with 2 decimal places
 */
export function formatCurrency(cents: number, includeSign = false): string {
  const isNegative = cents < 0;
  const absCents = Math.abs(cents);
  const dollars = (absCents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (cents === 0) return '$0.00';
  if (includeSign) {
    return isNegative ? `-$${dollars}` : `+$${dollars}`;
  }
  return isNegative ? `-$${dollars}` : `$${dollars}`;
}

/**
 * Format PPM rate as human-readable percentage (e.g. 200 -> "+0.0200%")
 */
export function formatRatePercent(ppm: number, includeSign = true): string {
  const pct = (ppm / 10_000).toFixed(4);
  if (ppm > 0 && includeSign) {
    return `+${pct}%`;
  }
  return `${pct}%`;
}

/**
 * Calculate expected interval count and interval boundaries given time window and interval length
 */
export function calculateIntervals(
  startTime: number,
  endTime: number,
  intervalSeconds: number = BINANCE_SOL_CONFIG.intervalSeconds
): { intervalCount: number; intervals: Array<{ index: number; start: number; end: number }> } {
  if (endTime <= startTime) {
    throw new Error('End time must be strictly after start time');
  }
  if (intervalSeconds <= 0) {
    throw new Error('Interval length must be positive');
  }

  const duration = endTime - startTime;
  const intervalCount = Math.floor(duration / intervalSeconds);

  if (intervalCount <= 0) {
    throw new Error('Duration must cover at least one full interval');
  }

  const intervals = [];
  for (let i = 0; i < intervalCount; i++) {
    intervals.push({
      index: i,
      start: startTime + i * intervalSeconds,
      end: startTime + (i + 1) * intervalSeconds,
    });
  }

  return { intervalCount, intervals };
}

/**
 * Direction-aware actual funding cost for an underlying perpetual position for one interval:
 * cost_i = s × notional × realized_rate_i
 *
 * Returned in integer cents (rounded half to even / nearest).
 */
export function calculateFundingCost(
  notionalCents: number,
  positionSide: PositionSide,
  ratePpm: number
): number {
  const s = getDirectionSign(positionSide);
  // (s * notional * ratePpm) / RATE_SCALE
  const rawCents = (s * notionalCents * ratePpm) / RATE_SCALE;
  return Math.round(rawCents);
}

/**
 * Target fixed funding cost for one interval:
 * fixed_cost_i = s × notional × fixed_rate
 */
export function calculateFixedCost(
  notionalCents: number,
  positionSide: PositionSide,
  fixedRatePpm: number,
  intervalCount: number = 1
): number {
  const s = getDirectionSign(positionSide);
  const costPerInterval = Math.round((s * notionalCents * fixedRatePpm) / RATE_SCALE);
  return costPerInterval * intervalCount;
}

/**
 * Direction-aware interval settlement owed TO the protection buyer:
 * interval_settlement_i = s × notional × (realized_rate_i - fixed_rate)
 *
 * If positive: Risk taker pays protection buyer.
 * If negative: Protection buyer pays risk taker.
 */
export function calculateIntervalSettlement(
  notionalCents: number,
  positionSide: PositionSide,
  fixedRatePpm: number,
  realizedRatePpm: number
): number {
  const s = getDirectionSign(positionSide);
  const rateDiffPpm = realizedRatePpm - fixedRatePpm;
  const rawSettlementCents = (s * notionalCents * rateDiffPpm) / RATE_SCALE;
  return Math.round(rawSettlementCents);
}

/**
 * Builds the complete cash flow comparison and per-interval ledger.
 * Matches the exact formula specified in plan.md Section 4:
 *
 * actual_funding_cost_i = s × notional × realized_rate_i
 * fixed_funding_cost_i  = s × notional × fixed_rate
 * interval_settlement_i = s × notional × (realized_rate_i - fixed_rate)
 * total_settlement      = sum(interval_settlement_i)
 * net_funding_cost      = actual_funding_cost - total_settlement
 */
export function buildCashFlowComparison(
  terms: ContractTerms,
  observations: FundingObservation[],
  config: MarketVenueConfig = BINANCE_SOL_CONFIG
): SettlementExplanation {
  const s = getDirectionSign(terms.positionSide);
  const intervalSeconds = terms.intervalSeconds || config.intervalSeconds;
  const intervalCount = terms.intervalCount;

  const records: IntervalSettlementRecord[] = [];
  let totalActualFundingCostCents = 0;
  let totalFixedFundingCostCents = 0;
  let totalSettlementCents = 0;
  let cumulativeSettlementCents = 0;

  let bestIntervalIndex = 0;
  let worstIntervalIndex = 0;
  let maxBuyerDelta = -Infinity;
  let minBuyerDelta = Infinity;
  let missingObservationsCount = 0;

  // Map observations by intervalIndex
  const obsMap = new Map<number, FundingObservation>();
  for (const obs of observations) {
    obsMap.set(obs.intervalIndex, obs);
  }

  for (let i = 0; i < intervalCount; i++) {
    const startTime = terms.startTime + i * intervalSeconds;
    const endTime = startTime + intervalSeconds;
    const obs = obsMap.get(i);

    if (!obs) {
      missingObservationsCount++;
      records.push({
        intervalIndex: i,
        startTime,
        endTime,
        realizedRatePpm: 0,
        realizedRateDecimal: 0,
        actualFundingCostCents: 0,
        fixedFundingCostCents: calculateFixedCost(terms.notionalCents, terms.positionSide, terms.fixedRatePpm, 1),
        intervalSettlementCents: 0,
        cumulativeSettlementCents,
        status: 'missing',
      });
      continue;
    }

    // Rate bounding enforcement
    const clampedRatePpm = Math.max(terms.minRatePpm, Math.min(terms.maxRatePpm, obs.ratePpm));

    const actualCost = calculateFundingCost(terms.notionalCents, terms.positionSide, clampedRatePpm);
    const fixedCost = calculateFixedCost(terms.notionalCents, terms.positionSide, terms.fixedRatePpm, 1);
    const intervalSettlement = calculateIntervalSettlement(
      terms.notionalCents,
      terms.positionSide,
      terms.fixedRatePpm,
      clampedRatePpm
    );

    cumulativeSettlementCents += intervalSettlement;
    totalActualFundingCostCents += actualCost;
    totalFixedFundingCostCents += fixedCost;
    totalSettlementCents += intervalSettlement;

    if (intervalSettlement > maxBuyerDelta) {
      maxBuyerDelta = intervalSettlement;
      bestIntervalIndex = i;
    }
    if (intervalSettlement < minBuyerDelta) {
      minBuyerDelta = intervalSettlement;
      worstIntervalIndex = i;
    }

    records.push({
      intervalIndex: i,
      startTime,
      endTime,
      realizedRatePpm: clampedRatePpm,
      realizedRateDecimal: clampedRatePpm / RATE_SCALE,
      actualFundingCostCents: actualCost,
      fixedFundingCostCents: fixedCost,
      intervalSettlementCents: intervalSettlement,
      cumulativeSettlementCents,
      status: 'recorded',
    });
  }

  const netFundingCostCents = totalActualFundingCostCents - totalSettlementCents;

  const collateralReq = calculateCollateralRequirement(terms, config);

  return {
    terms,
    directionSign: s,
    intervalCount,
    records,
    totalActualFundingCostCents,
    totalFixedFundingCostCents,
    totalSettlementCents,
    netFundingCostCents,
    bestIntervalIndex,
    worstIntervalIndex,
    isFullyCollateralized: true,
    requiredCollateralBuyerCents: collateralReq.buyerCollateralCents,
    requiredCollateralRiskTakerCents: collateralReq.riskTakerCollateralCents,
    payoutCapCents: collateralReq.maxBuyerPayoutCents,
    missingObservationsCount,
  };
}
