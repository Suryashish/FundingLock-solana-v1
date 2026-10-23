use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[borsh(use_discriminant = true)]
#[repr(u8)]
pub enum ContractState {
    Open = 0,
    Matched = 1,
    Funded = 2,
    Active = 3,
    Settling = 4,
    Settled = 5,
    Cancelled = 6,
    Defaulted = 7,
}

#[account]
#[derive(Default)]
pub struct ContractAccount {
    pub contract_id: [u8; 16],
    pub market_symbol: [u8; 16],
    pub buyer: Pubkey,
    pub risk_taker: Pubkey,
    pub position_side: u8, // 0 = Long, 1 = Short
    pub notional_cents: u64,
    pub fixed_rate_ppm: i64,
    pub interval_count: u16,
    pub interval_seconds: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub required_buyer_collateral: u64,
    pub required_risk_taker_collateral: u64,
    pub deposited_buyer_collateral: u64,
    pub deposited_risk_taker_collateral: u64,
    pub accumulated_settlement_cents: i64,
    pub submitted_observations_count: u16,
    pub lifecycle_state: u8,
    pub bump: u8,
    pub vault_bump: u8,
}

impl ContractAccount {
    pub const LEN: usize = 8
        + 16 // contract_id
        + 16 // market_symbol
        + 32 // buyer
        + 32 // risk_taker
        + 1  // position_side
        + 8  // notional_cents
        + 8  // fixed_rate_ppm
        + 2  // interval_count
        + 8  // interval_seconds
        + 8  // start_time
        + 8  // end_time
        + 8  // required_buyer_collateral
        + 8  // required_risk_taker_collateral
        + 8  // deposited_buyer_collateral
        + 8  // deposited_risk_taker_collateral
        + 8  // accumulated_settlement_cents
        + 2  // submitted_observations_count
        + 1  // lifecycle_state
        + 1  // bump
        + 1; // vault_bump
}
