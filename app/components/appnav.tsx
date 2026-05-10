"use client";

import Link from "next/link";
import { ConnectButton } from "./connect-button";
import Image from "next/image";
import solgiftLogo from "@/public/solgiftLogo.png";
import { usePathname } from "next/navigation";
import { ArrowLeft, CircleQuestionMark, Info, X } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/app/components/ui/dialog";
import {
  useCluster,
  useConnector,
  useConnectorClient,
} from "@solana/connector/react";
import React, { useState } from "react";
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
import { IconQuestionmark } from "symbols-react";

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
  const [open, setOpen] = useState(false);
  const { account, isConnecting, isConnected, clearWalletConnectUri } =
    useConnector();

  const [userConnected, setUserConnected] = React.useState<boolean>(false);
  const [scrolled, setScrolled] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (authenticated || account) {
      setUserConnected(true);
    }
  }, [account, authenticated]);

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
    <header className={`w-full sticky z-50 top-0 h-14`}>
      <div
        className={`${isClaim ? "justify-end" : "justify-between"} relative animate-slideDown flex flex-row items-center px-5  mx-auto text-black h-14 w-full -mt-14 transition-colors duration-300 ${
          scrolled ? "backdrop-blur-sm" : ""
        }`}
        style={{
          backgroundColor: scrolled ? "#020117c3" : "transparent",
        }}
      >
        {!isClaim && (
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
        )}

        <div className="flex flex-row items-center gap-3">
          <div className="flex flex-row items-center">
            {isCreate && (account || user) && <HowToCreateGiftDialog />}

            {userConnected && (
              <Link href="/dashboard">
                <Button
                  className="flex items-center text-sm gap-2 bg-transparent shadow-none hover:bg-neutral-100/10 text-white/50 px-3 h-8 rounded-lg font-semibold border-none hover:text-white/60"
                  type="button"
                  variant="outline"
                >
                  Profile
                </Button>
              </Link>
            )}
          </div>
          <ConnectButton className="font-semibold shadow-none cursor-pointer text-white/50 hover:text-black/90 hover:bg-white/60 my-2 px-3 py-1 text-sm rounded-lg" />
        </div>
      </div>
    </header>
  );
}

function HowToCreateGiftDialog() {
  const [open, setOpen] = useState<boolean>(true);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="flex items-center text-sm gap-2 bg-transparent hover:bg-neutral-100/10 text-white/50 px-3 h-8 rounded-lg font-semibold border-none hover:text-white/60"
          type="button"
          variant="outline"
        >
          <CircleQuestionMark className="w-4 h-4" />
          How to create gift
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-[24px] px-0 pb-0 pt-0 overflow-hidden">
        <div className="flex flex-col gap-2 items-center text-center">
          <DialogHeader className="w-full px-6 pt-8">
            <DialogTitle className="text-lg font-semibold">
              How to Create a Gift NFT
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              Follow these steps to send a perfect gift!
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal list-inside space-y-2 mt-4 text-left text-base text-black px-7 pb-4 w-full">
            <li>
              <span className="font-semibold">Upload an image</span> — this
              becomes your NFT gift.
            </li>
            <li>
              <span className="font-semibold">Pick a delivery date</span> — when
              your friend can open it.
            </li>
            <li>
              <span className="font-semibold">Enter their email</span> — we'll
              notify them when it's ready.
            </li>
            <li>
              <span className="font-semibold">Add a SOL amount</span> — sent
              along with the NFT.
            </li>
            <li>
              <span className="font-semibold">Set a secret question</span> —
              your friend answers it to claim the gift.
            </li>
          </ol>
        </div>
        <div className="border-t border-neutral-400 border-solid w-full">
          <DialogClose asChild>
            <button className="w-full cursor-pointer mx-auto text-blue-700 hover:text-blue-600 h-12 flex items-center justify-center font-medium transition-colors disabled:bg-muted/40 disabled:text-muted-foreground">
              Got it!
            </button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
