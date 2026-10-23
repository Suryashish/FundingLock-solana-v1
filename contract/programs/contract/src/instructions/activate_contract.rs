use anchor_lang::prelude::*;
use crate::constants::{CONTRACT_SEED, MARKET_CONFIG_SEED};
use crate::errors::ErrorCode;
use crate::state::{ContractAccount, ContractState, MarketConfig};

#[derive(Accounts)]
pub struct ActivateContract<'info> {
    #[account(
        mut,
        seeds = [CONTRACT_SEED, contract_account.contract_id.as_ref()],
        bump = contract_account.bump
    )]
    pub contract_account: Account<'info, ContractAccount>,

    #[account(
        seeds = [MARKET_CONFIG_SEED, market_config.market_symbol.as_ref()],
        bump = market_config.bump
    )]
    pub market_config: Account<'info, MarketConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

pub fn handle_activate_contract(ctx: Context<ActivateContract>) -> Result<()> {
    let contract = &mut ctx.accounts.contract_account;
    let market_config = &ctx.accounts.market_config;

    require!(!market_config.is_paused, ErrorCode::MarketPaused);
    require!(
        contract.lifecycle_state == ContractState::Funded as u8,
        ErrorCode::InvalidState
    );
    require!(
        contract.deposited_buyer_collateral >= contract.required_buyer_collateral
            && contract.deposited_risk_taker_collateral >= contract.required_risk_taker_collateral,
        ErrorCode::InsufficientCollateral
    );

    contract.lifecycle_state = ContractState::Active as u8;
    msg!("Contract activated! Terms are now immutable.");
    Ok(())
}

