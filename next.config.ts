import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "ws",
    "@solana/keychain-core",
    "@solana/keychain-fireblocks",
    "@solana/keychain-privy",
    "@solana/keychain-turnkey",
    "@solana/keychain-vault",
    "@solana/keychain-aws-kms",
    "pino",
    "pino-pretty",
    "thread-stream",
  ],
};

export default nextConfig;
