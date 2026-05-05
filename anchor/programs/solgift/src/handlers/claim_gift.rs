use anchor_lang::prelude::*;
use mpl_token_metadata::accounts::MasterEdition;
use crate::constants::SEED_GIFT_ACCOUNT;
use solana_program::hash::hash;
use crate::error::{ClaimError, GiftError};
use crate::state::Gift;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked, CloseAccount};

#[event]
pub struct GiftClaimed {
    gift: Pubkey,
    claimer: Pubkey,
    claimed_on: i64
}

#[derive(Accounts)]
pub struct ClaimGift<'info> {
    #[account(mut)]
    pub authorized_claimer: Signer<'info>,
    #[account(mut)]
    pub asset_recipient: Signer<'info>,
    #[account(
        mut, 
        seeds = [&SEED_GIFT_ACCOUNT, &gift.sender.key().as_ref(), &gift.index.to_le_bytes()],
        bump = gift.bump,
        constraint = gift.claimed == false @ ClaimError::ClaimedAlready,
        constraint = gift.authorized_claimer == authorized_claimer.key() @ ClaimError::UnauthorizedClaimer
    )]
    pub gift: Account<'info, Gift>,
    #[account(
        constraint = nft_mint.supply == 1               @ GiftError::NotAnNFT,
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

pub fn claim_gift(ctx: Context<ClaimGift>, answer_hash_n_1: [u8; 32]) -> Result<()> {
    let mint = &ctx.accounts.nft_mint;
    let (master_edition_pda, _) = MasterEdition::find_pda(&mint.key());
    let mint_authority = mint.mint_authority;
    require!(
        mint_authority == Option::None.into() 
            || mint_authority == Option::Some(master_edition_pda).into(),
        GiftError::MintAuthorityNotRevoked
    );
    
    let gift = &mut ctx.accounts.gift;
    let current_time = Clock::get()?.unix_timestamp;

    // Check if the gift can be claimed yet (delivery date reached)
    require!(
        current_time >= gift.delivery_date,
        GiftError::GiftNotReadyYet
    );

    // Hash the provided answer and compare it with the stored answer_hash
    let claimed_answer_hash: [u8; 32] = hash(&answer_hash_n_1).to_bytes();    
    require!(
        claimed_answer_hash == gift.answer_hash, 
        ClaimError::InvalidAnswer
    );

    let id_bytes = gift.index.to_le_bytes();
    let bump_bytes = [gift.bump];
    let signer_seeds: &[&[&[u8]]] = &[&[
        &SEED_GIFT_ACCOUNT, 
        gift.sender.as_ref(), 
        id_bytes.as_ref(), 
        bump_bytes.as_ref() 
    ]];
    
    
    let cpi_accounts = TransferChecked {
        mint: mint.to_account_info(),
        from: ctx.accounts.gift_nft_ata.to_account_info(),
        to: ctx.accounts.asset_recipient_nft_ata.to_account_info(),
        authority: gift.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts)
        .with_signer(signer_seeds);
    let decimals = mint.decimals;
    token_interface::transfer_checked(cpi_context, 1, decimals)?;

    // Close the NFT ATA (escrow) and send rent to the asset_recipient
    let close_accounts = CloseAccount {
        account: ctx.accounts.gift_nft_ata.to_account_info(),
        destination: ctx.accounts.asset_recipient.to_account_info(),
        authority: gift.to_account_info(),
    };
    let close_cpi_program = ctx.accounts.token_program.to_account_info();
    let close_cpi_context = CpiContext::new(close_cpi_program, close_accounts)
        .with_signer(signer_seeds);   
    token_interface::close_account(close_cpi_context)?;

    // Transfer the SOL in the Gift PDA to the asset_recipient
    let from = gift.to_account_info();
    let to = ctx.accounts.asset_recipient.to_account_info();

    **from.try_borrow_mut_lamports()? -= gift.sol_amount;
    **to.try_borrow_mut_lamports()? += gift.sol_amount;

    // Mark gift as claimed and store claim time
    gift.claimed = true;
    gift.claimed_on = current_time;
    gift.asset_recipient = *ctx.accounts.asset_recipient.key;
    
    // Emit the GiftClaimed event
    emit!(GiftClaimed {
        gift: gift.key(),
        claimer: ctx.accounts.authorized_claimer.key(),
        claimed_on: current_time
    });

    Ok(())
}

// ------------------------------------------------------------------------------------------------
// What does the claim_gift function do?
//
// - Checks the current time to ensure that the delivery date has passed before allowing claim
// - Verifies the provided answer matches the stored answer hash for added security/privacy
// - Uses PDA-derived authority to transfer the escrowed NFT from the gift account to the asset_recipient's token account
// - Closes the NFT escrowed account (PDA's ATA) and refunds rent to the recipient
// - Transfers the associated SOL from the gift PDA to the asset_recipient
// - Marks the gift as claimed and records the timestamp
// - Emits a GiftClaimed event for off-chain tracking and notifications