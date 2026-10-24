use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("HSMBzbTfQQgLKk9Bv7d9WkLiK1yvKCs9FkeGgBhgfZj9");

#[program]
pub mod contract {
    use super::*;

    pub fn initialize_market(
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
        instructions::initialize_market::handle_initialize_market(
            ctx,
            venue_id,
            market_symbol,
            interval_seconds,
            min_rate_ppm,
            max_rate_ppm,
            max_notional_cents,
            safety_buffer_bps,
            oracle_authority,
        )
    }

    pub fn create_offer(
        ctx: Context<CreateOffer>,
        contract_id: [u8; 16],
        position_side: u8,
        notional_cents: u64,
        fixed_rate_ppm: i64,
        interval_count: u16,
        start_time: i64,
    ) -> Result<()> {
        instructions::create_offer::handle_create_offer(
            ctx,
            contract_id,
            position_side,
            notional_cents,
            fixed_rate_ppm,
            interval_count,
            start_time,
        )
    }

    pub fn accept_offer(ctx: Context<AcceptOffer>) -> Result<()> {
        instructions::accept_offer::handle_accept_offer(ctx)
    }

    pub fn deposit_collateral(ctx: Context<DepositCollateral>, amount: u64) -> Result<()> {
        instructions::deposit_collateral::handle_deposit_collateral(ctx, amount)
    }

    pub fn activate_contract(ctx: Context<ActivateContract>) -> Result<()> {
        instructions::activate_contract::handle_activate_contract(ctx)
    }

    pub fn record_funding_observation(
        ctx: Context<RecordFundingObservation>,
        interval_index: u16,
        realized_rate_ppm: i64,
        recorded_at: i64,
    ) -> Result<()> {
        instructions::record_funding_observation::handle_record_funding_observation(
            ctx,
            interval_index,
            realized_rate_ppm,
            recorded_at,
        )
    }

    pub fn finalize_contract(ctx: Context<FinalizeContract>) -> Result<()> {
        instructions::finalize_contract::handle_finalize_contract(ctx)
    }

    pub fn cancel_unmatched_offer(ctx: Context<CancelUnmatchedOffer>) -> Result<()> {
        instructions::cancel_unmatched_offer::handle_cancel_unmatched_offer(ctx)
    }

    pub fn pause_market(ctx: Context<PauseMarket>) -> Result<()> {
        instructions::pause_market::handle_pause_market(ctx)
    }

    pub fn unpause_market(ctx: Context<PauseMarket>) -> Result<()> {
        instructions::pause_market::handle_unpause_market(ctx)
    }
}
