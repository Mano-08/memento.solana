pub mod constants;
pub mod error;
pub mod handlers;
pub mod state;

use anchor_lang::prelude::*;
use handlers::*;

declare_id!("3fCgi4YN5inwKcxs4BbMtz4k62HoUsJG29Q9bHpL5xpx");

#[program]
pub mod solgift {
    use super::*;

    pub fn create_gift(ctx: Context<CreateGift>, salt: [u8; 32], answer_hash: [u8; 32], sol_amount: u64, delivery_date: u64, receiver: Pubkey) -> Result<()> {
        handlers::create_gift::create_gift(ctx, salt, answer_hash, sol_amount, delivery_date, receiver)
    }
    
    pub fn claim_gift(ctx: Context<ClaimGift>, answer_hash: [u8; 32]) -> Result<()> {
        handlers::claim_gift::claim_gift(ctx, answer_hash)
    }

    pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
        handlers::initialize_user::initialize_user(ctx)
    }

    // TODO:
    // pub fn destroy_gift()
}