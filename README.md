# Memento

### Gift moments and memories, wrapped in time capsule to deliver at the perfect time.

---

Memento is a decentralized platform that lets you create time-locked gifts combining heartfelt photos, cryptocurrency, and scheduled delivery. Wrap your memories in a cryptographic time capsule that reveals itself exactly when you intend it to.

## Key Features:

Photo Memories – Attach photos capturing your shared moments
Crypto Gifts – Add SOL or other funds to your gift
Time-Locked Delivery – Set an exact reveal date
Secure Claiming – Cryptographic security ensures only the intended recipient can claim
Email Notifications – Automated delivery notifications when gifts are ready
Gift Cancellation – Cancel unclaimed gifts and reclaim your funds

---

## How It Works

### Part 1: Gift Creation

#### Create Your Gift

Upload a photo of your shared moments
Add SOL funds to the gift
Set a reveal date for delivery

#### On-Chain Tracking

Each user has an on-chain account tracking their gift count
New gifts are indexed by this count (auto-incremented)
Gifts are uniquely identified by (user_account, gift_index)

#### NFT Minting & Fund Escrow

An NFT is minted and stored in the Gift NFT Associated Token Account (ATA)
Funds are held securely by the gift PDA (Program Derived Address)

#### Recipient Authorization Setup

Enter the recipient's email address
Generate a random salt
Set a security question the recipient knows the answer to
Hash email + salt + answer to create an Ed25519 private key
Fund this derived wallet with SOL for claiming gas fees

#### Secure Storage

Security question is encrypted and stored in Supabase DB
pg_cron runs daily to check delivery dates
Edge functions send email notifications when gifts are ready

---

### Gift Claiming

#### Email Verification

Recipient receives email notification on the reveal date
Prompted to verify email address via OTP

#### Security Question

Encrypted security question is decrypted and displayed
Recipient answers the question

#### Keypair Derivation

System derives the authorized keypair using email + salt + answer
Validates the recipient's identity cryptographically

#### Claim the Gift

Recipient connects their wallet (Privy or any Web3 wallet)
Receives the NFT and funds from the gift PDA

---

### Gift Cancellation

Users can cancel gifts under the following conditions:

- Gift has not been claimed
- Gift has not been previously cancelled

#### What Happens on Cancellation:

All funds are returned to the gift creator
The NFT is burned
All associated rent from empty accounts is reclaimed

---

## Security Model

Memento uses a multi-layered security approach:

Cryptographic Derivation: Recipient wallet is derived from hash(email + salt + answer), ensuring only someone with all three pieces can claim
On-Chain Escrow: Funds are locked in a PDA controlled by smart contract logic
Encrypted Storage: Security questions are encrypted at rest in Supabase
OTP Verification: Email ownership verified before revealing security question
Time-Locks: Gifts cannot be claimed before the reveal date

---

## Getting Started

```shell
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), connect your wallet, and interact with the vault on devnet.

## Stack

| Layer                   | Technology                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Frontend                | Next.js 16, React 19, TypeScript Privy (or any Web3 wallet) – Wallet connection for claiming |
| Styling                 | Tailwind CSS v4                                                                              |
| Solana Client           | `@solana/client`, `@solana/react-hooks`                                                      |
| Program Client          | Codama-generated, `@solana/kit`                                                              |
| Program                 | Anchor (Rust)                                                                                |
| Supabase                | Database for encrypted security questions,                                                   |
| pg_cron                 | Scheduled task runner for daily gift delivery checks                                         |
| Supabase Edge Functions | for serverless email delivery on reveal dates                                                |

–

## Project Structure

```
├── app/
│   ├── components/
│   │   ├── providers.tsx      # Solana client setup
│   │   └── vault-card.tsx     # Vault deposit/withdraw UI
│   ├── generated/vault/       # Codama-generated program client
│   └── page.tsx               # Main page
├── anchor/                    # Anchor workspace
│   └── programs/vault/        # Vault program (Rust)
└── codama.json                # Codama client generation config
```
