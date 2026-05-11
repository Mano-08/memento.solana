// This code DOES NOT delete (close) the gift account. 
// After cancel, the account still exists on-chain, just its data changes (status set to Cancelled, and lamports/NFTs moved out).
// If, after cancel, gift account seems "not exist", it's likely your off-chain code is skipping gifts with Cancelled status, 
// or error handling is misinterpreting the account's empty lamports as being deleted (but Anchor keeps account alive unless explicitly closed).

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, BurnChecked, CloseAccount, Mint, TokenAccount, TokenInterface,
};

use anchor_spl::associated_token::AssociatedToken;
use crate::constants::{SEED_GIFT_ACCOUNT};
use crate::error::{ClaimError, GiftError};
use crate::state::{Gift, GiftStatus};

#[derive(Accounts)]
pub struct CancelGift<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut)]
    pub authorized_claimer: Signer<'info>,
    #[account(
        mut,
        seeds = [
            &SEED_GIFT_ACCOUNT,
            signer.key().as_ref(),
            &gift.index.to_le_bytes()
        ],
        bump = gift.bump,
        constraint = gift.status == GiftStatus::NotClaimed @ ClaimError::ClaimedAlready
    )]
    pub gift: Account<'info, Gift>,
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = gift,
        constraint = gift_nft_ata.amount == 1 @ ClaimError::GiftATAEmpty
    )]
    pub gift_nft_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = nft_mint.supply == 1               @ GiftError::NotAnNFT,
        constraint = nft_mint.decimals == 0             @ GiftError::NotAnNFT,
    )]
    pub nft_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn cancel_gift(ctx: Context<CancelGift>) -> Result<()> {
    let gift = &mut ctx.accounts.gift;
    let mint = &ctx.accounts.nft_mint;
    let gift_nft_ata = &ctx.accounts.gift_nft_ata;

    require!(
        gift.sender == ctx.accounts.signer.key(),
        ClaimError::Unauthorized
    );

    require!(
        ctx.accounts.authorized_claimer.key() == gift.authorized_claimer,
        ClaimError::Unauthorized
    );

    // Prepare signer seeds for PDA
    let id_bytes = gift.index.to_le_bytes();
    let bump_bytes = [gift.bump];
    let signer_seeds: &[&[u8]] = &[
        &SEED_GIFT_ACCOUNT,
        ctx.accounts.signer.key.as_ref(),
        &id_bytes,
        &bump_bytes,
    ];
    let seeds = &[signer_seeds];

    // 1. Burn the NFT
    let burn_cpi_accounts = BurnChecked {
        mint: mint.to_account_info(),
        from: gift_nft_ata.to_account_info(),
        authority: gift.to_account_info(),
    };
    let burn_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        burn_cpi_accounts,
        seeds,
    );
    token_interface::burn_checked(
        burn_ctx,
        1, // burn 1 NFT
        mint.decimals,
    )?;

    // Close the NFT ATA (escrow) and send rent to the asset_recipient
    let close_accounts = CloseAccount {
        account: ctx.accounts.gift_nft_ata.to_account_info(),
        destination: ctx.accounts.signer.to_account_info(),
        authority: gift.to_account_info(),
    };
    let close_cpi_program = ctx.accounts.token_program.to_account_info();
    let close_cpi_context: CpiContext<'_, '_, '_, '_, CloseAccount<'_>> = CpiContext::new(close_cpi_program, close_accounts)
        .with_signer(seeds);   
    token_interface::close_account(close_cpi_context)?;
    gift.status = GiftStatus::Cancelled;

    // Transfer the SOL in the Gift PDA to the asset_recipient
    let from = gift.to_account_info();
    let to = ctx.accounts.signer.to_account_info();

    **from.try_borrow_mut_lamports()? -= gift.sol_amount;
    **to.try_borrow_mut_lamports()? += gift.sol_amount;

    Ok(())
}
