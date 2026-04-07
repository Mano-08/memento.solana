use anchor_lang::prelude::*;

#[account]
pub struct User {
    pub count: u16,     // 2 Bytes
}

impl User {
    pub const LEN: usize = 
        2;               // count: 2 Bytes 
                        // total: 2 Bytes
}