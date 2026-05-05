use anchor_lang::prelude::*;

#[error_code]
pub enum ClaimError {
    #[msg("Answer entered is incorrect")]
    InvalidAnswer,
    #[msg("Claimer is not the same as approved recipient")]
    UnauthorizedClaimer,
    #[msg("Gift already claimed")]
    ClaimedAlready,
    #[msg("NFT mint address did not match the NFT mint in gift escrow")]
    IncorrectNFTMint,
    #[msg("Gift ATA doesn't have the NFT")]
    GiftATAEmpty
}

#[error_code]
pub enum GiftError {
    #[msg("Receiver public key is invalid")]
    InvalidReceiver,
    #[msg("Minimum 0.001 SOL required as gift amount")]
    BelowMinimumAmount,
    #[msg("Cannot gift to self")]
    CannotGiftToSelf,
    #[msg("Cannot gift to past")]
    CannotGiftToPast,
    #[msg("Delivery date must be in future")]
    DeliveryDateMustBeInFuture,
    #[msg("Invalid answer hash")]
    InvalidAnswerHash,
    #[msg("Invalid salt")]
    InvalidSalt,
    #[msg("Not an NFT")]
    NotAnNFT,
    #[msg("Mint authority must be None or delegated to master edition")]
    MintAuthorityNotRevoked,
    #[msg("Gift in locked state, will open on delivery date!")]
    GiftNotReadyYet,
    #[msg("Gift PDA does not own the NFT")]
    GiftPDADoesNotHaveNFT
}