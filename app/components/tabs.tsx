"use client";

import { useMemo, useEffect, useState } from "react";
import { Tabs } from "radix-ui";
import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  getBytesEncoder,
} from "@solana/kit";
import {
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
} from "@solana/kit";

const rpc = createSolanaRpc("https://api.devnet.solana.com");
const rpcSubscriptions = createSolanaRpcSubscriptions(
  "ws://api.devnet.solana.com"
);

import {
  fetchGift,
  fetchUser,
  Gift,
  SOLGIFT_PROGRAM_ADDRESS,
} from "@/app/generated/solgift";
import {
  DigitalAsset,
  fetchDigitalAsset,
} from "@metaplex-foundation/mpl-token-metadata-kit";
import { formatDate, u16ToLeBytes } from "@/app/helper/compute";
import { useConnector } from "@solana/connector/react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";

type GiftAndNFTData = {
  giftData: Gift;
  nftData: {
    image: string;
    name: string;
  };
};

const Gifts = () => {
  const encoder = new TextEncoder();
  const addressEncoder = getAddressEncoder();
  const [userWallet, setUserWallet] = useState<Address | null>(null);
  const { ready, user, authenticated } = usePrivy();
  const { isConnected, account, connector } = useConnector();
  const connectedToExternalWallet = isConnected && account && connector;
  const connectedToEmbeddedWallet = ready && user && authenticated;

  const [giftsReceived, setGiftsReceived] = useState<GiftAndNFTData[]>([]);
  const [giftsSent, setGiftsSent] = useState<GiftAndNFTData[]>([]);

  useEffect(() => {
    if (userWallet) {
      fetchGiftsSent();
      fetchGiftsReceived();
    }
  }, [userWallet]);

  useEffect(() => {
    if (connectedToEmbeddedWallet) {
      if (user && user.wallet) {
        const addr = address(user.wallet.address);
        // Only set if different!
        setUserWallet((current) => (current !== addr ? addr : current));
      }
    } else if (connectedToExternalWallet) {
      if (account) {
        const addr = address(account);
        setUserWallet((current) => (current !== addr ? addr : current));
      }
    }
  }, [connectedToEmbeddedWallet, connectedToExternalWallet]);

  async function fetchGiftsReceived() {
    try {
      const giftsReceivedResponse = await fetch(
        `/api/v1/users/${userWallet}/gifts/received`
      );
      const giftsReceived = await giftsReceivedResponse.json();
      console.log(giftsReceived.data);
      // giftsReceived.data is an array of {gift_pda: string}
      const received = giftsReceived.data ?? [];
      for (let i = 0; i < received.length; i++) {
        const { gift_pda } = received[i];
        try {
          const gift = await fetchGift(rpc, gift_pda);
          const nft = await fetchDigitalAsset(rpc, gift.data.nftMint);
          const nftMetadataResponse = await fetch(nft.metadata.uri);
          const nftData = await nftMetadataResponse.json();
          setGiftsReceived((prev) => [
            ...prev,
            {
              giftData: gift.data,
              nftData: {
                image: nftData.image as string,
                name: nftData.name as string,
              },
            },
          ]);
        } catch (error) {
          console.log(
            "Failed to fetch received gift for gift_pda",
            gift_pda,
            error
          );
        }
      }
    } catch (error) {}
  }

  async function fetchGiftsSent() {
    try {
      if (!userWallet) return;
      console.log("HERE");
      const [userPda] = await getProgramDerivedAddress({
        programAddress: SOLGIFT_PROGRAM_ADDRESS,
        seeds: [encoder.encode("user"), addressEncoder.encode(userWallet)],
      });
      const userAccount = await fetchUser(rpc, userPda);
      console.log(userAccount);

      const count = userAccount.data.count;
      for (let index = 0; index < count; index++) {
        const [giftPda] = await getProgramDerivedAddress({
          programAddress: SOLGIFT_PROGRAM_ADDRESS,
          seeds: [
            encoder.encode("gift"),
            addressEncoder.encode(userWallet),
            u16ToLeBytes(index),
          ],
        });
        try {
          const gift = await fetchGift(rpc, giftPda);
          const nft = await fetchDigitalAsset(rpc, gift.data.nftMint);
          const nftMetadataResponse = await fetch(nft.metadata.uri);
          const nftData = await nftMetadataResponse.json();
          console.log(nftData);
          setGiftsSent((prev) => {
            return [
              ...prev,
              {
                giftData: gift.data,
                nftData: {
                  image: nftData.image as string,
                  name: nftData.name as string,
                },
              },
            ];
          });
        } catch (error) {
          console.log("index not found", index);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }

  if (!(connectedToEmbeddedWallet || connectedToExternalWallet))
    return <p>connect wallets</p>;

  return (
    <Tabs.Root className="flex w-full flex-col" defaultValue="sent">
      <Tabs.List
        className="flex shrink-0 border-b border-mauve6"
        aria-label="Manage your account"
      >
        <Tabs.Trigger
          className="flex h-[45px] flex-1 cursor-default select-none items-center justify-center bg-white px-5 text-[15px] leading-none text-mauve11 outline-none first:rounded-tl-md last:rounded-tr-md hover:text-violet11 data-[state=active]:text-violet11 data-[state=active]:shadow-[inset_0_-1px_0_0,0_1px_0_0] data-[state=active]:shadow-current data-[state=active]:focus:relative data-[state=active]:focus:shadow-black"
          value="sent"
        >
          Sent
        </Tabs.Trigger>
        <Tabs.Trigger
          className="flex h-[45px] flex-1 cursor-default select-none items-center justify-center bg-white px-5 text-[15px] leading-none text-mauve11 outline-none first:rounded-tl-md last:rounded-tr-md hover:text-violet11 data-[state=active]:text-violet11 data-[state=active]:shadow-[inset_0_-1px_0_0,0_1px_0_0] data-[state=active]:shadow-current data-[state=active]:focus:relative data-[state=active]:focus:shadow-black"
          value="received"
        >
          Received
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content
        className="grow rounded-b-md bg-white p-5 outline-none focus:shadow-black"
        value="sent"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {giftsSent?.map((gift) => {
            return (
              <div
                key={gift.giftData.nftMint}
                className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-1"
              >
                <div className="rounded-2xl mb-2 text-left cursor-pointer overflow-hidden">
                  <img
                    src={
                      gift.nftData.image
                        ? `https://sapphire-tremendous-mackerel-441.mypinata.cloud/ipfs/${gift.nftData.image}`
                        : "https://www.madlads.com/_next/image?url=https%3A%2F%2Fmadlads.s3.us-west-2.amazonaws.com%2Fimages%2F1.png&w=1200&q=75"
                    }
                    className="transition-transform duration-500 hover:scale-105 object-cover w-full h-full"
                    alt={gift.nftData.name || "Gift image"}
                  />
                </div>
                <div className="font-bold text-lg">
                  {gift.nftData.name || "Gift Name"}
                </div>
                <div>
                  <span
                    className={`${
                      gift.giftData.claimed
                        ? "bg-green-200"
                        : gift.giftData.deliveryDate <
                            Math.floor(Date.now() / 1000)
                          ? "bg-red-200"
                          : "bg-yellow-100"
                    } rounded-md py-0.5 px-3 text-xs`}
                  >
                    {gift.giftData.claimed
                      ? "claimed"
                      : gift.giftData.deliveryDate <
                          Math.floor(Date.now() / 1000)
                        ? "not claimed"
                        : "yet to claim"}
                  </span>
                </div>

                <div className="text-sm text-gray-500 ">
                  <span className="font-semibold">Created On:&nbsp;</span>
                  {formatDate(gift.giftData.createdOn)}
                </div>
                <div className="text-sm text-gray-500 ">
                  <span className="font-semibold">Delivery Date:&nbsp;</span>
                  {/* {formatDate(
                    gift.giftData.claimedOn?.value || gift.giftData.deliveryDate
                  )} */}
                </div>
              </div>
            );
          })}
        </div>
      </Tabs.Content>
      <Tabs.Content
        className="grow rounded-b-md bg-white p-5 outline-none focus:shadow-black"
        value="received"
      >
        {giftsReceived?.map((gift) => {
          return (
            <div
              key={gift.giftData.nftMint}
              className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-1"
            >
              <div className="rounded-2xl mb-2 text-left cursor-pointer overflow-hidden">
                <img
                  src={
                    gift.nftData.image
                      ? `https://sapphire-tremendous-mackerel-441.mypinata.cloud/ipfs/${gift.nftData.image}`
                      : "https://www.madlads.com/_next/image?url=https%3A%2F%2Fmadlads.s3.us-west-2.amazonaws.com%2Fimages%2F1.png&w=1200&q=75"
                  }
                  className="transition-transform duration-500 hover:scale-105 object-cover w-full h-full"
                  alt={"Gift image"}
                />
              </div>
              <div className="font-bold text-lg">
                {gift.nftData.name || "Gift Name"}
              </div>
              <div>
                <span className="bg-green-200 rounded-md py-0.5 px-3 text-xs">
                  claimed
                </span>
              </div>

              <div className="text-sm text-gray-500 ">
                <span className="font-semibold">Created On:&nbsp;</span>
                {formatDate(gift.giftData.createdOn)}
              </div>
              <div className="text-sm text-gray-500 ">
                <span className="font-semibold">Claimed on Date:&nbsp;</span>
                {/* {formatDate(
                  gift.giftData.claimedOn?.value || gift.giftData.deliveryDate
                )} */}
              </div>
            </div>
          );
        })}
      </Tabs.Content>
    </Tabs.Root>
  );
};

export default Gifts;
