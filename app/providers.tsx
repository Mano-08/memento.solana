"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import {
  AppProvider,
  getDefaultConfig,
  getDefaultMobileConfig,
} from "@solana/connector/react";
import { useCreateWallet } from "@privy-io/react-auth/solana";

import { createRemoteSignerWallet } from "@solana/connector/remote";
import { SolanaProvider } from "@solana/react-hooks";

const getOrigin = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000";
};

import { PrivyProvider } from "@privy-io/react-auth";

// Enable remote signer via environment variable (set NEXT_PUBLIC_ENABLE_REMOTE_SIGNER=true)
// For testing, default to true if not explicitly set to 'false'
const ENABLE_REMOTE_SIGNER = true;
// process.env.NEXT_PUBLIC_ENABLE_REMOTE_SIGNER !== "false";

export function Providers({ children }: { children: ReactNode }) {
  const connectorConfig = useMemo(() => {
    const origin = getOrigin();

    // Use RPC proxy to keep API keys server-side
    const rpcProxyUrl = `${origin}/api/v1/rpc`;

    const clusters = [
      {
        id: "solana:mainnet" as const,
        label: "Mainnet",
        name: "mainnet-beta" as const,
        url: rpcProxyUrl,
      },
      {
        id: "solana:devnet" as const,
        label: "Devnet",
        name: "devnet" as const,
        url: "https://api.devnet.solana.com",
      },
      {
        id: "solana:testnet" as const,
        label: "Testnet",
        name: "testnet" as const,
        url: "https://api.testnet.solana.com",
      },
    ];

    // Create remote signer wallet if enabled
    // This wallet delegates signing to the /api/privy-signer endpoint
    console.log("origin", origin);

    return getDefaultConfig({
      appName: "ConnectorKit Example",
      appUrl: origin,
      autoConnect: true,
      enableMobile: true,
      clusters,
      additionalWallets: undefined,
      // WalletConnect: just set to true!
      // Project ID is auto-read from NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
      // Metadata is auto-generated from appName/appUrl
      // Callbacks are auto-wired by AppProvider
      walletConnect: true,
    });
  }, []);

  const mobile = useMemo(
    () =>
      getDefaultMobileConfig({
        appName: "ConnectorKit Example",
        appUrl: getOrigin(),
      }),
    []
  );

  // Mount devtools in development mode
  // useEffect(() => {
  //   if (process.env.NODE_ENV !== "development") return;

  //   let devtools:
  //     | { mount: (el: HTMLElement) => void; unmount: () => void }
  //     | undefined;
  //   let container: HTMLDivElement | undefined;

  //   // // Dynamic import to avoid bundling in production
  //   // import("@solana/devtools").then(({ ConnectorDevtools }) => {
  //   //   // Create container for devtools
  //   //   container = document.createElement("div");
  //   //   container.id = "connector-devtools-container";
  //   //   document.body.appendChild(container);

  //   //   // Create and mount devtools (auto-detects window.__connectorClient)
  //   //   devtools = new ConnectorDevtools({
  //   //     config: {
  //   //       position: "bottom-right",
  //   //       theme: "dark",
  //   //       defaultOpen: false,
  //   //       rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
  //   //     },
  //   //   });
  //   //   devtools.mount(container);
  //   // });

  //   // Cleanup on unmount
  //   return () => {
  //     devtools?.unmount();
  //     container?.remove();
  //   };
  // }, []);

  return (
    <PrivyProvider appId={`${process.env.NEXT_PUBLIC_PRIVY_APP_ID}`}>
      <AppProvider connectorConfig={connectorConfig} mobile={mobile}>
        {children}
      </AppProvider>
    </PrivyProvider>
  );
}
