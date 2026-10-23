use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct ObservationRecord {
    pub contract: Pubkey,
    pub interval_index: u16,
    pub realized_rate_ppm: i64,
    pub interval_settlement_cents: i64,
    pub cumulative_settlement_cents: i64,
    pub recorded_at: i64,
    pub bump: u8,
}

impl ObservationRecord {
    pub const LEN: usize = 8
        + 32 // contract
        + 2  // interval_index
        + 8  // realized_rate_ppm
        + 8  // interval_settlement_cents
        + 8  // cumulative_settlement_cents
        + 8  // recorded_at
        + 1; // bump
}

