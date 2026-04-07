"use client";

import Link from "next/link";
import { ConnectButton } from "./connect-button";
import Image from "next/image";
import solgiftLogo from "@/public/solgiftLogo.png";
import { usePathname } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";

export default function AppNav() {
  const pathname = usePathname();

  let isCreate = pathname === "/create" || pathname.startsWith("/create-gift");
  let isClaim = pathname === "/claim";
  let isRoot = pathname === "/";

  // Set icon, text, and container class
  let BrandIcon, brandLabel;
  if (isCreate) {
    BrandIcon = <X className="text-neutral-500 hover:text-black" size={20} />;
    brandLabel = "Create Gift";
  } else if (isClaim) {
    BrandIcon = <X />;
    brandLabel = "Claim gift";
  } else {
    BrandIcon = null;
    brandLabel = "SolGift";
  }

  return (
    <header className="w-full sticky h-14 z-50 top-0">
      <div className="backdrop-blur-3xl transition-colors duration-500 border-b border-black/5 supports-backdrop-blur:bg-white/95  bg-white/80 h-14"></div>
      <div
        className={`relative -mt-14 flex flex-row items-center ${isRoot ? "max-w-7xl" : "px-10"} justify-between mx-auto text-black w-full h-14`}
      >
        <Link
          href="/"
          className="flex flex-row items-center gap-2 cursor-pointer"
        >
          <div className="">
            {BrandIcon ? (
              BrandIcon
            ) : (
              <Image src={solgiftLogo} alt="Logo" height={24} width={24} />
            )}
          </div>
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
        </Link>
        <div className="flex flex-row items-center gap-3">
          <ConnectButton />
          {/* <Button className="bg-blue-600 hover:bg-blue-600/90 text-white">
            Gift now!
          </Button> */}
        </div>
      </div>
    </header>
  );
}
