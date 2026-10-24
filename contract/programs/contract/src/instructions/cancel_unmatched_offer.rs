use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::constants::{CONTRACT_SEED, VAULT_SEED};
use crate::errors::ErrorCode;
use crate::state::{ContractAccount, ContractState};

#[derive(Accounts)]
pub struct CancelUnmatchedOffer<'info> {
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

    #[account(
        mut,
        address = contract_account.buyer @ ErrorCode::Unauthorized
    )]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_cancel_unmatched_offer(ctx: Context<CancelUnmatchedOffer>) -> Result<()> {
    let contract = &mut ctx.accounts.contract_account;

    require!(
        contract.lifecycle_state == ContractState::Open as u8,
        ErrorCode::InvalidState
    );

    let refund_amount = contract.deposited_buyer_collateral;
    if refund_amount > 0 && ctx.accounts.vault.lamports() >= refund_amount {
        let contract_key = contract.key();
        let bump = if contract.vault_bump != 0 {
            contract.vault_bump
        } else {
            ctx.bumps.vault
        };
        let vault_seeds = &[
            VAULT_SEED,
            contract_key.as_ref(),
            &[bump],
        ];
        let signer_seeds = &[&vault_seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.key(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.buyer.to_account_info(),
            },
            signer_seeds,
        );
        transfer(cpi_ctx, refund_amount)?;
        contract.deposited_buyer_collateral = 0;
    }

    contract.lifecycle_state = ContractState::Cancelled as u8;
    msg!("Unmatched offer cancelled and collateral refunded.");
    Ok(())
}
