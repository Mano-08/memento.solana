use anchor_lang::prelude::*;

#[account]
pub struct User {
    pub count: u16,     // 2 Bytes
    pub bump: u8        // 1 Byte
}

impl User {
    pub const LEN: usize = 
        2 +             // count: 2 Bytes 
        1;              // bump: 1 Byte
                        // total: 3 Bytes
}