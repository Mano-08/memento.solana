import "@radix-ui/themes/styles.css";
import Link from "next/link";
import { Sparkle } from "lucide-react";
import Image from "next/image";
import solanaLogoMark from "@/public/solanaLogoMark.svg";
import solanaWordMark from "@/public/solanaWordMark.svg";
import auroraImage from "@/public/aurora.png";
import helpingHandImage from "@/public/helping-hand.png";

import { bricolage } from "./fonts/fonts";
import Footer from "./components/footer";
import { Button } from "./components/ui/button";
import { SparkleCluster } from "./components/stars";

export default function Home() {
  return (
    <>
      <main className="min-h-screen flex flex-col items-center justify-center w-screen overflow-x-hidden">
        <section className="min-h-screen py-10 bg-custom-landing w-full flex items-center justify-center ">
          <div className="flex-col-reverse md:flex-row flex items-center justify-center max-w-5xl w-full gap-20">
            <div className="flex flex-col justify-center items-center md:items-start">
              <h1
                className={`text-4xl md:text-7xl text-center md:text-left w-full md:w-auto ${bricolage.className}`}
              >
                <span className="block  text-neutral-500 ">
                  Thoughtful <br className="md:block hidden" /> gifts <br />
                  {/* <span className="text-colored">start here.</span> */}
                  <SparkleCluster />
                </span>
              </h1>
              <div
                className={`text-sm md:text-lg mt-2  text-neutral-500 max-w-2xl text-center md:text-left font-medium`}
              >
                Send an NFT, set the unlock date, and surprise someone special.
                Make moments memorable on-chain.
              </div>

              <div className="flex flex-col items-center gap-4 max-w-[300px] mt-8">
                <Button
                  variant={"default"}
                  className="font-semibold  w-full rounded-lg bg-white hover:bg-white/90 h-12 text-black group overflow-hidden relative"
                >
                  <Link
                    href="/create"
                    className=" hover:bg-amber-400/90 bg-amber-400 px-[100px] text-black py-2 text-xl md:text-2xl items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-all"
                  >
                    Gift now!
                  </Link>
                </Button>
                <p className="inline-flex gap-2 group text-xs md:text-sm  text-white/80">
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
