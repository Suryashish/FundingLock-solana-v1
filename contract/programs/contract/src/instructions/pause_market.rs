use anchor_lang::prelude::*;
use crate::constants::MARKET_CONFIG_SEED;
use crate::errors::ErrorCode;
use crate::state::MarketConfig;

#[derive(Accounts)]
pub struct PauseMarket<'info> {
    #[account(
        mut,
        seeds = [MARKET_CONFIG_SEED, market_config.market_symbol.as_ref()],
        bump = market_config.bump
    )]
    pub market_config: Account<'info, MarketConfig>,

    #[account(
        address = market_config.admin @ ErrorCode::Unauthorized
    )]
    pub admin: Signer<'info>,
}

pub fn handle_pause_market(ctx: Context<PauseMarket>) -> Result<()> {
    ctx.accounts.market_config.is_paused = true;
    msg!("Market paused by admin.");
    Ok(())
}

pub fn handle_unpause_market(ctx: Context<PauseMarket>) -> Result<()> {
    ctx.accounts.market_config.is_paused = false;
    msg!("Market unpaused by admin.");
    Ok(())
}

