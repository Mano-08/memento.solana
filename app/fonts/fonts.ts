import { Space_Mono } from "next/font/google";
import localFont from "next/font/local";

export const bricolage = localFont({
  src: "./bricolage.ttf",
});

export const bricolageCondensed = localFont({
  src: "./BricolageGrotesque96ptCondensed-ExtraBold.ttf",
});

export const spaceMono = Space_Mono({
  subsets: ["vietnamese"],
  weight: ["400", "700"],
});
