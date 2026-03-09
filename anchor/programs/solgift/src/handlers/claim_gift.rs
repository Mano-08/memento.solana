use anchor_lang::prelude::*;
use crate::constants::SEED_GIFT_ACCOUNT;
use solana_program::hash::hash;
use crate::error::ClaimError;
use crate::state::Gift;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked};

#[event]
pub struct GiftClaimed {
    gift: Pubkey,
    claimer: Pubkey,
}

#[derive(Accounts)]
pub struct ClaimGift<'info> {
    #[account(mut)]
    pub authorized_claimer: Signer<'info>,
    #[account(mut)]
    pub asset_recipient: Signer<'info>,
    #[account(
        mut, 
        close = asset_recipient,
        seeds = [&SEED_GIFT_ACCOUNT, &gift.sender.key().as_ref(), &gift.index.to_le_bytes()],
        bump = gift.bump,
        has_one = nft_mint @ ClaimError::IncorrectNFTMint,
        constraint = !gift.claimed @ ClaimError::ClaimedAlready,
        constraint = gift.authorized_claimer == authorized_claimer.key() @ ClaimError::UnauthorizedClaimer
    )]
    pub gift: Account<'info, Gift>,
    pub nft_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = gift,
        constraint = gift_nft_ata.amount == 1 @ ClaimError::GiftATAEmpty,
    )]
    pub gift_nft_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = authorized_claimer,
        associated_token::mint = nft_mint,
        associated_token::authority = asset_recipient,
    )]
    pub asset_recipient_nft_ata: InterfaceAccount<'info, TokenAccount>,
    
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn claim_gift(ctx: Context<ClaimGift>, answer_hash: [u8; 32]) -> Result<()> {
    let gift = &mut ctx.accounts.gift;
    let claimed_answer_hash: [u8; 32] = hash(&answer_hash).to_bytes();    
    
    require!(claimed_answer_hash == gift.answer_hash, ClaimError::InvalidAnswer);
    
    let id_bytes = gift.index.to_le_bytes();
    let bump_bytes = [gift.bump];
    let signer_seeds: &[&[&[u8]]] = &[&[&SEED_GIFT_ACCOUNT, gift.sender.as_ref(), id_bytes.as_ref(), bump_bytes.as_ref()]];
    
    let cpi_accounts = TransferChecked {
        mint: ctx.accounts.nft_mint.to_account_info(),
        from: ctx.accounts.gift_nft_ata.to_account_info(),
        to: ctx.accounts.asset_recipient_nft_ata.to_account_info(),
        authority: gift.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts).with_signer(signer_seeds);
    let decimals = ctx.accounts.nft_mint.decimals;
    token_interface::transfer_checked(cpi_context, 1, decimals)?;
    
    gift.claimed = true;

    // Initialize and emit the GiftClaimed event here after gift.claimed = true;
    emit!(GiftClaimed {
        gift: gift.key(),
        claimer: ctx.accounts.authorized_claimer.key(),
    });
    
    Ok(())
}