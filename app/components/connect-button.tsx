"use client";

import { useConnector } from "@solana/connector/react";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/app/components/ui/avatar";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { WalletModal } from "./wallet-modal";
import { WalletDropdownContent } from "./wallet-dropdown-content";
import { Wallet, ChevronDown } from "lucide-react";
import { Spinner } from "@/app/components/ui/spinner";
import { cn, truncate } from "@/app/lib/utils";
import { usePrivy, useSignMessage } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { createClient } from "../lib/supabase/client";
import {
  signIntoSupabase,
  signIntoSupabaseWithPrivy,
} from "../lib/supabase/auth";

interface ConnectButtonProps {
  className?: string;
}

export function ConnectButton({ className }: ConnectButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { ready, user, authenticated } = usePrivy();
  const {
    isConnected,
    isConnecting,
    account,
    connector,
    walletConnectUri,
    clearWalletConnectUri,
  } = useConnector();

  const supabase = createClient();

  const { wallets } = useWallets();

  async function manageSupabaseConnection() {
    if (account) {
      signIntoSupabase({
        account,
        supabase,
      });
    } else if (user && wallets.length) {
      console.log(wallets);
      const wallet = wallets.find((w) => w.standardWallet?.name === "Privy");
      if (!wallet) {
        throw new Error("No privy wallet");
      }
      signIntoSupabaseWithPrivy({
        supabase,
        wallet,
        user,
      });
    }
  }

  useEffect(() => {
    if (account || user) {
      manageSupabaseConnection();
    }
  }, [account, user, wallets]);

  async function checkSOn() {
    const ss = await supabase.auth.getSession();
    console.log(ss, "CHECK SESSIONSSS");
  }

  useEffect(() => {
    if (user || account) {
      console.log("CHECK", user, account);
      checkSOn();
    }
  }, [user, account]);

  const connectedToExternalWallet = isConnected && account && connector;
  const connectedToEmbeddedWallet = ready && user && authenticated;
  if (connectedToExternalWallet || connectedToEmbeddedWallet) {
    const shortAddress = connectedToExternalWallet
      ? truncate(account)
      : truncate(user?.wallet?.address || "");
    const walletIcon = connector?.icon || undefined;

    return (
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-2", className)}
          >
            <Avatar className="h-5 w-5">
              {walletIcon && (
                <AvatarImage
                  src={walletIcon}
                  alt={connector?.name || "privy icon"}
                />
              )}
              <AvatarFallback>
                <Wallet className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <span className="text-xs">{shortAddress}</span>
            <motion.div
              animate={{ rotate: isDropdownOpen ? -180 : 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <ChevronDown className="h-4 w-4 opacity-50" />
            </motion.div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="bottom"
          className="p-0 rounded-[20px]"
        >
          <WalletDropdownContent
            selectedAccount={account || user?.wallet?.address || "Privy"}
            walletIcon={walletIcon}
            walletName={connector?.name || "Privy"}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Show loading button when connecting (but modal stays rendered)
  const buttonContent = isConnecting ? (
    <>
      <Spinner className="h-4 w-4" />
      <span className="text-xs">Connecting...</span>
    </>
  ) : (
    "Connect Wallet"
  );

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="font-semibold cursor-pointer text-white/50 hover:text-black/90 hover:bg-white/60 my-2 px-3 py-1 text-sm rounded-full"
      >
        {buttonContent}
      </button>
      <WalletModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          // Clear WalletConnect URI when modal closes
          if (!open) {
            clearWalletConnectUri();
          }
        }}
        walletConnectUri={walletConnectUri}
        onClearWalletConnectUri={clearWalletConnectUri}
      />
    </>
  );
}
