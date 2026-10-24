import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicKey } from '@solana/web3.js';
import {
  buildCreateOfferIx,
  buildInitializeMarketIx,
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
