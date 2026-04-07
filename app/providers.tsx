"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

import {
  ConnectorProvider,
  getDefaultConfig,
  getDefaultMobileConfig,
} from "@solana/connector/react";

const getOrigin = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000";
};

import { PrivyProvider } from "@privy-io/react-auth";

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
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    let devtools:
      | { mount: (el: HTMLElement) => void; unmount: () => void }
      | undefined;
    let container: HTMLDivElement | undefined;

    // // Dynamic import to avoid bundling in production
    // import("@solana/devtools").then(({ ConnectorDevtools }) => {
    //   // Create container for devtools
    //   container = document.createElement("div");
    //   container.id = "connector-devtools-container";
    //   document.body.appendChild(container);

    //   // Create and mount devtools (auto-detects window.__connectorClient)
    //   devtools = new ConnectorDevtools({
    //     config: {
    //       position: "bottom-right",
    //       theme: "dark",
    //       defaultOpen: false,
    //       rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
    //     },
    //   });
    //   devtools.mount(container);
    // });

    // Cleanup on unmount
    return () => {
      devtools?.unmount();
      container?.remove();
    };
  }, []);

  return (
    <ConnectorProvider config={connectorConfig} mobile={mobile}>
      <PrivyProvider
        key={"doko"}
        appId={`${process.env.NEXT_PUBLIC_PRIVY_APP_ID}`}
        config={{
          embeddedWallets: {
            solana: {
              createOnLogin: "all-users",
            },
            priceDisplay: {
              primary: "fiat-currency",
              secondary: "native-token",
            },
          },
          loginMethods: ["email"],
          appearance: {
            walletList: ["phantom", "backpack", "detected_solana_wallets"],
            walletChainType: "solana-only",
          },
          // externalWallets: {
          //   solana: {
          //     // if not specified, solana wallets will show but connector won't work and defaults to opening the wallet installation page
          //     connectors: toSolanaWalletConnectors({ shouldAutoConnect: true }),
          //   },
          // },

          solana: {
            rpcs: {
              "solana:mainnet": {
                // rpc: createSolanaRpc("https://api.mainnet-beta.solana.com"),
                rpc: createSolanaRpc(
                  "https://mainnet.helius-rpc.com/?api-key=568f70c7-8c96-4cd2-b1b0-904855733cea"
                ),
                rpcSubscriptions: createSolanaRpcSubscriptions(
                  "wss://api.mainnet-beta.solana.com"
                ),
              },
              "solana:devnet": {
                rpc: createSolanaRpc("https://api.devnet.solana.com"),
                rpcSubscriptions: createSolanaRpcSubscriptions(
                  "wss://api.devnet.solana.com"
                ),
              },
            },
          },
        }}
      >
        {children}
      </PrivyProvider>
    </ConnectorProvider>
  );
}
