use anchor_lang::prelude::*;
use crate::constants::SEED_GIFT_ACCOUNT;
use crate::constants::SEED_USER_ACCOUNT;
use crate::error::GiftError;
use crate::state::Gift;
use crate::state::User;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::{
    token_interface::{Mint, TokenInterface},
};

#[event]
pub struct GiftCreated {
    gift: Pubkey,
    sender: Pubkey,
    receiver: Pubkey,
    created_on: u64,
}

#[derive(Accounts)]
pub struct CreateGift<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [&SEED_USER_ACCOUNT, signer.key().as_ref()],
        bump
    )]
    pub user: Account<'info, User>,
    #[account(
        init,
        payer = signer,
        space = 8 + Gift::LEN,
        seeds = [
            &SEED_GIFT_ACCOUNT,
            signer.key().as_ref(),
            &user.count.to_le_bytes()
        ],
        bump
    )]
    pub gift: Account<'info, Gift>,
    #[account(
        constraint = nft_mint.supply == 1               @ GiftError::NotAnNFT,
        constraint = nft_mint.mint_authority.is_none()  @ GiftError::MintAuthorityNotRevoked,
        constraint = nft_mint.decimals == 0             @ GiftError::NotAnNFT,
    )]
    pub nft_mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn create_gift(ctx: Context<CreateGift>, salt: [u8; 32], answer_hash: [u8; 32], sol_amount: u64, delivery_date: u64, receiver: Pubkey) -> Result<()> {
    require!(sol_amount >= 1_000_000, GiftError::BelowMinimumAmount);
    require!(
        receiver != Pubkey::default(),
        GiftError::InvalidReceiver
    );
    require!(
        delivery_date > ctx.accounts.gift.created_on,
        GiftError::DeliveryDateMustBeInFuture
    );
    require!(
        receiver != ctx.accounts.signer.key(),
        GiftError::CannotGiftToSelf 
    );
    require!(
        answer_hash != [0u8; 32],
        GiftError::InvalidAnswerHash
    );
    require!(
        salt != [0u8; 32],
        GiftError::InvalidSalt
    );
    require!(
        ctx.accounts.nft_mint.mint_authority.is_none(),
        GiftError::MintAuthorityNotRevoked
    );
    require!(
        ctx.accounts.nft_mint.supply == 1,
        GiftError::NotAnNFT
    );
    let gift = &mut ctx.accounts.gift;
    let user = &mut ctx.accounts.user;
    gift.created_on = Clock::get()?.unix_timestamp as u64;
    require!(gift.created_on < delivery_date, GiftError::CannotGiftToPast);
    gift.answer_hash = answer_hash;
    gift.salt = salt;
    gift.nft_mint = ctx.accounts.nft_mint.key();
    gift.delivery_date = delivery_date;
    gift.sol_amount = sol_amount;
    gift.sender = ctx.accounts.signer.key();
    gift.receiver = receiver;
    gift.id = user.count;
    gift.bump = ctx.bumps.gift;
    gift.claimed = false;
    user.count += 1;

    // Transfer SOL from sender's wallet to gift's wallet
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.signer.to_account_info(),
            to: gift.to_account_info(),
        },
    );
    
    system_program::transfer(cpi_context, sol_amount)?;

    emit!(GiftCreated {
        gift: gift.key(),
        sender: ctx.accounts.signer.key(),
        receiver,
        created_on: gift.created_on,
    });

    Ok(())
}