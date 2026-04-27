use anchor_lang::prelude::*;
use crate::constants::SEED_GIFT_ACCOUNT;
use crate::constants::SEED_USER_ACCOUNT;
use crate::error::ClaimError;
use crate::error::GiftError;
use crate::state::Gift;
use crate::state::User;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::{token_interface::{Mint, TokenInterface,TokenAccount}};

#[event]
pub struct GiftCreated {
    gift: Pubkey,
    sender: Pubkey,
    authorized_claimer: Pubkey,
    created_on: i64,
    idx: u16
}

#[derive(Accounts)]
pub struct CreateGift<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + User::LEN,
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
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = gift,
        constraint = gift_nft_ata.amount == 1 @ ClaimError::GiftATAEmpty,
    )]
    pub gift_nft_ata: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn create_gift(ctx: Context<CreateGift>, salt: [u8; 32], answer_hash: [u8; 32], sol_amount: u64, delivery_date: i64, authorized_claimer: Pubkey) -> Result<()> {
    require!(sol_amount >= 1_000_000, GiftError::BelowMinimumAmount);
    require!(
        authorized_claimer != Pubkey::default(),
        GiftError::InvalidReceiver
    );
    require!(
        authorized_claimer != ctx.accounts.signer.key(),
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
    let gift_nft_ata = &ctx.accounts.gift_nft_ata;
    let mint = &ctx.accounts.nft_mint;
    require!(
        gift_nft_ata.mint == mint.key(),
        GiftError::GiftPDADoesNotHaveNFT
    );
    require!(
        gift_nft_ata.amount == 1,
        GiftError::GiftPDADoesNotHaveNFT
    );
    let gift = &mut ctx.accounts.gift;
    let user = &mut ctx.accounts.user;
    gift.created_on = Clock::get()?.unix_timestamp as i64;
    const TIMEZONE_BUFFER: i64 = 86400;
    require!(
        delivery_date >= (gift.created_on - TIMEZONE_BUFFER),
        GiftError::CannotGiftToPast
    );
    gift.answer_hash = answer_hash;
    gift.salt = salt;
    gift.delivery_date = delivery_date;
    gift.sol_amount = sol_amount;
    gift.sender = ctx.accounts.signer.key();
    gift.authorized_claimer = authorized_claimer;
    gift.index = user.count;
    gift.bump = ctx.bumps.gift;
    gift.claimed = false;
    user.count += 1;

    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.signer.to_account_info().clone(),
            to: gift.to_account_info().clone(),
        },
    );
    
    system_program::transfer(cpi_context, sol_amount)?;

    emit!(GiftCreated {
        gift: gift.key(),
        sender: ctx.accounts.signer.key(),
        authorized_claimer,
        created_on: gift.created_on,
       idx: gift.index
    });

    Ok(())
}