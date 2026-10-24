/**
 * FundingLock Testnet Oracle Publisher Script
 *
 * Standalone publisher service for submitting normalized funding-rate observations to the Solana contract.
 *
 * SECURITY:
 * - This script signs transactions with the authorized publisher keypair.
 * - This script must NEVER be imported or bundled into the client browser.
 * - Private keys and secrets are loaded from environment variables or local keypair file.
 *
 * Usage:
 *   node scripts/funding-publisher.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import {
  PROGRAM_ID,
  getContractPda,
  getMarketConfigPda,
  buildRecordObservationIx,
} from '../lib/solana/client.ts';
import {
  DEMO_SCENARIOS,
} from '../lib/data/fixtures.ts';
import { BINANCE_SOL_CONFIG } from '../lib/domain/types.ts';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.testnet.solana.com';
const CONTRACT_ID = process.env.CONTRACT_ID || 'FL-SOL-001';
const SCENARIO_NAME = process.env.SCENARIO_NAME || 'baseline';

export interface PublisherConfig {
  contractId: string;
  scenarioName: string;
  delayMsPerInterval: number;
  skipInterval?: number; // Simulates missing observation
}

export async function runPublisher(config: PublisherConfig) {
  console.log('='.repeat(60));
  console.log('FUNDINGLOCK ORACLE PUBLISHER SERVICE');
  console.log('='.repeat(60));
  console.log(`RPC Endpoint: ${RPC_URL}`);
  console.log(`Program ID:   ${PROGRAM_ID.toBase58()}`);
  console.log(`Contract ID:  ${config.contractId}`);
  console.log(`Venue:        ${BINANCE_SOL_CONFIG.venueId}`);
  console.log(`Market:       ${BINANCE_SOL_CONFIG.marketSymbol}`);
  console.log(`Scenario:     ${config.scenarioName}`);
  console.log('='.repeat(60));

  // Load publisher keypair (ephemeral or from env)
  let publisherKeypair: Keypair;
  if (process.env.PUBLISHER_SECRET_KEY) {
    const secret = JSON.parse(process.env.PUBLISHER_SECRET_KEY);
    publisherKeypair = Keypair.fromSecretKey(new Uint8Array(secret));
  } else {
    publisherKeypair = Keypair.generate();
    console.log(`Generated ephemeral publisher key: ${publisherKeypair.publicKey.toBase58()}`);
  }

  const [contractPda] = getContractPda(config.contractId);
  const [marketConfigPda] = getMarketConfigPda(BINANCE_SOL_CONFIG.marketSymbol);
  const connection = new Connection(RPC_URL, 'confirmed');
  const isDryRun = !process.env.PUBLISHER_SECRET_KEY;

  const marketConfigInfo = await connection.getAccountInfo(marketConfigPda, 'confirmed');
  if (!marketConfigInfo || marketConfigInfo.data.length !== 148) {
    throw new Error(`MarketConfig PDA ${marketConfigPda.toBase58()} is not initialized on ${RPC_URL}.`);
  }
  const configuredOracleAuthority = new PublicKey(marketConfigInfo.data.subarray(40, 72));
  if (!isDryRun && !configuredOracleAuthority.equals(publisherKeypair.publicKey)) {
    throw new Error(
      `Publisher ${publisherKeypair.publicKey.toBase58()} is not the configured oracle authority ${configuredOracleAuthority.toBase58()}.`
    );
  }

  if (isDryRun) {
    console.warn('\nNo PUBLISHER_SECRET_KEY supplied; running in dry-run mode without broadcasting transactions.');
  }

  const scenario = DEMO_SCENARIOS[config.scenarioName] || DEMO_SCENARIOS.baseline;
  const observations = scenario.observations;

  console.log(`\nBeginning publication of ${observations.length} observations...`);

  for (let i = 0; i < observations.length; i++) {
    const obs = observations[i];

    if (config.skipInterval !== undefined && obs.intervalIndex === config.skipInterval) {
      console.warn(`[SKIP] Simulating missing observation for interval index ${obs.intervalIndex}!`);
      continue;
    }

    // Strict validation
    if (obs.ratePpm < BINANCE_SOL_CONFIG.minRatePpm || obs.ratePpm > BINANCE_SOL_CONFIG.maxRatePpm) {
      console.error(`[REJECT] Observation rate ${obs.ratePpm} PPM exceeds safety bounds!`);
      continue;
    }

    const instruction = buildRecordObservationIx({
      contractPda,
      marketConfigPda,
      oracleAuthority: publisherKeypair.publicKey,
      intervalIndex: obs.intervalIndex,
      realizedRatePpm: obs.ratePpm,
      recordedAt: Math.floor(Date.now() / 1000),
    });

    if (!isDryRun) {
      const latestBlockhash = await connection.getLatestBlockhash('confirmed');
      const transaction = new Transaction({
        feePayer: publisherKeypair.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
      }).add(instruction);
      const simulation = await connection.simulateTransaction(transaction, [publisherKeypair]);
      if (simulation.value.err) {
        throw new Error(
          `Simulation failed for interval ${obs.intervalIndex}: ${JSON.stringify(simulation.value.err)}`
        );
      }
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [publisherKeypair],
        { commitment: 'confirmed', maxRetries: 3 }
      );
      console.log(`  Confirmed: ${signature}`);
    }

    console.log(
      `[PUBLISH] Interval ${obs.intervalIndex.toString().padStart(2, '0')} | ` +
      `Rate: ${(obs.ratePpm / 10_000).toFixed(4)}% | ` +
      `Timestamp: ${new Date(obs.startTime * 1000).toISOString()}`
    );

    if (config.delayMsPerInterval > 0) {
      await new Promise((r) => setTimeout(r, config.delayMsPerInterval));
    }
  }

  console.log('\nOracle publication completed successfully.');
}

runPublisher({
  contractId: CONTRACT_ID,
  scenarioName: SCENARIO_NAME,
  delayMsPerInterval: 20,
  skipInterval: process.env.SKIP_INTERVAL ? Number(process.env.SKIP_INTERVAL) : undefined,
}).catch((err) => {
  console.error('Publisher error:', err);
});
