"use client";

import Link from "next/link";
import { ConnectButton } from "./connect-button";
import Image from "next/image";
import solgiftLogo from "@/public/solgiftLogo.png";
import { usePathname } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useConnector } from "@solana/connector/react";
import React from "react";
import { Button } from "./ui/button";

export default function AppNav() {
  const pathname = usePathname();

  let isCreate = pathname === "/create" || pathname.startsWith("/create-gift");
  let isClaim = pathname.startsWith("/claim");
  let isRoot = pathname === "/";

  // Set icon, text, and container class
  let BrandIcon, brandLabel;
  if (isCreate) {
    BrandIcon = <X className="text-neutral-500 hover:text-black" size={20} />;
    brandLabel = "Create Gift";
  } else if (isClaim) {
    BrandIcon = <X className="text-neutral-500 hover:text-black" />;
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
    clearWalletConnectUri,
  } = useConnector();

  const [userConnected, setUserConnected] = React.useState<boolean>(false);

  const connectedToExternalWallet = isConnected && account && connector;
  const connectedToEmbeddedWallet = ready && user && authenticated;

  React.useEffect(() => {
    if (connectedToExternalWallet || connectedToEmbeddedWallet) {
      setUserConnected(true);
    }
  }, [connectedToExternalWallet, connectedToEmbeddedWallet]);

  return (
    <header className="w-full sticky h-14 z-50 top-0">
      <div className="backdrop-blur-3xl transition-colors duration-500 border-b border-black/5 supports-backdrop-blur:bg-white/95  bg-white/80 h-14"></div>
      <div
        className={`relative -mt-14 flex flex-row items-center ${isRoot ? "max-w-7xl" : "px-10"} justify-between mx-auto text-black w-full h-14`}
      >
        <div className="flex flex-row items-center gap-2">
          <Link href="/">
            {BrandIcon ? (
              BrandIcon
            ) : (
              <Image src={solgiftLogo} alt="Logo" height={24} width={24} />
            )}
          </Link>
          <div
            className={
              !isRoot ? "h-8 mt-1 mx-3.5 w-px bg-neutral-200" : "hidden"
            }
          ></div>
          <h1
            className={`${isRoot ? "text-black" : "text-neutral-500"} font-semibold text-base`}
          >
            {brandLabel}
          </h1>
        </div>
        <div className="flex flex-row items-center gap-3">
          <ConnectButton />
          {userConnected && (
            <Link href="/dashboard">
              <button className="font-semibold text-gray-900 hover:text-gray-900 my-2 pl-3 pr-2 py-1.5 hover:bg-slate-500/5 rounded-md">
                Profile
              </button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
