use anchor_lang::prelude::*;
use crate::constants::CONTRACT_SEED;
use crate::errors::ErrorCode;
use crate::state::{ContractAccount, ContractState};

#[derive(Accounts)]
pub struct AcceptOffer<'info> {
    #[account(
        mut,
        seeds = [CONTRACT_SEED, contract_account.contract_id.as_ref()],
        bump = contract_account.bump
    )]
    pub contract_account: Account<'info, ContractAccount>,

    #[account(mut)]
    pub risk_taker: Signer<'info>,
}

pub fn handle_accept_offer(ctx: Context<AcceptOffer>) -> Result<()> {
    let contract = &mut ctx.accounts.contract_account;

    require!(
        contract.lifecycle_state == ContractState::Open as u8,
        ErrorCode::InvalidState
    );
    require!(
        contract.buyer != ctx.accounts.risk_taker.key(),
        ErrorCode::Unauthorized
    );

    contract.risk_taker = ctx.accounts.risk_taker.key();
    contract.lifecycle_state = ContractState::Matched as u8;

    msg!("Offer matched with risk taker: {}", contract.risk_taker);
    Ok(())
}

