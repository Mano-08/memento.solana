"use client";

import Link from "next/link";
import { ConnectButton } from "./connect-button";
import Image from "next/image";
import solgiftLogo from "@/public/solgiftLogo.png";
import { usePathname } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import {
  useCluster,
  useConnector,
  useConnectorClient,
} from "@solana/connector/react";
import React from "react";
import { Button } from "./ui/button";
import {
  createUserAccountIfNotExist,
  signIntoSupabaseWithPrivy,
  signOutofSupabase,
} from "../lib/supabase/auth";
import { createClient } from "../lib/supabase/client";
import { useWallets } from "@privy-io/react-auth/solana";
import { SupabaseClient } from "@supabase/supabase-js";
import { Connection } from "@solana/web3.js";
import {
  createKitSignersFromWallet,
  createSignableMessage,
} from "@solana/connector/headless";

export default function AppNav() {
  const pathname = usePathname();

  let isCreate = pathname === "/create" || pathname.startsWith("/create");
  let isClaim = pathname.startsWith("/claim");
  let isRoot = pathname === "/";

  // Set icon, text, and container class
  let BrandIcon, brandLabel;
  if (isCreate) {
    BrandIcon = <X className="text-neutral-300 hover:text-white" size={20} />;
    brandLabel = "Create Gift";
  } else if (isClaim) {
    BrandIcon = <X className="text-neutral-300 hover:text-white" />;
    brandLabel = "Claim gift";
  } else {
    BrandIcon = null;
    brandLabel = "SolGift";
  }

  const { ready, user, authenticated } = usePrivy();

  const {
    isConnected,
    account,
    connector,
    walletConnectUri,
    isConnecting,
    clearWalletConnectUri,
  } = useConnector();

  const [userConnected, setUserConnected] = React.useState<boolean>(false);
  const [scrolled, setScrolled] = React.useState<boolean>(false);
  // const connectedToExternalWallet = isConnected && account && connector;
  // const connectedToEmbeddedWallet = ready && user && authenticated;
  // const { wallets } = useWallets();
  // const { walletStatus, connectorId } = useConnector();
  // const { cluster } = useCluster();
  // const client = useConnectorClient();

  // async function handleSignIntoSupabase({
  //   supabase,
  // }: {
  //   supabase: SupabaseClient<any, "public", "public", any, any>;
  // }) {
  //   if (user && wallets.length) {
  //     const privyWallet = wallets.find(
  //       (w) => w.standardWallet?.name === "Privy"
  //     );
  //     if (privyWallet) {
  //       await signIntoSupabaseWithPrivy({
  //         supabase,
  //         wallet: privyWallet,
  //         user,
  //       });
  //     }
  //   }
  // }

  // async function handleSignIntoSupabaseExternalWallet({
  //   supabase,
  // }: {
  //   supabase: SupabaseClient<any, "public", "public", any, any>;
  // }) {
  //   if (account && connectorId && walletStatus.status === "connected") {
  //     const {
  //       data: { session },
  //     } = await supabase.auth.getSession();

  //     if (session) {
  //       const supabase_address = session.user.user_metadata?.custom_claims
  //         ?.address as string | undefined;
  //       if (supabase_address !== null && account !== supabase_address) {
  //         console.log("SOB");
  //         signOutofSupabase({ supabase });
  //       }

  //       return;
  //     }
  //     // Inline logic from previous version, rewritten:
  //     const wallet = client?.getConnector(connectorId);
  //     const walletAccount =
  //       walletStatus.status === "connected"
  //         ? walletStatus.session.selectedAccount.account
  //         : null;

  //     if (wallet && walletAccount && cluster && client) {
  //       // UseMemo is not needed here (runs once as effect)
  //       const rpcUrl = client.getRpcUrl();
  //       const connection = rpcUrl ? new Connection(rpcUrl) : null;
  //       const kitSigners = createKitSignersFromWallet(
  //         wallet,
  //         walletAccount,
  //         connection,
  //         undefined
  //       );
  //       const { error } = await supabase.auth.signInWithWeb3({
  //         chain: "solana",
  //         statement: "I accept the Terms of Service at https://example.com/tos",
  //         wallet: {
  //           publicKey: {
  //             toBase58: () => account,
  //           },
  //           signMessage: async (message: Uint8Array) => {
  //             if (!kitSigners || !kitSigners.messageSigner) {
  //               throw new Error("Wallet not ready for signing");
  //             }
  //             const signableMessage = createSignableMessage(message);
  //             const signedMessages =
  //               await kitSigners.messageSigner.modifyAndSignMessages([
  //                 signableMessage,
  //               ]);
  //             const signatureMap = signedMessages[0].signatures;
  //             return signatureMap[account];
  //           },
  //         },
  //       });
  //       await createUserAccountIfNotExist({
  //         walletAddress: account,
  //         supabase,
  //       });
  //       if (error) {
  //         // Don't loop, just log error and don't reprompt unless wallet/account changes
  //         console.error("Error signing in with wallet:", error);
  //       }
  //     }
  //   }
  // }

  // async function handleSignOutOfSupabase({
  //   supabase,
  // }: {
  //   supabase: SupabaseClient<any, "public", "public", any, any>;
  // }) {
  //   await signOutofSupabase({ supabase });
  // }

  // React.useEffect(() => {
  //   if (ready && !isConnecting) {
  //     const supabase = createClient();
  //     if (connectedToExternalWallet || connectedToEmbeddedWallet) {
  //       setUserConnected(true);
  //       if (connectedToExternalWallet) {
  //         handleSignIntoSupabaseExternalWallet({ supabase });
  //       } else {
  //         handleSignIntoSupabase({ supabase });
  //       }
  //     } else {
  //       handleSignOutOfSupabase({ supabase });
  //     }
  //   }
  // }, [
  //   connectedToExternalWallet,
  //   connectedToEmbeddedWallet,
  //   ready,
  //   isConnected,
  // ]);

  // Scroll event for navbar background color
  React.useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="w-full sticky z-50 top-0 h-14">
      <div
        className={`relative animate-slideDown flex flex-row items-center px-5 justify-between mx-auto text-black h-14 w-full -mt-14 transition-colors duration-300 ${
          scrolled ? "backdrop-blur-sm" : ""
        }`}
        style={{
          backgroundColor: scrolled ? "#020117c3" : "transparent",
        }}
      >
        <div className="flex flex-row items-center gap-2 opacity-50">
          <Link href="/">
            {BrandIcon ? (
              BrandIcon
            ) : (
              <Image src={solgiftLogo} alt="Logo" height={24} width={24} />
            )}
          </Link>
          <div
            className={
              !isRoot ? "h-8 mt-1 mx-3.5 w-px bg-neutral-300" : "hidden"
            }
          ></div>
          <h1 className={`text-neutral-300 font-semibold text-sm`}>
            {brandLabel}
          </h1>
        </div>
        <div className="flex flex-row items-center gap-3">
          {userConnected && (
            <Link href="/dashboard">
              <button className="font-semibold cursor-pointer text-neutral-500 text-sm hover:text-black my-2 pl-3 pr-2 py-1.5 hover:bg-white rounded-full">
                Profile
              </button>
            </Link>
          )}
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
