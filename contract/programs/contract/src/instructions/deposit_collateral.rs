use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::constants::{CONTRACT_SEED, VAULT_SEED};
use crate::errors::ErrorCode;
use crate::state::{ContractAccount, ContractState};

#[derive(Accounts)]
pub struct DepositCollateral<'info> {
    #[account(
        mut,
        seeds = [CONTRACT_SEED, contract_account.contract_id.as_ref()],
        bump = contract_account.bump
    )]
    pub contract_account: Account<'info, ContractAccount>,

    /// CHECK: Vault PDA holding locked collateral
    #[account(
        mut,
        seeds = [VAULT_SEED, contract_account.key().as_ref()],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_deposit_collateral(ctx: Context<DepositCollateral>, amount: u64) -> Result<()> {
    let contract = &mut ctx.accounts.contract_account;
    let depositor_key = ctx.accounts.depositor.key();

    require!(
        contract.lifecycle_state == ContractState::Open as u8
            || contract.lifecycle_state == ContractState::Matched as u8
            || contract.lifecycle_state == ContractState::Funded as u8,
        ErrorCode::InvalidState
    );

    require!(
        depositor_key == contract.buyer || depositor_key == contract.risk_taker,
        ErrorCode::Unauthorized
    );

    require!(amount > 0, ErrorCode::InsufficientCollateral);

    // Transfer lamports from depositor to vault
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.key(),
        Transfer {
            from: ctx.accounts.depositor.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        },
    );
    transfer(cpi_context, amount)?;

    // Store vault bump if not yet stored
    if contract.vault_bump == 0 {
        contract.vault_bump = ctx.bumps.vault;
    }

    if depositor_key == contract.buyer {
        contract.deposited_buyer_collateral = contract
            .deposited_buyer_collateral
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;
    } else {
        contract.deposited_risk_taker_collateral = contract
            .deposited_risk_taker_collateral
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;
    }

    // Check if fully funded
    let buyer_funded = contract.deposited_buyer_collateral >= contract.required_buyer_collateral;
    let taker_funded = contract.deposited_risk_taker_collateral >= contract.required_risk_taker_collateral;

    if buyer_funded && taker_funded {
        contract.lifecycle_state = ContractState::Funded as u8;
        msg!("Contract is fully funded and ready for activation!");
    }

    msg!("Collateral deposited: {} lamports by {}", amount, depositor_key);
    Ok(())
}
