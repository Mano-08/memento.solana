"use client";

import "@radix-ui/themes/styles.css";
import Link from "next/link";

import { bricolage, spaceMono } from "./fonts/fonts";

export default function Home() {
  return (
    <main className="">
      <div className="h-screen bg-solana-purple flex flex-col justify-center items-center">
        <div className="h-[50vh] items-center justify-center flex flex-col">
          <h1
            className={`${bricolage.className} font-extrabold text-sm text-white`}
          >
            GiftsoL
          </h1>
        </div>
        <h2 className={`my-3 ${spaceMono.className}`}>Gift NFTs in seconds</h2>
        <Link
          href="/gift"
          className="relative z-2 font-extrabold text-2xl text-black rounded-xl py-4 px-8 bg-lime-300 border-[6px] border-black shadow-[-5px_5px_0_0_rgba(0,0,0)] cursor-pointer transition-all duration-200
          hover:shadow-[-9px_9px_0_0_rgba(0,0,0)] active:shadow-[-5px_5px_0_0_rgba(0,0,0)] active:translate-0
          hover:translate-x-1 hover:-translate-y-1"
        >
          <button className="cursor-pointer">GIFT NOW!</button>
        </Link>
      </div>
    </main>
  );
}
