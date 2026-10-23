/**
 * FundingLock Domain Validation
 *
 * Enforces strict input validation, parameter boundaries, and oracle observation integrity.
 */

import { BINANCE_SOL_CONFIG } from './types.ts';
import type { ContractTerms, FundingObservation, MarketVenueConfig } from './types.ts';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateContractTerms(
  terms: Partial<ContractTerms>,
  config: MarketVenueConfig = BINANCE_SOL_CONFIG
): ValidationResult {
  const errors: string[] = [];

  if (!terms.notionalCents || terms.notionalCents <= 0) {
    errors.push('Notional amount must be greater than $0.00');
  } else if (terms.notionalCents > config.maxNotionalCents) {
    errors.push(`Notional amount exceeds maximum allowed ($${(config.maxNotionalCents / 100).toLocaleString()})`);
  }

  if (terms.fixedRatePpm === undefined || terms.fixedRatePpm === null) {
    errors.push('Fixed funding rate is required');
  } else if (terms.fixedRatePpm < config.minRatePpm || terms.fixedRatePpm > config.maxRatePpm) {
    errors.push(
      `Fixed rate must be between ${(config.minRatePpm / 10_000).toFixed(2)}% and +${(config.maxRatePpm / 10_000).toFixed(2)}% per interval`
    );
  }

  if (!terms.positionSide || (terms.positionSide !== 'long' && terms.positionSide !== 'short')) {
    errors.push("Position side must be 'long' or 'short'");
  }

  if (!terms.intervalCount || terms.intervalCount <= 0) {
    errors.push('Interval count must be at least 1');
  } else {
    const maxIntervals = config.maxDurationDays * config.intervalsPerDay;
    if (terms.intervalCount > maxIntervals) {
      errors.push(`Duration exceeds maximum permitted ${config.maxDurationDays} days (${maxIntervals} intervals)`);
    }
  }

  if (terms.venueId && terms.venueId !== config.venueId) {
    errors.push(`Unsupported venue '${terms.venueId}'. Only '${config.venueId}' is supported in MVP.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateObservation(
  obs: Partial<FundingObservation>,
  expectedIndex: number,
  terms: ContractTerms,
  config: MarketVenueConfig = BINANCE_SOL_CONFIG
): ValidationResult {
  const errors: string[] = [];

  if (obs.intervalIndex !== expectedIndex) {
    errors.push(`Invalid interval sequence: expected index ${expectedIndex}, received ${obs.intervalIndex}`);
  }

  if (obs.marketSymbol && obs.marketSymbol !== terms.marketSymbol) {
    errors.push(`Market symbol mismatch: expected ${terms.marketSymbol}, received ${obs.marketSymbol}`);
  }

  if (obs.venueId && obs.venueId !== terms.venueId) {
    errors.push(`Venue ID mismatch: expected ${terms.venueId}, received ${obs.venueId}`);
  }

  if (obs.ratePpm === undefined || obs.ratePpm === null || isNaN(obs.ratePpm)) {
    errors.push('Observation missing valid rate');
  } else if (obs.ratePpm < config.minRatePpm || obs.ratePpm > config.maxRatePpm) {
    errors.push(`Observation rate ${obs.ratePpm} PPM outside configured safety bounds`);
  }

  const expectedStart = terms.startTime + expectedIndex * terms.intervalSeconds;
  const expectedEnd = expectedStart + terms.intervalSeconds;

  if (obs.startTime !== undefined && obs.startTime !== expectedStart) {
    errors.push(`Start time mismatch for interval ${expectedIndex}`);
  }

  if (obs.endTime !== undefined && obs.endTime !== expectedEnd) {
    errors.push(`End time mismatch for interval ${expectedIndex}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
