/**
 * FundingLock Domain Types & Configuration
 *
 * Implements strict type definitions for perpetual funding hedge marketplace,
 * rate conventions, contract terms, oracle observations, and settlement records.
 */

export type PositionSide = 'long' | 'short';

export type VenueId = 'BINANCE_PERP';

export type ContractStatus =
  | 'Open'
  | 'Matched'
  | 'Funded'
  | 'Active'
  | 'Settling'
  | 'Settled'
  | 'Cancelled'
  | 'Paused'
  | 'Defaulted';

export interface MarketVenueConfig {
  venueId: VenueId;
  venueName: string;
  marketSymbol: string; // e.g. "SOL-PERP"
  intervalSeconds: number; // 28800 (8 hours)
  intervalsPerDay: number; // 3
  rateScale: number; // 1,000,000 (PPM) for integer rates (0.01% = 100)
  minRatePpm: number; // -5000 (-0.50% per interval)
  maxRatePpm: number; // +5000 (+0.50% per interval)
  maxDurationDays: number; // 30
  maxNotionalCents: number; // $1,000,000.00 (100,000,000 cents)
  safetyBufferBps: number; // 500 (5% safety buffer for collateral)
  timeConvention: 'start_inclusive_end_exclusive';
}

export const BINANCE_SOL_CONFIG: MarketVenueConfig = {
  venueId: 'BINANCE_PERP',
  venueName: 'Binance Perpetual (SOLUSDT)',
  marketSymbol: 'SOL-PERP',
  intervalSeconds: 28800, // 8 hours
  intervalsPerDay: 3,
  rateScale: 1_000_000, // 1e6 Parts Per Million
  minRatePpm: -5000, // -0.50%
  maxRatePpm: 5000, // +0.50%
  maxDurationDays: 30,
  maxNotionalCents: 100_000_000, // $1,000,000.00
  safetyBufferBps: 500, // 5%
  timeConvention: 'start_inclusive_end_exclusive',
};

export interface FundingObservation {
  venueId: VenueId;
  marketSymbol: string;
  intervalIndex: number;
  startTime: number; // Unix timestamp in seconds
  endTime: number; // Unix timestamp in seconds
  ratePpm: number; // Integer parts-per-million (e.g. 1000 = +0.10%)
  rateDecimal: number; // Float representation e.g. 0.0010
  timestamp: number; // Timestamp observation was generated/signed
  sequenceNumber: number;
  publisherPubkey?: string;
}

export interface ContractTerms {
  contractId: string;
  marketSymbol: string;
  venueId: VenueId;
  positionSide: PositionSide;
  notionalCents: number; // In cents ($10,000 = 1,000,000)
  fixedRatePpm: number; // In PPM (0.02% = 200)
  intervalCount: number; // e.g. 21
  intervalSeconds: number; // 28800
  startTime: number; // Unix timestamp in seconds
  endTime: number; // Unix timestamp in seconds
  minRatePpm: number;
  maxRatePpm: number;
  collateralMint: string;
  buyerPubkey?: string;
  riskTakerPubkey?: string;
  status?: ContractStatus;
}

export interface IntervalSettlementRecord {
  intervalIndex: number;
  startTime: number;
  endTime: number;
  realizedRatePpm: number;
  realizedRateDecimal: number;
  actualFundingCostCents: number;
  fixedFundingCostCents: number;
  intervalSettlementCents: number;
  cumulativeSettlementCents: number;
  status: 'pending' | 'recorded' | 'missing' | 'disputed';
}

export interface SettlementExplanation {
  terms: ContractTerms;
  directionSign: number; // +1 for long, -1 for short
  intervalCount: number;
  records: IntervalSettlementRecord[];
  totalActualFundingCostCents: number;
  totalFixedFundingCostCents: number;
  totalSettlementCents: number; // Positive = risk taker pays buyer; negative = buyer pays risk taker
  netFundingCostCents: number; // totalActualFundingCost - totalSettlement
  bestIntervalIndex: number;
  worstIntervalIndex: number;
  isFullyCollateralized: boolean;
  requiredCollateralBuyerCents: number;
  requiredCollateralRiskTakerCents: number;
  payoutCapCents: number;
  missingObservationsCount: number;
  defaultShortfallCents?: number;
}

