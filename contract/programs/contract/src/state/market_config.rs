use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct MarketConfig {
    pub admin: Pubkey,
    pub oracle_authority: Pubkey,
    pub venue_id: [u8; 16],
    pub market_symbol: [u8; 16],
    pub interval_seconds: u64,
    pub min_rate_ppm: i64,
    pub max_rate_ppm: i64,
    pub max_notional_cents: u64,
    pub safety_buffer_bps: u16,
    pub is_paused: bool,
    pub bump: u8,
}

impl MarketConfig {
    pub const LEN: usize = 8 + 140;
}
