use anchor_lang::prelude::*;
use contract::{
    constants::{LAMPORTS_PER_CENT, MARKET_CONFIG_SEED, RATE_SCALE},
    state::{ContractAccount, ContractState, MarketConfig, ObservationRecord},
};

#[test]
fn test_market_config_layout_and_seeds() {
    let program_id = contract::id();
    let symbol = *b"SOL-PERP\0\0\0\0\0\0\0\0";
    let (pda, bump) = Pubkey::find_program_address(&[MARKET_CONFIG_SEED, &symbol], &program_id);

    assert_ne!(pda, Pubkey::default());

    let config = MarketConfig {
        admin: Pubkey::new_unique(),
        oracle_authority: Pubkey::new_unique(),
        venue_id: *b"BINANCE_PERP\0\0\0\0",
        market_symbol: symbol,
        interval_seconds: 28800,
        min_rate_ppm: -5000,
        max_rate_ppm: 5000,
        max_notional_cents: 100_000_000,
        safety_buffer_bps: 500,
        is_paused: false,
        bump,
    };

    let mut data = Vec::new();
    config.try_serialize(&mut data).unwrap();
    assert_eq!(data.len() + 8, MarketConfig::LEN);
}

#[test]
fn test_contract_terms_and_collateral_math() {
    let notional_cents: u64 = 1_000_000; // $10,000.00
    let fixed_rate_ppm: i64 = 200; // 0.02%
    let min_rate_ppm: i64 = -5000; // -0.50%
    let max_rate_ppm: i64 = 5000; // +0.50%
    let interval_count: u16 = 21;
    let safety_buffer_bps: u16 = 500; // 5%

    // Evaluate interval extremes
    let settlement_at_max = ((max_rate_ppm - fixed_rate_ppm) * (notional_cents as i64)) / RATE_SCALE;
    let settlement_at_min = ((min_rate_ppm - fixed_rate_ppm) * (notional_cents as i64)) / RATE_SCALE;

    assert_eq!(settlement_at_max, 4800); // $48.00 = 4,800 cents per interval
    assert_eq!(settlement_at_min, -5200); // -$52.00 = -5,200 cents per interval

    let max_interval_payout = std::cmp::max(0, settlement_at_max);
    let max_interval_payment = std::cmp::max(0, -settlement_at_min);

    let max_buyer_payout_cents = max_interval_payout * (interval_count as i64);
    let max_buyer_payment_cents = max_interval_payment * (interval_count as i64);

    assert_eq!(max_buyer_payout_cents, 100_800); // $1,008.00 = 100,800 cents
    assert_eq!(max_buyer_payment_cents, 109_200); // $1,092.00 = 109,200 cents

    let buffer_factor = 10_000u64 + (safety_buffer_bps as u64);
    let required_risk_taker_cents = (max_buyer_payout_cents as u64 * buffer_factor + 9_999) / 10_000;
    let required_buyer_cents = (max_buyer_payment_cents as u64 * buffer_factor + 9_999) / 10_000;

    assert_eq!(required_risk_taker_cents, 105_840); // $1,058.40 = 105,840 cents
    assert_eq!(required_buyer_cents, 114_660); // $1,146.60 = 114,660 cents

    let req_taker_lamports = required_risk_taker_cents * LAMPORTS_PER_CENT;
    let req_buyer_lamports = required_buyer_cents * LAMPORTS_PER_CENT;

    assert_eq!(req_taker_lamports, 10_584_000_000);
    assert_eq!(req_buyer_lamports, 11_466_000_000);
}

