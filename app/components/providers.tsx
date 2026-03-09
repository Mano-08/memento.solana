"use client";

import { SolanaProvider } from "@solana/react-hooks";
import { PropsWithChildren } from "react";
import { AppProvider, getDefaultConfig } from "@solana/connector/react";
import { autoDiscover, createClient } from "@solana/client";
import { Theme } from "@radix-ui/themes";

const client = createClient({
  endpoint: "http://127.0.0.1:8899",
  websocket: "ws://127.0.0.1:8900",
  walletConnectors: autoDiscover(),
});

export function Providers({ children }: PropsWithChildren) {
  const config = getDefaultConfig({ appName: "SolGift" });
  return (
    <Theme>
      <AppProvider connectorConfig={config}>
        <SolanaProvider client={client}>{children}</SolanaProvider>
      </AppProvider>
    </Theme>
  );
}
