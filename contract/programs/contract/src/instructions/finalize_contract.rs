use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::constants::{CONTRACT_SEED, LAMPORTS_PER_CENT, VAULT_SEED};
use crate::errors::ErrorCode;
use crate::state::{ContractAccount, ContractState};

#[derive(Accounts)]
pub struct FinalizeContract<'info> {
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
        bump = contract_account.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,

    /// CHECK: Protection buyer recipient account
    #[account(
        mut,
        address = contract_account.buyer @ ErrorCode::Unauthorized
    )]
    pub buyer: UncheckedAccount<'info>,

    /// CHECK: Risk taker recipient account
    #[account(
        mut,
        address = contract_account.risk_taker @ ErrorCode::Unauthorized
    )]
    pub risk_taker: UncheckedAccount<'info>,

    #[account(mut)]
    pub caller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_finalize_contract(ctx: Context<FinalizeContract>) -> Result<()> {
    let contract = &mut ctx.accounts.contract_account;

    require!(
        contract.lifecycle_state == ContractState::Settling as u8,
        ErrorCode::InvalidState
    );

    // Explicit plan constraint: all observations must be submitted; missing data blocks finalization!
    require!(
        contract.submitted_observations_count == contract.interval_count,
        ErrorCode::ObservationsIncomplete
    );

    let contract_key = contract.key();
    let vault_seeds = &[
        VAULT_SEED,
        contract_key.as_ref(),
        &[contract.vault_bump],
    ];
    let signer_seeds = &[&vault_seeds[..]];

    let net_settlement_cents = contract.accumulated_settlement_cents;
    let buyer_deposited = contract.deposited_buyer_collateral;
    let taker_deposited = contract.deposited_risk_taker_collateral;

    let (buyer_payout, taker_payout) = if net_settlement_cents > 0 {
        // Risk taker pays buyer
        let net_lamports = (net_settlement_cents as u64)
            .checked_mul(LAMPORTS_PER_CENT)
            .ok_or(ErrorCode::MathOverflow)?;
        let actual_transfer = std::cmp::min(net_lamports, taker_deposited);
        let b_pay = buyer_deposited.checked_add(actual_transfer).ok_or(ErrorCode::MathOverflow)?;
        let t_pay = taker_deposited.saturating_sub(actual_transfer);
        (b_pay, t_pay)
    } else if net_settlement_cents < 0 {
        // Buyer pays risk taker
        let net_lamports = ((-net_settlement_cents) as u64)
            .checked_mul(LAMPORTS_PER_CENT)
            .ok_or(ErrorCode::MathOverflow)?;
        let actual_transfer = std::cmp::min(net_lamports, buyer_deposited);
        let t_pay = taker_deposited.checked_add(actual_transfer).ok_or(ErrorCode::MathOverflow)?;
        let b_pay = buyer_deposited.saturating_sub(actual_transfer);
        (b_pay, t_pay)
    } else {
        // Zero net difference: refund initial deposits
        (buyer_deposited, taker_deposited)
    };

    let vault_balance = ctx.accounts.vault.lamports();
    require!(
        vault_balance >= buyer_payout.saturating_add(taker_payout),
        ErrorCode::InsufficientVaultBalance
    );

    // Transfer final payout to buyer
    if buyer_payout > 0 {
        let cpi_to_buyer = CpiContext::new_with_signer(
            ctx.accounts.system_program.key(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.buyer.to_account_info(),
            },
            signer_seeds,
        );
        transfer(cpi_to_buyer, buyer_payout)?;
    }

    // Transfer final payout to risk taker
    if taker_payout > 0 {
        let cpi_to_taker = CpiContext::new_with_signer(
            ctx.accounts.system_program.key(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.risk_taker.to_account_info(),
            },
            signer_seeds,
        );
        transfer(cpi_to_taker, taker_payout)?;
    }

    contract.lifecycle_state = ContractState::Settled as u8;

    msg!(
        "Contract finalized! Net settlement: {} cents. Buyer received: {} lamports, Risk taker received: {} lamports",
        net_settlement_cents,
        buyer_payout,
        taker_payout
    );
    Ok(())
}