#[test]
fn test_observation_settlement_ledger_and_netting() {
    // Replay the 21 intervals with 0.10% (+1000 PPM) constant realized rate
    let notional_cents: i64 = 1_000_000; // $10,000.00
    let fixed_rate_ppm: i64 = 200; // 0.02%
    let realized_rate_ppm: i64 = 1000; // 0.10%
    let interval_count: usize = 21;

    let rate_diff = realized_rate_ppm - fixed_rate_ppm; // 800 PPM
    let per_interval_settlement_cents = (notional_cents * rate_diff) / RATE_SCALE;

    assert_eq!(per_interval_settlement_cents, 800); // $8.00 = 800 cents per interval to buyer

    let mut accumulated_settlement_cents: i64 = 0;
    for i in 0..interval_count {
        accumulated_settlement_cents += per_interval_settlement_cents;
        let obs = ObservationRecord {
            contract: Pubkey::new_unique(),
            interval_index: i as u16,
            realized_rate_ppm,
            interval_settlement_cents: per_interval_settlement_cents,
            cumulative_settlement_cents: accumulated_settlement_cents,
            recorded_at: 1790812800 + (i as i64) * 28800,
            bump: 254,
        };
        assert_eq!(obs.cumulative_settlement_cents, (i as i64 + 1) * 800);
    }

    // Final accumulated settlement = 21 * $8.00 = $168.00 = 16,800 cents
    assert_eq!(accumulated_settlement_cents, 16_800);

    // Final net settlement transfer in lamports
    let net_lamports = (accumulated_settlement_cents as u64) * LAMPORTS_PER_CENT;
    assert_eq!(net_lamports, 1_680_000_000); // 1.68 SOL
}

#[test]
fn test_contract_lifecycle_transitions() {
    let mut contract = ContractAccount {
        contract_id: *b"FL-SOL-001\0\0\0\0\0\0",
        market_symbol: *b"SOL-PERP\0\0\0\0\0\0\0\0",
        buyer: Pubkey::new_unique(),
        risk_taker: Pubkey::default(),
        position_side: 0, // Long
        notional_cents: 1_000_000,
        fixed_rate_ppm: 200,
        interval_count: 21,
        interval_seconds: 28800,
        start_time: 1790812800,
        end_time: 1790812800 + 21 * 28800,
        required_buyer_collateral: 114_700_000,
        required_risk_taker_collateral: 105_900_000,
        deposited_buyer_collateral: 0,
        deposited_risk_taker_collateral: 0,
        accumulated_settlement_cents: 0,
        submitted_observations_count: 0,
        lifecycle_state: ContractState::Open as u8,
        bump: 255,
        vault_bump: 254,
    };

    assert_eq!(contract.lifecycle_state, ContractState::Open as u8);

    // 1. Matched
    let risk_taker = Pubkey::new_unique();
    contract.risk_taker = risk_taker;
    contract.lifecycle_state = ContractState::Matched as u8;
    assert_eq!(contract.lifecycle_state, ContractState::Matched as u8);

    // 2. Deposit buyer collateral
    contract.deposited_buyer_collateral = 114_700_000;
    // Still matched because risk taker has not deposited
    assert_ne!(contract.deposited_risk_taker_collateral, contract.required_risk_taker_collateral);

    // 3. Deposit risk taker collateral -> Funded
    contract.deposited_risk_taker_collateral = 105_900_000;
    contract.lifecycle_state = ContractState::Funded as u8;
    assert_eq!(contract.lifecycle_state, ContractState::Funded as u8);

    // 4. Activate
    contract.lifecycle_state = ContractState::Active as u8;
    assert_eq!(contract.lifecycle_state, ContractState::Active as u8);

    // 5. Submit 21 observations -> Settling
    for _i in 0..21 {
        contract.submitted_observations_count += 1;
        contract.accumulated_settlement_cents += 8;
        contract.lifecycle_state = ContractState::Settling as u8;
    }
    assert_eq!(contract.submitted_observations_count, 21);
    assert_eq!(contract.accumulated_settlement_cents, 168);

    // 6. Finalize -> Settled
    assert_eq!(contract.submitted_observations_count, contract.interval_count);
    contract.lifecycle_state = ContractState::Settled as u8;
    assert_eq!(contract.lifecycle_state, ContractState::Settled as u8);
}
