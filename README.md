# solgift

Next.js starter with Tailwind CSS, `@solana/react-hooks`, and an Anchor vault program example.

## Getting Started

```shell
npx -y create-solana-dapp@latest -t solana-foundation/templates/kit/solgift
```

```shell
npm install   # Builds program and generates client automatically
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), connect your wallet, and interact with the vault on devnet.

## What's Included

- **Wallet connection** via `@solana/react-hooks` with auto-discovery
- **SOL Vault program** - deposit and withdraw SOL from a personal PDA vault
- **Codama-generated client** - type-safe program interactions using `@solana/kit`
- **Tailwind CSS v4** with light/dark mode

## Stack

| Layer          | Technology                              |
| -------------- | --------------------------------------- |
| Frontend       | Next.js 16, React 19, TypeScript        |
| Styling        | Tailwind CSS v4                         |
| Solana Client  | `@solana/client`, `@solana/react-hooks` |
| Program Client | Codama-generated, `@solana/kit`         |
| Program        | Anchor (Rust)                           |

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

## Deploy Your Own Vault

The included vault program is already deployed to devnet. To deploy your own:

### Prerequisites

- [Rust](https://rustup.rs/)
- [Solana CLI](https://solana.com/docs/intro/installation)
- [Anchor](https://www.anchor-lang.com/docs/installation)

### Steps

1. **Configure Solana CLI for devnet**

   ```bash
   solana config set --url devnet
   ```

2. **Create a wallet (if needed) and fund it**

   ```bash
   solana-keygen new
   solana airdrop 2
   ```

3. **Build and deploy the program**

   ```bash
   cd anchor
   anchor build
   anchor keys sync    # Updates program ID in source
   anchor build        # Rebuild with new ID
   anchor deploy
   cd ..
   ```

4. **Regenerate the client and restart**
   ```bash
   npm run setup   # Rebuilds program and regenerates client
   npm run dev
   ```

## Testing

Tests use [LiteSVM](https://github.com/LiteSVM/litesvm), a fast lightweight Solana VM for testing.

```bash
npm run anchor-build   # Build the program first
npm run anchor-test    # Run tests
```

The tests are in `anchor/programs/vault/src/tests.rs` and automatically use the program ID from `declare_id!`.

## Regenerating the Client

If you modify the program, regenerate the TypeScript client:

```bash
npm run setup   # Or: npm run anchor-build && npm run codama:js
```

This uses [Codama](https://github.com/codama-idl/codama) to generate a type-safe client from the Anchor IDL.

## Learn More

- [Solana Docs](https://solana.com/docs) - core concepts and guides
- [Anchor Docs](https://www.anchor-lang.com/docs) - program development framework
- [Deploying Programs](https://solana.com/docs/programs/deploying) - deployment guide
- [framework-kit](https://github.com/solana-foundation/framework-kit) - the React hooks used here
- [Codama](https://github.com/codama-idl/codama) - client generation from IDL

solana-test-validator --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s anchor/mpl_token_metadata.so --reset

DEADLINES:

[DONE] create user if not exist once login into supabase
[DONE] store user information
[] update frontend for demo

- [] /
- [] /create
- [] /claim
- [DONE] /dashboard

per user we have gift count: so all the gifts upto that index is claimed or not_claimed or cancelled.
db stores gift_id and encrypted question
gift_created_DB -> [gift_pda] [gift_index] [encrypted_question] [gift_sender]
gift_claimed_DB -> [claimer_wallet] [gift_pda]

TODO;

[DONE] create gift should not throw simuation failed error -> work on chain
[DONE] claim gift -> no rent or orphan account should be present
[DONE] 6. preview gift
[DONE] 1. send claimed recipeitne + gift pda to DB
[DONE] 5.a. dont close gift pda, instead add gift claimed_on details
[DONE] 8. Accept gift on same day as valid ; ex created at 530 pm, then delivery date is also 530+1 pm given its the same day
[DONE] 9. fix Wallet connector UI issue
[DONE] 4. ceaate delivery date + creted on date in DB
[DONE] 5. received gift should populate with info
[DONE] 10. build dashboard
[DONE] 3.⁠ ⁠Cron job
[DONE] 4.⁠ ⁠Claim gift (1st thing is connecr wallet)
[DONE] 6.⁠ ⁠Dashboard
[DONE] 1.⁠ ⁠Connect wallet at /create
[DONE] 2.⁠ ⁠Popup while gift creation

/ - landing page (add shiny effect [P4_DONE])
/create - toast errors [P4_DONE] + run simulation before pushing the image to Pinata [P1_DONE]
/claim - OTP for end user [P1_DONE] + loading stage while gift information is fetched [P3] + display a blurred photo + delivery date when the gift can be claimed [P1]
/dashboard - update profile picture + name [P4]
appnav - sign into supabase mandatory [P1_DONE]
cancel_gift.rs - complete the code so people can cancel gift [P1]
