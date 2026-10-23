/**
 * Funding Engine Unit Tests
 *
 * Verifies direction-aware funding arithmetic, exact integer rounding,
 * long & short parity, interval derivations, and edge cases.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateFundingCost,
  calculateFixedCost,
  calculateIntervalSettlement,
  buildCashFlowComparison,
  calculateIntervals,
  getDirectionSign,
  ppmToDecimal,
  decimalToPpm,
} from '../lib/domain/funding.ts';
import {
  BASELINE_CONTRACT_TERMS,
  BASELINE_DOCUMENTED_OBSERVATIONS,
  FIXTURE_START_TIME,
  INTERVAL_SECONDS,
} from '../lib/data/fixtures.ts';
import type { ContractTerms } from '../lib/domain/types.ts';

describe('Funding Domain Calculations', () => {
  it('correctly maps direction sign for long and short', () => {
    assert.strictEqual(getDirectionSign('long'), 1);
    assert.strictEqual(getDirectionSign('short'), -1);
  });

  it('correctly converts between decimal and PPM', () => {
    assert.strictEqual(ppmToDecimal(200), 0.0002);
    assert.strictEqual(ppmToDecimal(1000), 0.001);
    assert.strictEqual(decimalToPpm(0.0002), 200);
    assert.strictEqual(decimalToPpm(0.001), 1000);
  });

  it('correctly calculates interval boundaries', () => {
    const start = FIXTURE_START_TIME;
    const end = FIXTURE_START_TIME + 21 * INTERVAL_SECONDS;
    const { intervalCount, intervals } = calculateIntervals(start, end, INTERVAL_SECONDS);

    assert.strictEqual(intervalCount, 21);
    assert.strictEqual(intervals.length, 21);
    assert.strictEqual(intervals[0].start, start);
    assert.strictEqual(intervals[0].end, start + INTERVAL_SECONDS);
    assert.strictEqual(intervals[20].end, end);
  });

  it('matches documented plan.md baseline example: $10,000 notional, 0.02% fixed, 0.10% realized, 21 intervals', () => {
    // $10,000 notional = 1,000,000 cents
    // Fixed rate: 0.02% = 200 PPM
    // Realized rate: 0.10% = 1000 PPM
    // 21 intervals
    const notionalCents = 1_000_000;
    const fixedRatePpm = 200;
    const realizedRatePpm = 1000;

    // 1. Single interval unhedged funding cost:
    // s * notional * realized_rate = 1 * 10,000 * 0.0010 = $10.00 = 1000 cents
    const singleActual = calculateFundingCost(notionalCents, 'long', realizedRatePpm);
    assert.strictEqual(singleActual, 1000); // $10.00

    // Across 21 intervals = $210.00 = 21,000 cents
    const totalActual = singleActual * 21;
    assert.strictEqual(totalActual, 21_000);

    // 2. Single interval fixed cost:
    // s * notional * fixed_rate = 1 * 10,000 * 0.0002 = $2.00 = 200 cents
    const singleFixed = calculateFixedCost(notionalCents, 'long', fixedRatePpm, 1);
    assert.strictEqual(singleFixed, 200); // $2.00

    // Across 21 intervals = $42.00 = 4,200 cents
    const totalFixed = calculateFixedCost(notionalCents, 'long', fixedRatePpm, 21);
    assert.strictEqual(totalFixed, 4200);

    // 3. Interval settlement to buyer:
    // s * notional * (realized - fixed) = 1 * 10,000 * 0.0008 = $8.00 = 800 cents
    const singleSettlement = calculateIntervalSettlement(notionalCents, 'long', fixedRatePpm, realizedRatePpm);
    assert.strictEqual(singleSettlement, 800); // $8.00

    // Total settlement across 21 intervals = 21 * 800 = 16,800 cents = $168.00
    const totalSettlement = singleSettlement * 21;
    assert.strictEqual(totalSettlement, 16_800);

    // 4. Net cost = Actual funding - Settlement = $210 - $168 = $42.00!
    const netCost = totalActual - totalSettlement;
    assert.strictEqual(netCost, 4200); // Exactly $42.00!

    // Verify via buildCashFlowComparison
    const explanation = buildCashFlowComparison(BASELINE_CONTRACT_TERMS, BASELINE_DOCUMENTED_OBSERVATIONS);
    assert.strictEqual(explanation.totalActualFundingCostCents, 21_000); // $210.00
    assert.strictEqual(explanation.totalSettlementCents, 16_800); // $168.00
    assert.strictEqual(explanation.totalFixedFundingCostCents, 4200); // $42.00
    assert.strictEqual(explanation.netFundingCostCents, 4200); // $42.00
  });

  it('guarantees short-position symmetry with opposite sign cash flows', () => {
    const notionalCents = 1_000_000;
    const fixedRatePpm = 200; // +0.02%
    const realizedRatePpm = 1000; // +0.10%

    // For short position (s = -1):
    // Short position receives positive funding from long traders on the venue
    const actualCost = calculateFundingCost(notionalCents, 'short', realizedRatePpm);
    assert.strictEqual(actualCost, -1000); // -$10.00 (received)

    // Short protection buyer pays risk taker when realized > fixed
    const settlement = calculateIntervalSettlement(notionalCents, 'short', fixedRatePpm, realizedRatePpm);
    assert.strictEqual(settlement, -800); // -$8.00 (paid to risk taker)

    // Net funding cost = actual - settlement = -1000 - (-800) = -200 cents (-$2.00)
    const netCost = actualCost - settlement;
    assert.strictEqual(netCost, -200); // Exactly -$2.00 (matches fixed receive: -1 * 10,000 * 0.0002)

    // Across 21 intervals:
    const shortTerms: ContractTerms = {
      ...BASELINE_CONTRACT_TERMS,
      positionSide: 'short',
    };
    const explanation = buildCashFlowComparison(shortTerms, BASELINE_DOCUMENTED_OBSERVATIONS);
    assert.strictEqual(explanation.totalActualFundingCostCents, -21_000); // -$210.00
    assert.strictEqual(explanation.totalSettlementCents, -16_800); // -$168.00
    assert.strictEqual(explanation.netFundingCostCents, -4200); // -$42.00
  });

  it('correctly handles negative funding rates (bearish environment)', () => {
    const notionalCents = 1_000_000;
    const fixedRatePpm = 200; // +0.02%
    const realizedRatePpm = -300; // -0.03% (long receives $3.00)

    // Long position (s = +1):
    const actualCost = calculateFundingCost(notionalCents, 'long', realizedRatePpm);
    assert.strictEqual(actualCost, -300); // -$3.00

    // Settlement to buyer = 10,000 * (-0.0003 - 0.0002) = 10,000 * (-0.0005) = -$5.00
    const settlement = calculateIntervalSettlement(notionalCents, 'long', fixedRatePpm, realizedRatePpm);
    assert.strictEqual(settlement, -500); // -$5.00 (buyer pays risk taker)

    // Net cost = actual - settlement = -300 - (-500) = +200 cents (+$2.00 fixed cost preserved!)
    assert.strictEqual(actualCost - settlement, 200);
  });

  it('identifies missing observations and prevents silent zeroing', () => {
    // Drop observation 14
    const partialObs = BASELINE_DOCUMENTED_OBSERVATIONS.filter((o) => o.intervalIndex !== 14);
    const explanation = buildCashFlowComparison(BASELINE_CONTRACT_TERMS, partialObs);

    assert.strictEqual(explanation.missingObservationsCount, 1);
    const missingRecord = explanation.records.find((r) => r.intervalIndex === 14);
    assert.ok(missingRecord);
    assert.strictEqual(missingRecord.status, 'missing');
  });
});
