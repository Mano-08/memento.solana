"use client";

import { useMemo, useEffect, useState } from "react";
import { Tabs } from "radix-ui";
import { createSolanaRpc, getBytesEncoder } from "@solana/kit";
import {
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
} from "@solana/kit";

import { fetchGift } from "@/app/generated/solgift";
import { fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata-kit";
import { formatDate } from "@/app/helper/compute";

const Gifts = () => {
  const userWallet = "A7BanmAgVhN4ysBmDKXcadk1CjrR3fakVANrXshj9x89";

  const [giftsSent, setGiftsSent] = useState([]);
  const [giftsReceived, setGiftsReceived] = useState([]);

  // Holds detailed onchain+metadata info for giftsSent
  const [giftsSentWithMeta, setGiftsSentWithMeta] = useState([]);

  const [giftsReceivedWithMeta, setGiftsReceivedWithMeta] = useState([]);

  useEffect(() => {
    // Exit early if nothing to process
    if (!Array.isArray(giftsSent) || giftsSent.length === 0) {
      setGiftsSentWithMeta([]);
      return;
    }

    let ignore = false;

    async function fetchGiftMetadatas() {
      const rpcClient = createSolanaRpc("http://127.0.0.1:8899");
      const result = await Promise.all(
        giftsSent.map(async (gift: any) => {
          const gift_pda = (gift as any).gift_pda;
          const nft_mint = (gift as any).nft_mint;

          let giftOnChain = null;
          let nftMetadata = null;
          let imageURL = null;

          // Try fetch on-chain gift account if possible
          if (gift_pda && rpcClient) {
            try {
              giftOnChain = await fetchGift(rpcClient, gift_pda);
            } catch {
              giftOnChain = null;
            }
          }

          // Always try fetch digital asset metadata if we have an nft mint
          if (nft_mint && rpcClient) {
            try {
              nftMetadata = await fetchDigitalAsset(rpcClient, nft_mint);
              const metadata = await fetch(nftMetadata.metadata.uri);
              const data = await metadata.json();
              imageURL = data.image;
            } catch (e) {
              console.error(e);
              nftMetadata = null;
            }
          }

          // Always return an object, even if pda not found, with details
          return {
            ...gift,
            gift_pda,
            nft_mint,
            imageURL,
            giftOnChain,
            nftMetadata,
          };
        })
      );

      if (!ignore) {
        console.log(result);
        setGiftsSentWithMeta(result as any);
      }
    }

    fetchGiftMetadatas();

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giftsSent]);

  useEffect(() => {
    // Exit early if nothing to process
    if (!Array.isArray(giftsReceived) || giftsReceived.length === 0) {
      setGiftsReceivedWithMeta([]);
      return;
    }

    let ignore = false;

    async function fetchGiftMetadatas() {
      if (!Array.isArray(giftsReceived) || giftsReceived.length === 0) {
        setGiftsReceivedWithMeta([]);
        return;
      }

      const rpcClient = createSolanaRpc("http://127.0.0.1:8899");
      const result = await Promise.all(
        giftsReceived.map(async (gift) => {
          const gift_pda = (gift as any).gift_pda;
          let dbData;
          let imageURL = null;
          let nft_name = null;

          try {
            const res = await fetch(`/api/v1/gifts/${gift_pda}`);
            dbData = (await res.json()).data;
          } catch (err) {
            console.error(`Failed to fetch dbData for ${gift_pda}: `, err);
            dbData = {};
          }

          const nft_mint = dbData?.nft_mint;
          if (nft_mint && rpcClient) {
            try {
              const nftMetadata = await fetchDigitalAsset(rpcClient, nft_mint);
              const metadataRes = await fetch(nftMetadata.metadata.uri);
              const metadataJSON = await metadataRes.json();
              imageURL = metadataJSON.image || null;
              nft_name = metadataJSON.name || null;
            } catch (e) {
              console.error(
                `Failed to fetch NFT metadata for ${nft_mint}: `,
                e
              );
              imageURL = null;
              nft_name = null;
            }
          }

          return {
            giftPda: (gift as any).gift_pda as any,
            imageURL,
            claimedOn: dbData?.claimed_on ?? null,
            createdOn: dbData?.created_on ?? null,
            nftMint: nft_name,
          };
        })
      );

      setGiftsReceivedWithMeta(result as any);
    }

    fetchGiftMetadatas();

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giftsReceived]);

  useEffect(() => {
    let ignore = false;
    async function fetchGifts() {
      if (!userWallet) return;
      try {
        const res = await fetch(`/api/v1/users/${userWallet}/gifts/sent`);
        const { data: value } = await res.json();
        if (!ignore) setGiftsSent(value);
      } catch (err) {
        console.error("Failed to fetch gifts sent:", err);
      }
    }
    fetchGifts();
    return () => {
      ignore = true;
    };
  }, [userWallet]);

  const privyWallet = "4Zvui9xEb5FcJR4HvE2YTu9sAekVo5n562hPkSL72K9n";

  useEffect(() => {
    let ignore = false;
    async function fetchGifts() {
      if (!privyWallet) return;
      try {
        const res = await fetch(`/api/v1/users/${privyWallet}/gifts/received`);
        const { data: value } = await res.json();
        if (!ignore) setGiftsReceived(value);
      } catch (err) {
        console.error("Failed to fetch gifts sent:", err);
      }
    }
    fetchGifts();
    return () => {
      ignore = true;
    };
  }, [privyWallet]);

  // Memoize giftsSent so downstream components do not recompute or refetch
  const memoizedGiftsSent = useMemo(() => giftsSent, [giftsSent]);

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
          {giftsSentWithMeta?.map((gift) => {
            return (
              <div
                key={(gift as any).nft_mint}
                className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-1"
              >
                <div className="rounded-2xl mb-2 text-left cursor-pointer overflow-hidden">
                  <img
                    src={
                      (gift as any).imageURL
                        ? `https://sapphire-tremendous-mackerel-441.mypinata.cloud/ipfs/${(gift as any).imageURL}`
                        : "https://www.madlads.com/_next/image?url=https%3A%2F%2Fmadlads.s3.us-west-2.amazonaws.com%2Fimages%2F1.png&w=1200&q=75"
                    }
                    className="transition-transform duration-500 hover:scale-105 object-cover w-full h-full"
                    alt={(gift as any).giftOnChain?.data?.name || "Gift image"}
                  />
                </div>
                <div className="font-bold text-lg">
                  {(gift as any).giftOnChain?.data?.name || "Gift Name"}
                </div>
                <div>
                  <span
                    className={`${
                      (gift as any).giftOnChain === null ||
                      (gift as any).giftOnChain.data.claimed
                        ? "bg-green-200"
                        : (gift as any).giftOnChain.data.deliveryDate <
                            Math.floor(Date.now() / 1000)
                          ? "bg-red-200"
                          : "bg-yellow-100"
                    } rounded-md py-0.5 px-3 text-xs`}
                  >
                    {(gift as any).giftOnChain === null ||
                    (gift as any).giftOnChain.data.claimed
                      ? "claimed"
                      : (gift as any).giftOnChain.data.deliveryDate <
                          Math.floor(Date.now() / 1000)
                        ? "not claimed"
                        : "yet to claim"}
                  </span>
                </div>

                {(gift as any).giftOnChain && (
                  <>
                    <div className="text-sm text-gray-500 ">
                      <span className="font-semibold">Created On:&nbsp;</span>
                      {formatDate((gift as any).giftOnChain.data.createdOn)}
                    </div>
                    <div className="text-sm text-gray-500 ">
                      <span className="font-semibold">
                        Delivery Date:&nbsp;
                      </span>
                      {formatDate((gift as any).giftOnChain.data.deliveryDate)}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Tabs.Content>
      <Tabs.Content
        className="grow rounded-b-md bg-white p-5 outline-none focus:shadow-black"
        value="received"
      >
        {giftsReceivedWithMeta?.map((gift) => {
          return (
            <div
              key={(gift as any).giftPda}
              className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-1"
            >
              <div className="rounded-2xl mb-2 text-left cursor-pointer overflow-hidden">
                <img
                  src={
                    (gift as any).imageURL
                      ? `https://sapphire-tremendous-mackerel-441.mypinata.cloud/ipfs/${(gift as any).imageURL}`
                      : "https://www.madlads.com/_next/image?url=https%3A%2F%2Fmadlads.s3.us-west-2.amazonaws.com%2Fimages%2F1.png&w=1200&q=75"
                  }
                  className="transition-transform duration-500 hover:scale-105 object-cover w-full h-full"
                  alt={"Gift image"}
                />
              </div>
              <div className="font-bold text-lg">
                {(gift as any).nftName || "Gift Name"}
              </div>
              <div>
                <span className="bg-green-200 rounded-md py-0.5 px-3 text-xs">
                  claimed
                </span>
              </div>

              <div className="text-sm text-gray-500 ">
                <span className="font-semibold">Created On:&nbsp;</span>
                {/* {formatDate((gift as any).createdOn)} */}
                {formatDate(BigInt(Date.now()))}
              </div>
              <div className="text-sm text-gray-500 ">
                <span className="font-semibold">Claimed on:&nbsp;</span>
                {/* {formatDate((gift as any).claimedOn)} */}
                {formatDate(BigInt(Date.now()))}
              </div>
            </div>
          );
        })}
      </Tabs.Content>
    </Tabs.Root>
  );
};

export default Gifts;
