use anchor_lang::prelude::*;

#[account]
pub struct Gift {
    pub delivery_date:         i64,                 // 8 Bytes
    pub created_on:            i64,                 // 8 Bytes
    pub salt:                  [u8; 32],            // 32 Bytes
    pub sender:                Pubkey,              // 32 Bytes
    pub authorized_claimer:    Pubkey,              // 32 Bytes
    pub asset_recipient:       Option<Pubkey>,      // 32 + 1 Bytes
    pub index:                 u16,                 // 2 Bytes
    pub answer_hash:           [u8; 32],            // 32 Bytes
    pub nft_mint:              Pubkey,              // 32 Bytes
    pub claimed:               bool,                // 1 Byte
    pub sol_amount:            u64,                 // 8 Bytes
    pub claimed_on:            Option<i64>,         // 8 Bytes + 1 Byte
    pub bump:                  u8                   // 1 Byte
}

impl Gift {
    pub const LEN: usize =
        8   +    // delivery_date:         i64               = 8 Bytes
        8   +    // created_on:            i64               = 8 Bytes
        32  +    // salt:                  [u8; 32]          = 32 Bytes
        32  +    // sender:                Pubkey            = 32 Bytes
        32  +    // authorized_claimer:    Pubkey            = 32 Bytes
        32  + 1+ // asset_recipient:       Option<Pubkey>    = 32 + 1 Bytes (Option)
        2   +    // index:                 u16               = 2 Bytes
        32  +    // answer_hash:           [u8; 32]          = 32 Bytes
        32  +    // nft_mint:              Pubkey            = 32 Bytes
        1   +    // claimed:               bool              = 1 Byte
        8   +    // sol_amount:            u64               = 8 Bytes
        8   + 1+ // claimed_on:            Option<i64>       = 8 + 1 Bytes (Option)
        1;       // bump:                  u8                = 1 Byte
                 // total = 197 Bytes
}