use anchor_lang::prelude::*;
use crate::constants::MARKET_CONFIG_SEED;
use crate::state::MarketConfig;

#[derive(Accounts)]
#[instruction(market_symbol: [u8; 16])]
pub struct InitializeMarket<'info> {
    #[account(
        init,
        payer = admin,
        space = MarketConfig::LEN,
        seeds = [MARKET_CONFIG_SEED, market_symbol.as_ref()],
        bump
    )]
    pub market_config: Account<'info, MarketConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_market(
    ctx: Context<InitializeMarket>,
    venue_id: [u8; 16],
    market_symbol: [u8; 16],
    interval_seconds: u64,
    min_rate_ppm: i64,
    max_rate_ppm: i64,
    max_notional_cents: u64,
    safety_buffer_bps: u16,
    oracle_authority: Pubkey,
) -> Result<()> {
    let config = &mut ctx.accounts.market_config;
    config.admin = ctx.accounts.admin.key();
    config.oracle_authority = oracle_authority;
    config.venue_id = venue_id;
    config.market_symbol = market_symbol;
    config.interval_seconds = interval_seconds;
    config.min_rate_ppm = min_rate_ppm;
    config.max_rate_ppm = max_rate_ppm;
    config.max_notional_cents = max_notional_cents;
    config.safety_buffer_bps = safety_buffer_bps;
    config.is_paused = false;
    config.bump = ctx.bumps.market_config;

    msg!("Market configured: symbol={:?}, interval={}s", market_symbol, interval_seconds);
    Ok(())
}

