"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { bricolage, spaceMono } from "../fonts/fonts";
import dino1 from "@/public/dino/dino1.png";
import dino2 from "@/public/dino/dino1-2.png";
import dino3 from "@/public/dino/dino1-3.png";
import dino4 from "@/public/dino/dino1-4.png";
import dino5 from "@/public/dino/dino1-5.png";
import dino6 from "@/public/dino/dino1-6.png";
import dino7 from "@/public/dino/dino1-7.png";
import dino8 from "@/public/dino/dino1-8.png";
import dino9 from "@/public/dino/dino1-9.png";
import Gifts from "../components/gifts";
import { createUserAccountIfNotExist } from "../lib/supabase/auth";
import { useConnector } from "@solana/connector/react";
import { usePrivy } from "@privy-io/react-auth";

// Dino avatar image map: dino avatar name -> dino image import
const dinoAvatarImageMap: Record<string, any> = {
  trexo: dino1,
  rapto: dino2,
  ankylo: dino3,
  spino: dino4,
  stego: dino5,
  ptera: dino6,
  pachy: dino7,
  dilop: dino8,
  iguan: dino9,
};

export default function home() {
  const { ready, user, authenticated } = usePrivy();
  const {
    isConnected,
    account,
    connector,
    walletConnectUri,
    clearWalletConnectUri,
  } = useConnector();

  const connectedToExternalWallet = isConnected && account && connector;
  const connectedToEmbeddedWallet = ready && user && authenticated;
  const [name, setName] = useState<string>("Bored Dilop");
  const [avatar, setAvatar] = useState<string>("dilop");

  useEffect(() => {
    if (!(connectedToEmbeddedWallet || connectedToEmbeddedWallet)) return;
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      const walletAddress = session?.user.user_metadata?.custom_claims?.address;
      if (walletAddress) {
        createUserAccountIfNotExist({ supabase, walletAddress }).then(
          ({ name, avatar }) => {
            setName(name);
            setAvatar(avatar);
          }
        );
      }
    });
  }, [connectedToEmbeddedWallet, connectedToExternalWallet]);

  return (
    <main
      className={`bg-custom-landing min-h-screen py-20 px-5 ${spaceMono.className} w-screen overflow-x-hidden`}
    >
      <section className="lg:w-7xl mx-auto px-5 lg:px-10 py-10 bg-white my-10 rounded-[35px] flex flex-col gap-10 border-[6px] border-black shadow-[-5px_5px_0_0_rgba(0,0,0)]">
        <div className="flex flex-col lg:flex-row items-center gap-10">
          <img
            height={200}
            width={200}
            alt="profile pic"
            src={dinoAvatarImageMap[avatar].src}
            className="h-[100px] w-[100px] object-cover rounded-full overflow-hidden"
          />
          <h1 className="text-3xl">{name}</h1>
        </div>

        <Gifts />
      </section>
    </main>
  );
}
