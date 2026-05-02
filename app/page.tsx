"use client";

import "@radix-ui/themes/styles.css";
import Link from "next/link";
import Image from "next/image";
import solanaLogoMark from "@/public/solanaLogoMark.svg";
import solanaWordMark from "@/public/solanaWordMark.svg";
import trekkingImage from "@/public/trekking.png";
import auroraImage from "@/public/aurora.png";
import helpingHandImage from "@/public/helping-hand.png";

import { bricolage } from "./fonts/fonts";
import { createClient } from "./lib/supabase/client";
import { useEffect } from "react";
import Footer from "./components/footer";

export default function Home() {
  return (
    <>
      <main className="min-h-screen flex flex-col items-center justify-center w-screen overflow-x-hidden">
        <section className="min-h-screen py-10 bg-custom-landing w-full flex items-center justify-center">
          <div className="flex-col-reverse md:flex-row flex items-center justify-center max-w-5xl w-full gap-20">
            <div className="flex flex-col justify-center items-center md:items-start">
              <h1
                className={`text-4xl md:text-7xl text-center md:text-left w-full md:w-auto ${bricolage.className}`}
              >
                <span className="block animate-slideUp text-neutral-500 ">
                  Thoughtful <br className="md:block hidden" /> gifts <br />
                  {/* <span className="text-colored">start here.</span> */}
                  <span className="text-neutral-400">start here.</span>
                </span>
              </h1>
              <div
                className={`text-sm md:text-lg mt-2 delay-200! animate-slideUp text-neutral-500 max-w-2xl text-center md:text-left font-medium`}
              >
                Send an NFT, set the unlock date, and surprise someone special.
                Make moments memorable on-chain.
              </div>

              <div className="flex flex-col items-center gap-4 max-w-[300px] mt-8">
                <div className="delay-400! animate-slideUp">
                  <Link
                    href="/create"
                    className=" hover:bg-amber-400/90 bg-amber-400 px-[100px] text-black py-2 text-xl md:text-2xl items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark"
                  >
                    Gift now!
                  </Link>
                </div>
                <p className="inline-flex gap-2 group text-xs md:text-sm delay-600! animate-slideUp text-white/80">
                  <span>powered by</span>
                  <Image
                    src={solanaLogoMark}
                    alt="solana logo mark"
                    className="opacity-80"
                    height={10}
                  />
                  <Image
                    src={solanaWordMark}
                    alt="solana logo mark"
                    className="opacity-80"
                    height={10}
                  />
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center w-full">
              <div className="relative flex flex-row items-center w-[220px] h-[220px] md:my-0 my-[75px] md:w-[400px] md:h-[400px] group">
                {/* Aurora Image (top card) */}
                <div className="absolute -top-7" style={{ perspective: 1200 }}>
                  <div
                    className="
                      bg-white rounded-xl shadow-xl border w-[220px] md:w-[400px] border-gray-300 p-2
                      transition-transform duration-500
                      hover:scale-110 rotate-8 group-hover:-rotate-8 max-w-[450px]
                      [box-shadow:0_8px_32px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.08)]
                      origin-70%_80%
                      group-hover:-translate-y-7
                      group-hover:-translate-x-64
                     animate-slideUp
                    "
                  >
                    <Image
                      src={auroraImage}
                      alt="trekking with my sister the summer of 2025"
                      className="rounded-md block object-cover w-full h-[220px] md:h-[400px]"
                    />
                    <div className="mt-5 mb-2 px-1 text-center text-xs font-mono text-gray-600">
                      Winter 2009 • Lua and Aurora
                    </div>
                  </div>
                </div>

                <div className="absolute top-7" style={{ perspective: 1200 }}>
                  <div
                    className="
                      bg-neutral-50 rounded-xl shadow-xl border w-[220px] md:w-[400px] border-gray-300 p-2
                      transition-transform duration-500
                      hover:scale-110 -rotate-6 group-hover:rotate-6 max-w-[450px]
                      [box-shadow:0_8px_32px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.08)]
                      origin-70%_80%
                      group-hover:translate-y-8
                      animate-slideUp
                    "
                  >
                    <Image
                      src={helpingHandImage}
                      alt="trekking with my sister the summer of 2025"
                      className="rounded-md block object-cover w-full h-[220px] md:h-[400px]"
                    />
                    <div className="mt-5 mb-2 px-1 text-center text-xs font-mono text-gray-600">
                      Summer 2012 • Fun times in San Francisco
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="bg-white w-full py-20 flex flex-col items-center">
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/DOKVREgWKbE?si=4MUIIkxXyo7FcKsK"
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="rounded-xl"
          ></iframe>
        </section>

        {/* Images come here */}

        <section className=" w-full flex flex-col items-center py-20">
          <div className="flex flex-row md:gap-8 gap-2">
            <div className="text-black/50 md:text-left text-center">
              <h3 className="text-4xl text-black font-extrabold">
                Wrap <span className="text-black/50">the Gift</span>
              </h3>
              <ol className="py-2">
                <li>Pick a photo and let AI enhance it</li>
                <li>Turn it into an NFT with a security question</li>
                <li>Set a reveal date and wrap your gift!</li>
              </ol>
            </div>
            <div className="flex flex-col items-center justify-center my-4">
              <div className="relative flex items-center h-[150px]">
                <div className="md:w-[150px] w-0.5 h-[150px] bg-black md:h-0.5 "></div>
                <div className="absolute left-1/2 bg-purple-100 h-10 w-10 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center rounded-full border-4 border-purple-100 shadow">
                  <span className="text-2xl">🔒</span>
                </div>
              </div>
            </div>
            <div className="text-black/50 md:text-right text-center">
              <h3 className="text-4xl text-black font-extrabold">
                <span className="text-black/50">Gift </span>Delivered
              </h3>
              <ol className="py-2">
                <li>Enter your email and confirm with OTP</li>
                <li>Answer a simple security question</li>
                <li>See your gift and claim it!</li>
              </ol>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
