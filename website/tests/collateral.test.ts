/**
 * Collateral & Solvency Unit Tests
 *
 * Verifies that collateral calculations derive from maximum permitted payout
 * across rate bounds rather than expected rates, with strict safety buffers.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateCollateralRequirement, validateCollateralDeposits } from '../lib/domain/collateral.ts';
import { BASELINE_CONTRACT_TERMS } from '../lib/data/fixtures.ts';
import { BINANCE_SOL_CONFIG } from '../lib/domain/types.ts';
import type { ContractTerms } from '../lib/domain/types.ts';

describe('Collateral & Solvency Calculations', () => {
  it('calculates maximum payout based on rate bounds [-0.50%, +0.50%]', () => {
    // $10,000 notional
    // fixed rate: +0.02% (+200 PPM)
    // 21 intervals
    // min rate: -0.50% (-5000 PPM)
    // max rate: +0.50% (+5000 PPM)
    const req = calculateCollateralRequirement(BASELINE_CONTRACT_TERMS, BINANCE_SOL_CONFIG);

    // Max rate (+5000 PPM):
    // buyer receives: 10,000 * (0.0050 - 0.0002) = 10,000 * 0.0048 = $48.00 per interval
    // 21 intervals = 21 * $48.00 = $1,008.00 = 100,800 cents
    assert.strictEqual(req.maxBuyerPayoutCents, 100_800);

    // Min rate (-5000 PPM):
    // buyer pays: 10,000 * (-0.0050 - 0.0002) = -10,000 * 0.0052 = -$52.00 per interval
    // 21 intervals = 21 * $52.00 = $1,092.00 = 109,200 cents
    assert.strictEqual(req.maxBuyerPaymentCents, 109_200);

    // With 5% buffer:
    // Risk taker collateral: ceil(1008.00 * 1.05) = $1,058.40 = 105,840 cents
    assert.strictEqual(req.riskTakerCollateralCents, 105_840);

    // Buyer collateral: ceil(1092.00 * 1.05) = $1,146.60 = 114,660 cents
    assert.strictEqual(req.buyerCollateralCents, 114_660);

    // Total vault collateral
    assert.strictEqual(req.totalVaultCollateralCents, 105_840 + 114_660);
    assert.strictEqual(req.isFullyCovered, true);
  });

  it('inverts bound exposures for short position', () => {
    const shortTerms: ContractTerms = {
      ...BASELINE_CONTRACT_TERMS,
      positionSide: 'short',
    };
    const req = calculateCollateralRequirement(shortTerms, BINANCE_SOL_CONFIG);

    // For short position, buyer receives when realized rate drops to min (-0.50%)
    // Diff: (-0.0050 - 0.0002) = -0.0052 -> s = -1 -> +0.0052 * 10,000 = $52.00 per interval
    // 21 intervals = $1,092.00
    assert.strictEqual(req.maxBuyerPayoutCents, 109_200);
    assert.strictEqual(req.maxBuyerPaymentCents, 100_800);
    assert.strictEqual(req.riskTakerCollateralCents, 114_660);
    assert.strictEqual(req.buyerCollateralCents, 105_840);
  });

  it('validates deposited collateral and flags underfunded activation', () => {
    const terms = BASELINE_CONTRACT_TERMS;
    const req = calculateCollateralRequirement(terms, BINANCE_SOL_CONFIG);

    // Underfunded risk taker
    const underfunded = validateCollateralDeposits(
      terms,
      req.buyerCollateralCents,
      req.riskTakerCollateralCents - 5000, // $50 short
      BINANCE_SOL_CONFIG
    );
    assert.strictEqual(underfunded.canActivate, false);
    assert.strictEqual(underfunded.isRiskTakerSufficient, false);
    assert.strictEqual(underfunded.riskTakerShortfallCents, 5000);

    // Fully funded
    const fullyFunded = validateCollateralDeposits(
      terms,
      req.buyerCollateralCents,
      req.riskTakerCollateralCents,
      BINANCE_SOL_CONFIG
    );
    assert.strictEqual(fullyFunded.canActivate, true);
    assert.strictEqual(fullyFunded.buyerShortfallCents, 0);
    assert.strictEqual(fullyFunded.riskTakerShortfallCents, 0);
  });
});
