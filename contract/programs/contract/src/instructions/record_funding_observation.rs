use anchor_lang::prelude::*;
use crate::constants::{CONTRACT_SEED, MARKET_CONFIG_SEED, OBSERVATION_SEED, RATE_SCALE};
use crate::errors::ErrorCode;
use crate::state::{ContractAccount, ContractState, MarketConfig, ObservationRecord};

#[derive(Accounts)]
#[instruction(interval_index: u16)]
pub struct RecordFundingObservation<'info> {
    #[account(
        mut,
        seeds = [CONTRACT_SEED, contract_account.contract_id.as_ref()],
        bump = contract_account.bump
    )]
    pub contract_account: Account<'info, ContractAccount>,

    #[account(
        init,
        payer = oracle_authority,
        space = ObservationRecord::LEN,
        seeds = [OBSERVATION_SEED, contract_account.key().as_ref(), &interval_index.to_le_bytes()],
        bump
    )]
    pub observation_record: Account<'info, ObservationRecord>,

    #[account(
        seeds = [MARKET_CONFIG_SEED, market_config.market_symbol.as_ref()],
        bump = market_config.bump
    )]
    pub market_config: Account<'info, MarketConfig>,

    #[account(
        mut,
        address = market_config.oracle_authority @ ErrorCode::Unauthorized
    )]
    pub oracle_authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_record_funding_observation(
    ctx: Context<RecordFundingObservation>,
    interval_index: u16,
    realized_rate_ppm: i64,
    recorded_at: i64,
) -> Result<()> {
    let contract = &mut ctx.accounts.contract_account;
    let market_config = &ctx.accounts.market_config;

    require!(!market_config.is_paused, ErrorCode::MarketPaused);
    require!(
        contract.lifecycle_state == ContractState::Active as u8
            || contract.lifecycle_state == ContractState::Settling as u8,
        ErrorCode::InvalidState
    );

    // Sequence check: cannot skip or submit duplicate interval
    require!(
        interval_index == contract.submitted_observations_count,
        ErrorCode::InvalidObservationSequence
    );
    require!(
        interval_index < contract.interval_count,
        ErrorCode::InvalidObservationSequence
    );

    // Safety rate bounds check
    require!(
        realized_rate_ppm >= market_config.min_rate_ppm
            && realized_rate_ppm <= market_config.max_rate_ppm,
        ErrorCode::RateOutOfBounds
    );

    // Direction sign: 0 = Long (s = +1), 1 = Short (s = -1)
    let s: i64 = if contract.position_side == 0 { 1 } else { -1 };
    let rate_diff = realized_rate_ppm - contract.fixed_rate_ppm;
    let interval_settlement_cents = (s * (contract.notional_cents as i64) * rate_diff) / RATE_SCALE;

    contract.accumulated_settlement_cents = contract
        .accumulated_settlement_cents
        .checked_add(interval_settlement_cents)
        .ok_or(ErrorCode::MathOverflow)?;

    contract.submitted_observations_count = contract
        .submitted_observations_count
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;

    contract.lifecycle_state = ContractState::Settling as u8;

    // Record observation accounting
    let obs = &mut ctx.accounts.observation_record;
    obs.contract = contract.key();
    obs.interval_index = interval_index;
    obs.realized_rate_ppm = realized_rate_ppm;
    obs.interval_settlement_cents = interval_settlement_cents;
    obs.cumulative_settlement_cents = contract.accumulated_settlement_cents;
    obs.recorded_at = recorded_at;
    obs.bump = ctx.bumps.observation_record;

    msg!(
        "Observation recorded: interval={}, rate={} PPM, settlement={} cents, cum={} cents",
        interval_index,
        realized_rate_ppm,
        interval_settlement_cents,
        contract.accumulated_settlement_cents
    );
    Ok(())
}

