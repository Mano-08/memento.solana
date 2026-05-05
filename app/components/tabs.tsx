"use client";

import { useEffect, useState } from "react";
import { Tabs } from "radix-ui";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
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
import {
  Calendar,
  Check,
  Copy,
  DollarSign,
  PackageCheck,
  UserRoundCheck,
  Van,
} from "lucide-react";
import { toast } from "sonner";

type GiftAndNFTData = {
  giftData: Gift;
  giftPda: string;
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
    console.log(giftsSent, "giftsSent");
  }, [giftsSent]);

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
          const nftMint = gift.data.nftMint;
          const nftMintAddress = address(nftMint);
          const nft = await fetchDigitalAsset(rpc, nftMintAddress);
          const nftMetadataResponse = await fetch(nft.metadata.uri);
          const nftData = await nftMetadataResponse.json();
          setGiftsReceived((prev) => [
            ...prev,
            {
              giftData: gift.data,
              giftPda: gift_pda,
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

          console.log(gift, index, "GIFT DATA HERE");
          const nftMintAddress = address(gift.data.nftMint);
          const nft = await fetchDigitalAsset(rpc, nftMintAddress);
          const nftMetadataResponse = await fetch(nft.metadata.uri);
          const nftData = await nftMetadataResponse.json();
          console.log(nftData);
          setGiftsSent((prev) => {
            return [
              ...prev,
              {
                giftData: gift.data,
                giftPda: giftPda,
                nftData: {
                  image: nftData.image as string,
                  name: nftData.name as string,
                },
              },
            ];
          });
        } catch (error) {
          console.log(error);
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
          className="flex h-[45px] flex-1 cursor-default select-none items-center justify-center bg-white px-5 text-[15px] leading-none text-mauve11 outline-none first:rounded-tl-md last:rounded-tr-md hover:text-violet11 data-[state=active]:text-violet11 data-[state=active]:border-b-2 data-[state=active]:border-b-black data-[state=active]:focus:relative"
          value="sent"
        >
          Sent
        </Tabs.Trigger>
        <Tabs.Trigger
          className="flex h-[45px] flex-1 cursor-default select-none items-center justify-center bg-white px-5 text-[15px] leading-none text-mauve11 outline-none first:rounded-tl-md last:rounded-tr-md hover:text-violet11 data-[state=active]:text-violet11 data-[state=active]:border-b-2 data-[state=active]:border-b-black data-[state=active]:focus:relative"
          value="received"
        >
          Received
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content
        className="grow rounded-b-md bg-white py-5 md:p-5 outline-none focus:shadow-black"
        value="sent"
      >
        <div className="columns-1 lg:columns-2 column-gap:[20px] min-h-screen">
          {giftsSent?.map((gift) => (
            <GiftCard gift={gift} received={false} key={gift.giftPda} />
          ))}
        </div>
      </Tabs.Content>
      <Tabs.Content
        className="grow rounded-b-md bg-white py-5 md:p-5 outline-none focus:shadow-black"
        value="received"
      >
        <div className="columns-1 lg:columns-2 column-gap:[20px] min-h-screen">
          {giftsReceived?.map((gift) => (
            <GiftCard key={gift.giftPda} received={true} gift={gift} />
          ))}
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
};

function GiftCard({
  gift,
  received,
}: {
  gift: GiftAndNFTData;
  received: boolean;
}) {
  const isClaimed = gift.giftData.claimed;
  const now = Math.floor(Date.now() / 1000);
  const deliveryDate = gift.giftData.deliveryDate;
  let tagLabel = "";
  let tagClass = "";

  if (isClaimed) {
    tagLabel = "claimed";
    tagClass = "bg-green-200";
  } else if (deliveryDate < now) {
    tagLabel = "not claimed";
    tagClass = "bg-red-200";
  } else {
    tagLabel = "yet to claim";
    tagClass = "bg-yellow-100";
  }

  return (
    <div
      key={gift.giftData.index}
      className="bg-white rounded-2xl p-5 mb-5 shadow-sm flex flex-col gap-1 break-inside-avoid"
    >
      <div className="rounded-2xl mb-2 text-left cursor-pointer overflow-hidden">
        <img
          src={
            gift.nftData.image
              ? gift.nftData.image
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
        <span className={`${tagClass} rounded-md py-0.5 px-3 text-xs`}>
          {tagLabel}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 mt-2">
        <div className="flex flex-row items-center justify-between w-full text-black/90 text-xs md:text-sm">
          <span className="flex items-center gap-1">
            <Calendar className="mr-1 w-4 h-4" />
            Created On
          </span>
          <span className="font-mono">
            {formatDate(gift.giftData.createdOn)}
          </span>
        </div>
        <div className="flex flex-row items-center justify-between w-full text-black/90 text-xs md:text-sm">
          <span className="flex items-center gap-1">
            <Van className="mr-1 w-4 h-4" />
            Delivery Date
          </span>
          <span className="font-mono">
            {formatDate(gift.giftData.deliveryDate)}
          </span>
        </div>
        <div className="flex flex-row items-center justify-between w-full text-black/90 text-xs md:text-sm">
          <span className="flex items-center gap-1">
            <DollarSign className="mr-1 w-4 h-4" />
            Gift Amount
          </span>
          <span className="font-mono">
            {gift.giftData.solAmount != null
              ? (
                  Number(gift.giftData.solAmount) / 1_000_000_000
                ).toLocaleString(undefined, {
                  minimumFractionDigits: 5,
                  maximumFractionDigits: 5,
                }) + " SOL"
              : "--"}
          </span>
        </div>
        {gift.giftData.claimed && (
          <div className="flex flex-row items-center justify-between w-full text-black/90 text-xs md:text-sm">
            <span className="flex items-center gap-1">
              <UserRoundCheck className="mr-1 w-4 h-4" />
              {received ? "Sender" : "Recipient"}
            </span>

            <CopyPubKeyButton
              assetRecipient={!received ? gift.giftData.assetRecipient : null}
              giftSender={received ? gift.giftData.sender : null}
            />
          </div>
        )}
        {gift.giftData.claimed && (
          <div className="flex flex-row items-center justify-between w-full text-black/90 text-xs md:text-sm">
            <span className="flex items-center gap-1">
              <PackageCheck className="mr-1 w-4 h-4" />
              Claimed On
            </span>
            <span className="font-mono">
              {gift.giftData.claimedOn
                ? formatDate(gift.giftData.claimedOn)
                : "--"}
            </span>
          </div>
        )}
        {!received && <CopyGiftURL gift={gift} />}
      </div>
    </div>
  );
}

function CopyPubKeyButton({
  assetRecipient,
  giftSender,
}: {
  giftSender: string | null;
  assetRecipient: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const displayValue = assetRecipient
    ? `${assetRecipient.slice(0, 4)}...${assetRecipient.slice(-4)}`
    : giftSender
      ? `${giftSender.slice(0, 4)}...${giftSender.slice(-4)}`
      : "--";

  const handleCopy = () => {
    if (assetRecipient) {
      navigator.clipboard.writeText(assetRecipient);
      setCopied(true);
      toast.success("Copied Address successfully");
      setTimeout(() => setCopied(false), 2000);
    } else if (giftSender) {
      navigator.clipboard.writeText(giftSender);
      setCopied(true);
      toast.success("Copied Address successfully");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!assetRecipient}
      className="flex items-center font-mono break-all text-right max-w-[150px] py-0.5 px-1 rounded hover:bg-gray-100 transition-all"
      title={assetRecipient ? "Copy to clipboard" : undefined}
      aria-label="Copy recipient address"
    >
      <span className="mr-1 w-4 h-4 flex items-center justify-center">
        {copied ? (
          <Check className="w-4 h-4 text-green-600" />
        ) : (
          <Copy className="w-4 h-4 text-gray-500" />
        )}
      </span>
      <span>{displayValue}</span>
    </button>
  );
}

function CopyGiftURL({ gift }: { gift: GiftAndNFTData }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    let baseUrl = "";
    if (typeof window !== "undefined") {
      baseUrl = window.location.origin;
    } else {
      baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    }
    const url = `${baseUrl}/claim/${gift.giftPda}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success(
      "Gift URL copied! Send this to your friend on their birthday or for a surprise."
    );
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      className={`w-full text-black flex items-center justify-center gap-2 text-center py-2 rounded-lg font-medium mt-3 transition-colors duration-150 border ${
        copied ? "bg-green-200 border-green-200" : "bg-white border-black"
      }`}
      onClick={handleCopy}
      type="button"
    >
      {copied ? (
        <Check className="w-4 h-4 text-black" />
      ) : (
        <Copy className="w-4 h-4 text-black" />
      )}
      {copied ? "Copied!" : "Copy gift URL to share!"}
    </button>
  );
}

export default Gifts;
