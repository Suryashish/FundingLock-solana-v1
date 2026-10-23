use anchor_lang::prelude::*;

#[constant]
pub const MARKET_CONFIG_SEED: &[u8] = b"market_config";

#[constant]
pub const CONTRACT_SEED: &[u8] = b"contract";

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

#[constant]
pub const OBSERVATION_SEED: &[u8] = b"observation";

// Rate scale: 1,000,000 (PPM: Parts Per Million)
pub const RATE_SCALE: i64 = 1_000_000;

// Conversion rate for testnet demo: 1 cent = 100_000 lamports (0.0001 SOL)
pub const LAMPORTS_PER_CENT: u64 = 100_000;
