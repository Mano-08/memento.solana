import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/app/providers";
import { Space_Mono } from "next/font/google";
import "@radix-ui/themes/styles.css";
import AppNav from "./components/appnav";
import Footer from "./components/footer";

export const metadata: Metadata = {
  title: "SolGift",
  description: "Gift Solana NFT to your friends",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

const spaceMono = Space_Mono({
  subsets: ["vietnamese"],
  weight: ["400", "700"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceMono.className} antialiased`}>
        <Providers>
          <AppNav />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
