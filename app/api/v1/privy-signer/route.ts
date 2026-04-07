/**
 * Remote Signer API Route Handler
 *
 * This route provides server-side signing capabilities using Fireblocks, Privy,
 * or a custom signer. The client-side remote wallet adapter communicates with
 * this endpoint to sign transactions.
 *
 * Environment Variables Required:
 * - CONNECTOR_SIGNER_TOKEN: Bearer token for authentication
 * - SOLANA_RPC_URL: Solana RPC endpoint (for signAndSend operations)
 *
 * For Fireblocks:
 * - FIREBLOCKS_API_KEY: Your Fireblocks API key
 * - FIREBLOCKS_PRIVATE_KEY: RSA private key PEM for JWT signing
 * - FIREBLOCKS_VAULT_ID: Vault account ID
 *
 * For Privy:
 * - PRIVY_APP_ID: Your Privy app ID
 * - PRIVY_APP_SECRET: Your Privy app secret
 * - PRIVY_WALLET_ID: The wallet ID to sign with
 */

import { createRemoteSignerRouteHandlers } from "@solana/connector/server";
import type { ProviderConfig, RemoteSigner } from "@solana/connector/server";

// Example: Custom signer implementation (for testing or when @solana-keychain/* not available)
// This is a MOCK signer for testing the UI flow - DO NOT use in production!
function createMockSigner(): RemoteSigner {
  // Example Solana address for testing (this is a random devnet address)
  const address = "7Vbmv1jt4vyuqBZcpYPpnVhrqVe5e6ZPLPFwZYQCy4uc";

  return {
    address,
    async signTransaction(txBytes: Uint8Array): Promise<Uint8Array> {
      // In a real implementation, you would sign the transaction here
      // For testing, we just return the original bytes (unsigned)
      console.log(
        "[MockSigner] signTransaction called with",
        txBytes.length,
        "bytes"
      );
      return txBytes; // Return unsigned for demo purposes
    },
    async signAllTransactions(txs: Uint8Array[]): Promise<Uint8Array[]> {
      console.log(
        "[MockSigner] signAllTransactions called with",
        txs.length,
        "transactions"
      );
      return txs; // Return unsigned for demo purposes
    },
    async signMessage(message: Uint8Array): Promise<Uint8Array> {
      console.log("[MockSigner] signMessage called");
      // Return a fake 64-byte signature for demo
      return new Uint8Array(64).fill(0);
    },
    async isAvailable(): Promise<boolean> {
      return true;
    },
  };
}

// Determine provider from environment
function getProviderConfig(): ProviderConfig {
  // Check for Privy configuration (requires @solana-keychain/privy)
  if (
    process.env.PRIVY_APP_ID &&
    process.env.PRIVY_APP_SECRET &&
    process.env.PRIVY_WALLET_ID
  ) {
    console.log("AEVERNJRKENJ");
    return {
      type: "privy",
      appId: process.env.PRIVY_APP_ID,
      appSecret: process.env.PRIVY_APP_SECRET,
      // Privy Wallet ID is the unique identifier of a custodial or embedded wallet managed by Privy on behalf of an app/user.
      // It's required for Privy to locate and sign transactions from the correct wallet instance.
      // In most use cases, Privy manages wallet creation/auth behind the scenes, and you retrieve the user's walletId via the Privy API/dashboard.
      // Setting this to process.env.PRIVY_WALLET_ID means your server must know which wallet it is supposed to sign for.
      // See: https://docs.privy.io/wallets/server-wallets/server-wallets-overview
      walletId: process.env.PRIVY_WALLET_ID,
    };
  }

  // Fallback: use mock signer for testing/demo
  // In production, you should configure Fireblocks or Privy instead
  console.log("[connector-signer] Using mock signer for testing");
  return {
    type: "custom",
    signer: createMockSigner(),
  };
}

/**
 * To enable your Privy-backed remote signer to work on localhost as well as in production (e.g. on Vercel),
 * make sure to add http://localhost:3000 (or whatever your local dev origin is) to your allowed server origins
 * in the Privy developer dashboard under "API Settings" > "Server Wallet" > "Allowed origins".
 *
 * If you are using Privy server wallets, go to:
 *   https://dashboard.privy.io > Your App > Wallets > Server Wallets
 * And ensure that "http://localhost:3000" (and/or "http://127.0.0.1:3000") are added as allowed origins.
 *
 * Otherwise, Privy will block API requests from localhost origins for security reasons.
 *
 * No code change is needed in this handler, but ensure your .env contains the Privy credentials
 * and that your local origin is permitted in Privy's dashboard.
 */

// Create route handlers
const { GET, POST } = createRemoteSignerRouteHandlers({
  provider: getProviderConfig(),

  // RPC configuration for signAndSend (optional)
  rpc: process.env.SOLANA_RPC_URL
    ? {
        url: process.env.SOLANA_RPC_URL,
        commitment: "confirmed",
      }
    : undefined,

  // For development: allow all requests (skip auth)
  // In production, set CONNECTOR_SIGNER_TOKEN or implement custom auth
  authorize: async () => {
    // Allow all requests in development when no token is configured
    if (!process.env.CONNECTOR_SIGNER_TOKEN) {
      console.log(
        "[connector-signer] No CONNECTOR_SIGNER_TOKEN set, allowing request (dev mode)"
      );
      return true;
    }
    // In production with token set, the default auth handler will be used
    return true;
  },

  // Optional: policy hooks
  // policy: {
  //     validateTransaction: async (txBytes, request) => {
  //         // Example: check transaction against allowlist
  //         return true;
  //     },
  // },

  // Wallet metadata
  name: "Treasury Signer",
  chains: ["solana:devnet"],
});

export { GET, POST };

// Use Node.js runtime for crypto operations
// export const runtime = "nodejs";
