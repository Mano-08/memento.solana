// use anchor_lang::prelude::*;
// use anchor_spl::token_interface::{
//     self, BurnChecked, CloseAccount, Mint, TokenAccount, TokenInterface,
// };
// use anchor_spl::associated_token::AssociatedToken;
// use crate::constants::{SEED_GIFT_ACCOUNT, SEED_USER_ACCOUNT};
// use crate::state::{Gift, User};

// #[derive(Accounts)]
// pub struct CancelGift<'info> {
//     #[account(mut)]
//     pub signer: Signer<'info>,

//     #[account(
//         mut,
//         seeds = [&SEED_USER_ACCOUNT, signer.key().as_ref()],
//         bump
//     )]
//     pub user: Account<'info, User>,

//     #[account(
//         mut,
//         close = signer,
//         seeds = [
//             &SEED_GIFT_ACCOUNT,
//             signer.key().as_ref(),
//             &gift.index.to_le_bytes()
//         ],
//         bump = gift.bump,
//         has_one = nft_mint,
//         has_one = sender,
//     )]
//     pub gift: Account<'info, Gift>,

//     #[account(
//         mut,
//         associated_token::mint = nft_mint,
//         associated_token::authority = gift,
//         constraint = gift_nft_ata.amount == 1 @ crate::error::GiftError::GiftATAEmpty
//     )]
//     pub gift_nft_ata: InterfaceAccount<'info, TokenAccount>,

//     /// CHECK: can be any valid mint, security checked by constraint on gift
//     pub nft_mint: InterfaceAccount<'info, Mint>,

//     pub sender: SystemAccount<'info>,

//     pub token_program: Interface<'info, TokenInterface>,
//     pub associated_token_program: Program<'info, AssociatedToken>,
// }

// pub fn cancel_gift(ctx: Context<CancelGift>) -> Result<()> {
//     let gift = &ctx.accounts.gift;
//     let mint = &ctx.accounts.nft_mint;
//     let gift_nft_ata = &ctx.accounts.gift_nft_ata;

//     // Burn the NFT in the gift's token account, using the gift account as signer.
//     let id_bytes = gift.index.to_le_bytes();
//     let bump_bytes = [gift.bump];
//     let signer_seeds: &[&[u8]] = &[
//         &SEED_GIFT_ACCOUNT,
//         ctx.accounts.signer.key.as_ref(),
//         &id_bytes,
//         &bump_bytes,
//     ];

//     let burn_cpi_accounts = BurnChecked {
//         mint: mint.to_account_info(),
//         from: gift_nft_ata.to_account_info(),
//         authority: gift.to_account_info(),
//     };

//     let cpi_ctx = CpiContext::new_with_signer(
//         ctx.accounts.token_program.to_account_info(),
//         burn_cpi_accounts,
//         &[signer_seeds],
//     );

//     token_interface::burn_checked(
//         cpi_ctx,
//         1, // burn 1 NFT
//         mint.decimals,
//     )?;

//     // Close the gift_nft_ata, sending the rent back to signer.
//     let close_cpi_accounts = CloseAccount {
//         account: gift_nft_ata.to_account_info(),
//         destination: ctx.accounts.signer.to_account_info(),
//         authority: gift.to_account_info(),
//     };
//     let close_cpi_ctx = CpiContext::new_with_signer(
//         ctx.accounts.token_program.to_account_info(),
//         close_cpi_accounts,
//         &[signer_seeds],
//     );
//     token_interface::close_account(close_cpi_ctx)?;

//     Ok(())
// }