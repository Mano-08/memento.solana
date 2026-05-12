import type { Metadata } from "next";
import { Providers } from "@/app/providers";
import AppNav from "./components/appnav";
import Footer from "./components/footer";
import { inter } from "./fonts/fonts";
import "@radix-ui/themes/styles.css";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Memento",
  description: "Gift Time Locked Solana NFT!",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cn("font-sans", geist.variable)} overflow-x-hidden max-w-screen`}
    >
      <body className={`${inter.className} relative antialiased w-screen`}>
        <Providers>
          <AppNav />
          {children}
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
