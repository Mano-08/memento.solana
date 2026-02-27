use anchor_lang::prelude::*;

use crate::{constants::SEED_USER_ACCOUNT, state::User};

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,                         
        payer = signer,
        space = 8 + User::LEN,
        seeds = [&SEED_USER_ACCOUNT, signer.key().as_ref()],
        bump
    )]
    pub user: Account<'info, User>,
    
    pub system_program: Program<'info, System>,
}

pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
    let user   = &mut ctx.accounts.user;
    user.count = 0;
    user.bump  = ctx.bumps.user;
    Ok(())
}