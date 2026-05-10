use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, BurnChecked, CloseAccount, Mint, TokenAccount, TokenInterface,
};

use anchor_spl::associated_token::AssociatedToken;
use crate::constants::{SEED_GIFT_ACCOUNT, SEED_USER_ACCOUNT};
use crate::error::ClaimError;
use crate::state::{Gift, User};

#[derive(Accounts)]
pub struct CancelGift<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [&SEED_USER_ACCOUNT, signer.key().as_ref()],
        bump
    )]
    pub user: Account<'info, User>,
    #[account(
        mut,
        seeds = [
            &SEED_GIFT_ACCOUNT,
            signer.key().as_ref(),
            &gift.index.to_le_bytes()
        ],
        close = signer,
        bump = gift.bump,
        has_one = sender,
        constraint = gift.claimed == false @ ClaimError::ClaimedAlready
    )]
    pub gift: Account<'info, Gift>,
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = gift,
        constraint = gift_nft_ata.amount == 1 @ ClaimError::GiftATAEmpty
    )]
    pub gift_nft_ata: InterfaceAccount<'info, TokenAccount>,
    pub nft_mint: InterfaceAccount<'info, Mint>,

    pub sender: SystemAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

// TODO: Additional destruction and cleanup for full NFT cancellation
//
// In your JS client (see create/page.tsx lines 682-1067), you create *more than just* a mint and an ATA on-chain when wrapping a gift as an NFT. 
// These must ideally be cleaned up to fully "destroy" the NFT gift on Solana:
//   - The NFT Mint account itself: Closed (if burnable and no supply left)
//   - Metaplex Metadata account (`metadataPda`): Must be closed/removed for full erasure (not handled by SPL, requires using the Metaplex token-metadata program).
//   - Master Edition account (`masterEditionPda`): Should also be closed if possible after burn (using token-metadata program).
//   - Gift PDA account: This Anchor account *is* closed by your account constraint.
//
// Steps for a truly complete cleanup/cancellation would be:
// 1. Burn the NFT (done)
// 2. Close the gift's ATA (done)
// 3. Optionally: Close (delete) the NFT mint (if possible)
// 4. Optionally: Close Metadata account
// 5. Optionally: Close Master Edition account
//
// Note: The Metaplex program (which handles Metadata/MasterEdition) does NOT allow simple closes by default for these accounts. 
// It may require custom CPI or supporting instructions (e.g., `burn_nft` in token-metadata program v1.13+).
//
// In summary: 
// - Burning and closing the ATA prevents further use of the NFT
// - But the Mint, Metadata and MasterEdition accounts will *still exist* unless specifically closed (and rent not recovered)
//
// For simple "cancel gift" you are on the right track, but for complete chain hygiene/additional rent recovery, consider cleaning up those extra accounts.
pub fn cancel_gift(ctx: Context<CancelGift>) -> Result<()> {
    let gift = &ctx.accounts.gift;
    let mint = &ctx.accounts.nft_mint;
    let gift_nft_ata = &ctx.accounts.gift_nft_ata;
    let signer = &ctx.accounts.signer;

    // Prepare signer seeds for PDA
    let id_bytes = gift.index.to_le_bytes();
    let bump_bytes = [gift.bump];
    let signer_seeds: &[&[u8]] = &[
        &SEED_GIFT_ACCOUNT,
        ctx.accounts.sender.key.as_ref(),
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

    // 2. Close the gift's NFT ATA, sending the rent to the signer.
    let close_cpi_accounts = CloseAccount {
        account: gift_nft_ata.to_account_info(),
        destination: signer.to_account_info(),
        authority: gift.to_account_info(),
    };
    let close_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        close_cpi_accounts,
        seeds,
    );
    token_interface::close_account(close_ctx)?;

    Ok(())
}