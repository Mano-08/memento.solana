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
    clearWalletConnectUri,
  } = useConnector();

  const [userConnected, setUserConnected] = React.useState<boolean>(false);
  const [scrolled, setScrolled] = React.useState<boolean>(false);

  const connectedToExternalWallet = isConnected && account && connector;
  const connectedToEmbeddedWallet = ready && user && authenticated;

  React.useEffect(() => {
    if (connectedToExternalWallet || connectedToEmbeddedWallet) {
      setUserConnected(true);
    }
  }, [connectedToExternalWallet, connectedToEmbeddedWallet]);

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
        className={`relative flex flex-row items-center px-5 justify-between mx-auto text-black h-14 w-full -mt-14 transition-colors duration-300 ${
          scrolled ? "backdrop-blur-sm" : ""
        }`}
        style={{
          backgroundColor: scrolled ? "rgba(16, 14, 72, 0.9)" : "transparent",
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
          <ConnectButton />
          {userConnected && (
            <Link href="/dashboard">
              <button className="font-semibold text-neutral-300 hover:text-black my-2 pl-3 pr-2 py-1.5 hover:bg-white rounded-full">
                Profile
              </button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
