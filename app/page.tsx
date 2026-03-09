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
            className={`${bricolage.className} font-extrabold text-[20vw] text-white`}
          >
            <StyledLetter letter="G" index={0} />
            <StyledLetter letter="i" index={1} />
            <StyledLetter letter="f" index={2} />
            <StyledLetter letter="t" index={3} />
            <StyledLetter letter="s" index={4} />
            <StyledLetter letter="o" index={5} />
            <StyledLetter letter="L" index={6} />
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

import { useEffect, useRef, useState } from "react";

type StyledLetterProps = {
  letter: string;
  index: number;
  scrollFactor?: number; // controls how quickly the letter is displaced
  maxOffset?: number; // max x/y pixel offset
  maxRotate?: number; // max rotation in deg
};

// Create a seeded pseudo-random generator for deterministic randomness per index
function seededRandom(seed: number) {
  let x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function randomizeFromIndex(index: number, min: number, max: number) {
  const r = seededRandom(index * 13.37 + 27.1);
  return min + r * (max - min);
}

function StyledLetter({
  letter,
  index,
  // Make the effect even smoother (slower travel per scroll and more inertia)
  scrollFactor = 0.05, // smaller = slower movement <<<< Increase scrollFactor (e.g. 0.05, 0.1) to make effect faster
  maxOffset = 36,
  maxRotate = 10,
}: StyledLetterProps) {
  const [interpolatedT, setInterpolatedT] = useState(0);
  const targetTRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const denom = typeof window !== "undefined" ? window.innerHeight : 1000;
      let t = denom ? window.scrollY / denom : 0;
      t = Math.max(0, Math.min(t, 1));
      targetTRef.current = t;
    };

    const animate = () => {
      setInterpolatedT((t) => {
        // Use a smaller lerp factor for smoother/slower animation
        const lerpFactor = 0.06; // even lower for more "inertia/smoothness" <<<< Increase lerpFactor (e.g. 0.15, 0.25, up to 1) to make effect snappier/faster
        return t + (targetTRef.current - t) * lerpFactor;
      });
      rafRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("scroll", handleScroll);
    rafRef.current = requestAnimationFrame(animate);

    // Initialize t in case the page already scrolled
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Randomize target offsets and angle per letter
  const targetX = randomizeFromIndex(index, -maxOffset, maxOffset);
  const targetY = randomizeFromIndex(index + 100, -maxOffset, maxOffset);
  const targetRotate = randomizeFromIndex(index + 200, -maxRotate, maxRotate);

  // easeInOutCubic for even smoother interpolation.
  const ease = (x: number) =>
    x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const et = ease(interpolatedT);

  // The offsets are scaled by a smaller scrollFactor for even slower, smoother effect
  const xOffset = targetX * et * scrollFactor * 6; // scale *6 to keep visual parity with old offset - reduces jump
  const yOffset = targetY * et * scrollFactor * 6;
  const rotate = targetRotate * et * scrollFactor * 6;

  return (
    <span
      style={{
        display: "inline-block",
        transform: `translate(${xOffset.toFixed(2)}px, ${yOffset.toFixed(
          2
        )}px) rotate(${rotate.toFixed(2)}deg)`,
        WebkitTextStroke: "8px black",
        textShadow:
          "-6px 6px 0px black, -12px 12px 16px rgba(0,0,0,0.25), -4px 4px 8px rgba(0,0,0,0.15)",
        transition: "none",
        willChange: "transform",
      }}
    >
      {letter}
    </span>
  );
}
