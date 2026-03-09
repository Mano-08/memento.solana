use anchor_lang::prelude::*;


#[account]
pub struct Gift {
    pub delivery_date: u64,          // 8 Bytes         
    pub created_on: u64,        // 8 Bytes    
    pub salt: [u8; 32],         // 32 Bytes
    pub sender: Pubkey,         // 32 Bytes
    pub authorized_claimer: Pubkey,       // 32 Bytes
    pub index: u16,                // 2 Bytes
    pub answer_hash: [u8; 32],  // 32 Bytes
    pub nft_mint: Pubkey,       // 32 Bytes
    pub claimed: bool,          // 1 Byte
    pub sol_amount: u64,        // 8 Bytes
    pub bump: u8                // 1 Byte
}

impl Gift {
    pub const LEN: usize =
        8 +     // delivery_date 64 bits = 8 Bytes
        8 +     // created_on 64 bits = 8 Bytes
        32 +    // salt 32 Bytes
        32 +    // sender 32 Bytes
        32 +    // authorized_claimer 32 Bytes
        2 +     // index 16 bits = 2 Bytes
        32 +    // answer_hash 32 Bytes
        32 +    // nft_mint 32 Bytes
        1 +     // claimed 8 bits = 1 Byte
        8 +     // sol_amount 64 bits = 8 Byte
        1;      // bump 8 bits = 1 Byte
                // total = 188 Bytes
}