use anchor_lang::prelude::*;
use crate::constants::{CONTRACT_SEED, LAMPORTS_PER_CENT, MARKET_CONFIG_SEED, RATE_SCALE};
use crate::errors::ErrorCode;
use crate::state::{ContractAccount, ContractState, MarketConfig};

#[derive(Accounts)]
#[instruction(contract_id: [u8; 16])]
pub struct CreateOffer<'info> {
    #[account(
        init,
        payer = buyer,
        space = ContractAccount::LEN,
        seeds = [CONTRACT_SEED, contract_id.as_ref()],
        bump
    )]
    pub contract_account: Account<'info, ContractAccount>,

    #[account(
        seeds = [MARKET_CONFIG_SEED, market_config.market_symbol.as_ref()],
        bump = market_config.bump
    )]
    pub market_config: Account<'info, MarketConfig>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_create_offer(
    ctx: Context<CreateOffer>,
    contract_id: [u8; 16],
    position_side: u8,
    notional_cents: u64,
    fixed_rate_ppm: i64,
    interval_count: u16,
    start_time: i64,
) -> Result<()> {
    let market_config = &ctx.accounts.market_config;

    require!(!market_config.is_paused, ErrorCode::MarketPaused);
    // Explicit plan constraint: Phase 3 on-chain contract enforces long position (0)
    require!(position_side == 0, ErrorCode::ShortPositionNotSupportedOnChain);
    require!(notional_cents > 0 && notional_cents <= market_config.max_notional_cents, ErrorCode::InvalidMarketConfig);
    require!(
        fixed_rate_ppm >= market_config.min_rate_ppm && fixed_rate_ppm <= market_config.max_rate_ppm,
        ErrorCode::RateOutOfBounds
    );
    require!(interval_count > 0, ErrorCode::InvalidMarketConfig);

    let contract = &mut ctx.accounts.contract_account;
    contract.contract_id = contract_id;
    contract.market_symbol = market_config.market_symbol;
    contract.buyer = ctx.accounts.buyer.key();
    contract.risk_taker = Pubkey::default();
    contract.position_side = position_side;
    contract.notional_cents = notional_cents;
    contract.fixed_rate_ppm = fixed_rate_ppm;
    contract.interval_count = interval_count;
    contract.interval_seconds = market_config.interval_seconds;
    contract.start_time = start_time;
    contract.end_time = start_time + (interval_count as i64) * (market_config.interval_seconds as i64);

    // Calculate maximum settlement payout and payment across bounds
    let settlement_at_max = ((market_config.max_rate_ppm - fixed_rate_ppm) * (notional_cents as i64)) / RATE_SCALE;
    let settlement_at_min = ((market_config.min_rate_ppm - fixed_rate_ppm) * (notional_cents as i64)) / RATE_SCALE;

    let max_interval_payout = std::cmp::max(0, settlement_at_max);
    let max_interval_payment = std::cmp::max(0, -settlement_at_min);

    let max_buyer_payout_cents = max_interval_payout * (interval_count as i64);
    let max_buyer_payment_cents = max_interval_payment * (interval_count as i64);

    let buffer_factor = 10_000u64 + (market_config.safety_buffer_bps as u64);
    let required_risk_taker_cents = (max_buyer_payout_cents as u64 * buffer_factor + 9_999) / 10_000;
    let required_buyer_cents = (max_buyer_payment_cents as u64 * buffer_factor + 9_999) / 10_000;

    contract.required_risk_taker_collateral = required_risk_taker_cents * LAMPORTS_PER_CENT;
    contract.required_buyer_collateral = required_buyer_cents * LAMPORTS_PER_CENT;
    contract.deposited_buyer_collateral = 0;
    contract.deposited_risk_taker_collateral = 0;
    contract.accumulated_settlement_cents = 0;
    contract.submitted_observations_count = 0;
    contract.lifecycle_state = ContractState::Open as u8;
    contract.bump = ctx.bumps.contract_account;

    let contract_key = contract.key();
    let (_, vault_bump) = Pubkey::find_program_address(
        &[crate::constants::VAULT_SEED, contract_key.as_ref()],
        ctx.program_id,
    );
    contract.vault_bump = vault_bump;

    msg!("Offer created: notional=${}, required_buyer={} lamports, required_taker={} lamports",
        notional_cents / 100, contract.required_buyer_collateral, contract.required_risk_taker_collateral);
    Ok(())
}

