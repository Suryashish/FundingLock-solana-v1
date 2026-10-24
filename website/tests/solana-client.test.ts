import assert from 'node:assert/strict';
import test from 'node:test';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  buildAcceptOfferIx,
  buildActivateContractIx,
  buildCancelOfferIx,
  buildCreateOfferIx,
  buildDepositCollateralIx,
  buildFinalizeContractIx,
  buildInitializeMarketIx,
  buildRecordObservationIx,
  getContractPda,
  getInstructionDiscriminator,
} from '../lib/solana/client.ts';
import { createContractId } from '../lib/solana/transactions.ts';

test('uses Anchor discriminators for transaction instructions', () => {
  const buyer = new PublicKey('11111111111111111111111111111111');
  const instruction = buildCreateOfferIx({
    contractId: 'TEST-OFFER-001',
    marketSymbol: 'SOL-PERP',
    buyer,
    positionSide: 'long',
    notionalCents: 1_000_000,
    fixedRatePpm: 200,
    intervalCount: 21,
    startTime: 1_790_812_800,
  });

  assert.deepEqual(
    [...instruction.data.subarray(0, 8)],
    [...getInstructionDiscriminator('createOffer')]
  );
  assert.equal(instruction.data.length, 51);
});

test('builds the one-time market initialization instruction with the expected accounts', () => {
  const admin = new PublicKey('11111111111111111111111111111111');
  const instruction = buildInitializeMarketIx({
    venueId: 'BINANCE_PERP',
    marketSymbol: 'SOL-PERP',
    intervalSeconds: 28_800,
    minRatePpm: -5_000,
    maxRatePpm: 5_000,
    maxNotionalCents: 100_000_000,
    safetyBufferBps: 500,
    oracleAuthority: admin,
    admin,
  });

  assert.equal(instruction.keys.length, 3);
  assert.equal(instruction.keys[1].pubkey.toBase58(), admin.toBase58());
  assert.deepEqual(
    [...instruction.data.subarray(0, 8)],
    [...getInstructionDiscriminator('initializeMarket')]
  );
});

test('creates a unique contract id that fits the on-chain 16-byte field', () => {
  const wallet = new PublicKey('11111111111111111111111111111111');
  const contractId = createContractId('replay', wallet);
  const [address] = getContractPda(contractId);

  assert.ok(contractId.length <= 16);
  assert.notEqual(address.toBase58(), PublicKey.default.toBase58());
});

test('builds accept offer, deposit, activate, observation, finalize and cancel instructions', () => {
  const buyer = Keypair.generate().publicKey;
  const riskTaker = Keypair.generate().publicKey;
  const [contractPda] = getContractPda('FL-TEST-001');
  const [vaultPda] = getContractPda('FL-VAULT-001');
  const [marketConfigPda] = getContractPda('SOL-PERP');

  // Accept offer
  const acceptIx = buildAcceptOfferIx({ contractPda, riskTaker });
  assert.equal(acceptIx.keys.length, 2);
  assert.deepEqual(
    [...acceptIx.data],
    [...getInstructionDiscriminator('acceptOffer')]
  );

  // Deposit collateral
  const depositIx = buildDepositCollateralIx({
    contractPda,
    vaultPda,
    depositor: buyer,
    amountLamports: 1_000_000_000,
  });
  assert.equal(depositIx.keys.length, 4);
  assert.deepEqual(
    [...depositIx.data.subarray(0, 8)],
    [...getInstructionDiscriminator('depositCollateral')]
  );

  // Activate contract
  const activateIx = buildActivateContractIx({
    contractPda,
    marketConfigPda,
    authority: buyer,
  });
  assert.equal(activateIx.keys.length, 3);
  assert.deepEqual(
    [...activateIx.data],
    [...getInstructionDiscriminator('activateContract')]
  );

  // Record funding observation
  const obsIx = buildRecordObservationIx({
    contractPda,
    marketConfigPda,
    oracleAuthority: riskTaker,
    intervalIndex: 0,
    realizedRatePpm: 1000,
    recordedAt: 1790812800,
  });
  assert.equal(obsIx.keys.length, 5);
  assert.deepEqual(
    [...obsIx.data.subarray(0, 8)],
    [...getInstructionDiscriminator('recordFundingObservation')]
  );

  // Finalize contract
  const finalizeIx = buildFinalizeContractIx({
    contractPda,
    vaultPda,
    buyer,
    riskTaker,
    caller: buyer,
  });
  assert.equal(finalizeIx.keys.length, 6);
  assert.deepEqual(
    [...finalizeIx.data],
    [...getInstructionDiscriminator('finalizeContract')]
  );

  // Cancel offer
  const cancelIx = buildCancelOfferIx({
    contractPda,
    vaultPda,
    buyer,
  });
  assert.equal(cancelIx.keys.length, 4);
  assert.deepEqual(
    [...cancelIx.data],
    [...getInstructionDiscriminator('cancelUnmatchedOffer')]
  );
});
