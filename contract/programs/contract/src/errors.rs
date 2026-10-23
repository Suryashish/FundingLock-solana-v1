use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized: Signer does not have permission for this operation")]
    Unauthorized,

    #[msg("Market is paused by protocol authority")]
    MarketPaused,

    #[msg("Invalid lifecycle state for this instruction")]
    InvalidState,

    #[msg("Short-position hedges are currently supported in simulator only")]
    ShortPositionNotSupportedOnChain,

    #[msg("Deposit amount is less than required collateral")]
    InsufficientCollateral,

    #[msg("Observation interval index out of sequence")]
    InvalidObservationSequence,

    #[msg("Realized funding rate is outside configured safety bounds")]
    RateOutOfBounds,

    #[msg("Contract has not completed all expected funding intervals")]
    ObservationsIncomplete,

    #[msg("Contract is already finalized")]
    AlreadySettled,

    #[msg("Math overflow occurred during settlement calculation")]
    MathOverflow,

    #[msg("Vault balance is insufficient for settlement payout")]
    InsufficientVaultBalance,

    #[msg("Invalid market or symbol configuration")]
    InvalidMarketConfig,
}
