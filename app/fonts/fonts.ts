import { Inter, Space_Mono } from "next/font/google";
import localFont from "next/font/local";

export const bricolage = localFont({
  src: "./bricolage.ttf",
});

export const bricolageCondensed = localFont({
  src: "./BricolageGrotesque96ptCondensed-ExtraBold.ttf",
});

export const atkinsonMedium = localFont({
  src: "./sands/TTF/AtkinsonHyperlegibleNext-Medium.ttf",
});

export const atkinsonBold = localFont({
  src: "./sands/TTF/AtkinsonHyperlegibleNext-Bold.ttf",
});

export const fornier = localFont({
  src: "./Fornire-Light.otf",
  weight: "400",
});

export const spaceMono = Space_Mono({
  subsets: ["vietnamese"],
  weight: ["400", "700"],
});

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
