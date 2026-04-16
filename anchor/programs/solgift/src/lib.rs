pub mod constants;
pub mod error;
pub mod handlers;
pub mod state;

use anchor_lang::prelude::*;
use handlers::*;

declare_id!("Eb7kAScrjEpmxRmvSScSisev4VRWam7GserKaUTa12zq");

#[program]
pub mod solgift {
    use super::*;

    pub fn create_gift(ctx: Context<CreateGift>, salt: [u8; 32], answer_hash: [u8; 32], sol_amount: u64, delivery_date: i64, authorized_claimer: Pubkey) -> Result<()> {
        handlers::create_gift::create_gift(ctx, salt, answer_hash, sol_amount, delivery_date, authorized_claimer)
    }
    
    pub fn claim_gift(ctx: Context<ClaimGift>, answer_hash: [u8; 32]) -> Result<()> {
        handlers::claim_gift::claim_gift(ctx, answer_hash)
    }

    pub fn cancel_gift(ctx: Context<CancelGift>) -> Result<()> {
        handlers::cancel_gift(ctx)
    }

   

    // TODO:
    // pub fn destroy_gift()
}