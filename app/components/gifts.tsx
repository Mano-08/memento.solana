"use client";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/app/components/ui/dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs } from "radix-ui";
import {
  ConnectedStandardSolanaWallet,
  useWallets as privyUseWallets,
} from "@privy-io/react-auth/solana";
import { UiWalletAccount, useWallets } from "@wallet-standard/react";

import {
  appendTransactionMessageInstructions,
  assertIsFullySignedTransaction,
  assertIsTransactionWithBlockhashLifetime,
  createKeyPairSignerFromPrivateKeyBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getBase64Encoder,
  getSignatureFromTransaction,
  Instruction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  TransactionSigner,
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
  getCancelGiftInstruction,
  Gift,
  GiftStatus,
  SOLGIFT_PROGRAM_ADDRESS,
} from "@/app/generated/solgift";
import {
  DigitalAsset,
  fetchDigitalAsset,
  findAssociatedTokenPda,
} from "@metaplex-foundation/mpl-token-metadata-kit";
import {
  decryptQuestion,
  formatDate,
  u16ToLeBytes,
} from "@/app/helper/compute";
import { useConnector } from "@solana/connector/react";
import { usePrivy } from "@privy-io/react-auth";
import {
  Calendar,
  Check,
  Copy,
  DollarSign,
  EllipsisVertical,
  LockKeyhole,
  Mail,
  PackageCheck,
  UserRoundCheck,
  Van,
} from "lucide-react";
import { toast } from "sonner";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  claimRentAuthorizedClaimer,
  createAuthorizedRecipientSigner,
  createPrivySigner,
} from "../lib/utils";
import {
  useWalletAccountTransactionSendingSigner,
  useWalletAccountTransactionSigner,
} from "@solana/react";
import { ClaimGiftErrors } from "../lib/types";
import { getAddMemoInstruction } from "@solana-program/memo";

type GiftAndNFTData = {
  giftData: Gift;
  giftPda: string;
  nftData: {
    image: string;
    name: string;
  };
};

const Gifts = () => {
  const [userWallet, setUserWallet] = useState<Address | null>(null);
  const { ready, user, authenticated } = usePrivy();
  const { isConnected, isConnecting, account, connector } = useConnector();
  const connectedToExternalWallet = useMemo(
    () => !isConnecting && !!isConnected && !!account && !!connector,
    [isConnecting, isConnected, account, connector]
  );
  const connectedToEmbeddedWallet = useMemo(
    () => !!ready && !!user && !!authenticated,
    [ready, user, authenticated]
  );

  const uiWallets = useWallets();
  const { wallets } = privyUseWallets();
  const wallet = useCallback(
    () => wallets.find((w) => w.standardWallet?.name === "Privy"),
    [wallets]
  )();
  const uiWalletAccount = useCallback(() => {
    return (
      uiWallets.flatMap((w) => w.accounts).find((a) => a.address === account) ??
      null
    );
  }, [uiWallets, account])();

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

  return connectedToExternalWallet && uiWalletAccount !== null ? (
    <SupportExternalWallet
      uiWalletAccount={uiWalletAccount}
      userWallet={userWallet}
    />
  ) : (
    connectedToEmbeddedWallet && wallet !== undefined && (
      <SupportEmbeddedWallet wallet={wallet} userWallet={userWallet} />
    )
  );
};

function SupportExternalWallet({
  uiWalletAccount,
  userWallet,
}: {
  uiWalletAccount: UiWalletAccount;
  userWallet: Address | null;
}) {
  const signer = useWalletAccountTransactionSigner(
    uiWalletAccount,
    "solana:devnet"
  );
  return <GiftsSection signer={signer} userWallet={userWallet} />;
}

function SupportEmbeddedWallet({
  wallet,
  userWallet,
}: {
  wallet: ConnectedStandardSolanaWallet;
  userWallet: Address | null;
}) {
  const signer = createPrivySigner(wallet);
  return <GiftsSection signer={signer} userWallet={userWallet} />;
}

function GiftsSection({
  signer,
  userWallet,
}: {
  signer: TransactionSigner<string>;
  userWallet: Address | null;
}) {
  const encoder = new TextEncoder();
  const addressEncoder = getAddressEncoder();

  const [giftsReceived, setGiftsReceived] = useState<GiftAndNFTData[]>([]);
  const [giftsSent, setGiftsSent] = useState<GiftAndNFTData[]>([]);

  // ADD loading state for both sent and received
  const [loadingSent, setLoadingSent] = useState(false);
  const [loadingReceived, setLoadingReceived] = useState(false);

  useEffect(() => {
    if (userWallet) {
      fetchGiftsSent();
      fetchGiftsReceived();
    }
  }, [userWallet]);

  async function fetchGiftsReceived() {
    setLoadingReceived(true);
    setGiftsReceived([]); // clear previous results
    try {
      const giftsReceivedResponse = await fetch(
        `/api/v1/users/${userWallet}/gifts/received`
      );
      const giftsReceived = await giftsReceivedResponse.json();
      // giftsReceived.data is an array of {gift_pda: string}
      const received = giftsReceived.data ?? [];
      const newGifts: GiftAndNFTData[] = [];
      for (let i = 0; i < received.length; i++) {
        const { gift_pda } = received[i];
        try {
          const gift = await fetchGift(rpc, gift_pda);
          const nftMint = gift.data.nftMint;
          const nftMintAddress = address(nftMint);
          const nft = await fetchDigitalAsset(rpc, nftMintAddress);
          const nftMetadataResponse = await fetch(nft.metadata.uri);
          const nftData = await nftMetadataResponse.json();
          newGifts.push({
            giftData: gift.data,
            giftPda: gift_pda,
            nftData: {
              image: nftData.image as string,
              name: nftData.name as string,
            },
          });
        } catch (error) {
          console.log(
            "Failed to fetch received gift for gift_pda",
            gift_pda,
            error
          );
        }
      }
      setGiftsReceived(newGifts);
    } catch (error) {
      console.log("Failed to fetch received gifts", error);
    } finally {
      setLoadingReceived(false);
    }
  }

  async function fetchGiftsSent() {
    setLoadingSent(true);
    setGiftsSent([]); // clear previous results
    try {
      if (!userWallet) return;
      const [userPda] = await getProgramDerivedAddress({
        programAddress: SOLGIFT_PROGRAM_ADDRESS,
        seeds: [encoder.encode("user"), addressEncoder.encode(userWallet)],
      });
      const userAccount = await fetchUser(rpc, userPda);

      const count = userAccount.data.count;
      const sentGifts: GiftAndNFTData[] = [];
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

          const nftMintAddress = address(gift.data.nftMint);
          const nft = await fetchDigitalAsset(rpc, nftMintAddress);
          const nftMetadataResponse = await fetch(nft.metadata.uri);
          const nftData = await nftMetadataResponse.json();

          sentGifts.push({
            giftData: gift.data,
            giftPda: giftPda,
            nftData: {
              image: nftData.image as string,
              name: nftData.name as string,
            },
          });
        } catch (error) {
          console.log(error);
          console.log("index not found", index);
        }
      }
      setGiftsSent(sentGifts);
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingSent(false);
    }
  }
  const [email, setEmail] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [cancelGift, setCancelGift] = useState<GiftAndNFTData | null>(null);
  const [cipher, setCipher] = useState<string>("");
  const [decrypted, setDecrypted] = useState<string>("");

  async function handleDecryptQuestion(email: string) {
    try {
      if (!cancelGift) return;
      const res = await decryptQuestion(
        cipher,
        new Uint8Array(cancelGift.giftData.salt),
        email
      );
      setDecrypted(res);
    } catch (error) {
      console.error(error);
    }
  }
  useEffect(() => {
    handleDecryptQuestion(email);
  }, [email]);

  async function confirmCancelGift({ gift }: { gift: GiftAndNFTData }) {
    setCancelGift(gift);
    try {
      const response = await fetch(`/api/v1/gifts/${gift.giftPda}`, {
        method: "GET",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData);
      }
      const dbData = await response.json();
      setCipher(dbData.data.security_question || "");
    } catch (error) {
      throw error;
    }
  }

  function setCancelGiftDialogOpen() {
    setCancelGift(null);
    setEmail("");
    setAnswer("");
  }

  async function handleCancelGift() {
    const gift = cancelGift;
    if (!gift) return;
    console.log(
      gift,
      GiftStatus.Cancelled,
      GiftStatus.Claimed,
      GiftStatus.NotClaimed
    );
    if (gift.giftData.status === GiftStatus.NotClaimed) {
      try {
        const index = gift.giftData.index;
        const salt = gift.giftData.salt;
        const combined_reverse = new Uint8Array([
          ...salt,
          ...encoder.encode(email),
          ...encoder.encode(answer),
        ]);

        const seed = new Uint8Array(
          await crypto.subtle.digest("SHA-256", combined_reverse)
        );
        const authorizedClaimerKeypair =
          await createKeyPairSignerFromPrivateKeyBytes(seed);
        const authorizedClaimerSigner = createAuthorizedRecipientSigner(
          authorizedClaimerKeypair
        );
        const instructions = [];

        console.log(gift, "PINOG PO");

        const nftMint = gift.giftData.nftMint;
        const [giftPda] = await getProgramDerivedAddress({
          programAddress: SOLGIFT_PROGRAM_ADDRESS,
          seeds: [
            encoder.encode("gift"),
            addressEncoder.encode(signer.address),
            u16ToLeBytes(index),
          ],
        });
        const [giftNftAta] = await findAssociatedTokenPda({
          mint: nftMint,
          owner: giftPda,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
        });
        const cancelGiftIx = getCancelGiftInstruction({
          signer: signer,
          authorizedClaimer: authorizedClaimerSigner,
          gift: giftPda,
          giftNftAta: giftNftAta,
          nftMint: nftMint,
        });
        instructions.push(cancelGiftIx);

        async function sendAndConfirm(options: {
          instructions: Instruction[];
          payer: TransactionSigner<string>;
        }) {
          const { instructions, payer } = options;

          const { value: latestBlockhash } = await rpc
            .getLatestBlockhash()
            .send();

          console.log(payer.address, authorizedClaimerSigner.address, "BLINK");

          const transactionMessage = pipe(
            createTransactionMessage({ version: 0 }),
            (tx) => setTransactionMessageFeePayerSigner(payer, tx),
            (tx) =>
              appendTransactionMessageInstructions(
                [
                  getAddMemoInstruction({
                    memo: "adding signer",
                    signers: [authorizedClaimerSigner, payer],
                  }),
                ],
                tx
              ),
            (tx) =>
              setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
            (tx) => appendTransactionMessageInstructions(instructions, tx)
          );

          const signedTransaction =
            await signTransactionMessageWithSigners(transactionMessage);

          assertIsTransactionWithBlockhashLifetime(signedTransaction);
          assertIsFullySignedTransaction(signedTransaction);

          const transactionSigners = signedTransaction.signatures;

          console.log("✅ Signers signature status:");
          Object.entries(transactionSigners).forEach(
            ([address, signature], i) => {
              const hasSignature = signature !== null;
              if (hasSignature) {
                console.log(`  [${i}] Signed: ${address}`);
              } else {
                console.log(`  [${i}] NOT SIGNED: ${address}`);
              }
            }
          );

          assertIsTransactionWithBlockhashLifetime(signedTransaction);

          // ── Simulate first to get full logs before attempting send ───────────────
          try {
            const { value: simulation } = await rpc
              .simulateTransaction(
                getBase64EncodedWireTransaction(signedTransaction), // encode signed tx → base64 wire format
                {
                  encoding: "base64",
                  replaceRecentBlockhash: true, // use current blockhash for simulation
                  commitment: "confirmed",
                }
              )
              .send();

            if (simulation.err) {
              console.error(
                "❌ Simulation error:",
                JSON.stringify(
                  simulation.err,
                  (_, v) => (typeof v === "bigint" ? v.toString() : v),
                  2
                )
              );
              console.error("📋 Logs:");
              simulation.logs?.forEach((log, i) =>
                console.log(`  [${i}] ${log}`)
              );
              throw new Error(
                `Simulation failed: ${JSON.stringify(
                  simulation.err,
                  (_, v) => (typeof v === "bigint" ? v.toString() : v),
                  2
                )}`
              );
            }

            console.log("✅ Simulation passed, sending...");
            console.log("📋 Simulation logs:");
            simulation.logs?.forEach((log, i) =>
              console.log(`  [${i}] ${log}`)
            );
          } catch (simErr: any) {
            // SolanaError wraps simulation errors — extract the logs
            const logs = simErr?.context?.logs ?? simErr?.logs ?? [];
            console.error("❌ Simulation threw:", simErr?.message ?? simErr);
            logs.forEach((log: string, i: number) =>
              console.log(`  [${i}] ${log}`)
            );

            throw simErr;
          }

          try {
            await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(
              signedTransaction,
              { commitment: "confirmed" }
            );
            console.log(
              "WAS JUST ABOUT TO SEND THE TRANSACTION VIA sendAndConfirmTransactionFactory"
            );
          } catch (err: any) {
            // @solana/kit wraps the RPC error — the logs are in err.context
            console.error("❌ Send failed:", err?.message);
            console.error("   Error code:", err?.context?.err);

            const logs: string[] = err?.context?.logs ?? [];
            if (logs.length) {
              console.error("📋 Transaction logs:");
              logs.forEach((log, i) => console.error(`  [${i}] ${log}`));
            } else {
              // Fall back to full error dump
              console.error(
                "   Full error:",
                JSON.stringify(
                  err,
                  (_, v) => (typeof v === "bigint" ? v.toString() : v),
                  2
                )
              );
            }

            throw err;
          }

          const sig = getSignatureFromTransaction(signedTransaction);
          return sig;
        }

        try {
          const signature = await sendAndConfirm({
            payer: signer,
            instructions,
          });

          toast.success(
            <span>
              Gift cancelled successfully.{" "}
              <a
                href={`https://solscan.io/tx/${signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#6366f1", textDecoration: "underline" }}
              >
                View on Solscan
              </a>
            </span>
          );
          // Update the gift in the giftsSent state, marking its status as Cancelled
          setGiftsSent((prev) =>
            prev.map((g) =>
              g.giftPda === gift.giftPda
                ? {
                    ...g,
                    giftData: {
                      ...g.giftData,
                      status: GiftStatus.Cancelled,
                    },
                  }
                : g
            )
          );
        } catch (error) {
          console.log(error);
          toast.error("Failed to Cancel the gift");
        }

        // await fetchGiftsSent();

        await claimRentAuthorizedClaimer({
          nftMint,
          authorizedClaimerKeypair,
          sender: gift.giftData.sender,
        });
      } catch (e) {
        toast.error("Failed to cancel gift.");
        console.error(e);
      }
    } else if (gift.giftData.status === GiftStatus.Cancelled) {
      toast.error("You cannot cancel an already cancelled gift.");
    } else {
      toast.error("You cannot cancel a claimed gift.");
    }
  }

  function handleSetSecurityAnswer(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Allow only English letters, ignore numbers, specials, spaces
    // Convert to lower case, filter only a-z using charCode
    let filtered = "";
    for (let i = 0; i < raw.length; i++) {
      let c = raw[i];
      // Get char code
      let code = c.charCodeAt(0);
      // If upper case A-Z: 65-90, convert to lower case
      if (code >= 65 && code <= 90) {
        c = c.toLowerCase();
        code = c.charCodeAt(0);
      }
      // Allow only lower case a-z: 97-122
      if (code >= 97 && code <= 122) {
        filtered += c;
      }
    }
    setAnswer(filtered);
  }

  return (
    <Tabs.Root className="flex w-full flex-col" defaultValue="sent">
      <Dialog open={cancelGift !== null} onOpenChange={setCancelGiftDialogOpen}>
        <DialogContent className="lg:max-w-md [&>button]:hidden rounded-[24px]">
          <DialogHeader className="flex flex-row items-center justify-between px-7 pt-7">
            <DialogTitle className="text-base text-left">
              Cancel Gift
            </DialogTitle>
          </DialogHeader>
          <fieldset
            className={`flex w-full font-semibold text-sm flex-col gap-2 justify-between items-start px-7`}
          >
            <label
              className="flex flex-row items-center gap-2 text-neutral-500 leading-none"
              htmlFor="cancelGiftEmail"
            >
              <Mail size={16} /> Email
            </label>
            <div className="w-full rounded-lg bg-white">
              <input
                className={`
                  rounded-lg w-full shrink-0 text-left px-1.5 grow border text-sm py-2 leading-none text-neutral-800 bg-transparent
                  border-neutral-300
                  focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:border-neutral-200
                  transition
                `}
                id="cancelGiftEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Recipient Email Address"
                name="cancelGiftEmail"
              />
            </div>
          </fieldset>
          {decrypted && (
            <fieldset
              className={`flex w-full font-semibold text-sm flex-col gap-2 justify-between items-start px-7`}
            >
              <label
                className="flex flex-row items-center gap-2 text-neutral-500 leading-none"
                htmlFor="cancelGiftAnswer"
              >
                <LockKeyhole size={16} /> {decrypted}
              </label>
              <div className="w-full rounded-lg bg-white">
                <input
                  className={`
                  rounded-lg w-full shrink-0 text-left px-1.5 grow border text-sm py-2 leading-none text-neutral-800 bg-transparent
                  border-neutral-300
                  focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:border-neutral-200
                  transition
                `}
                  id="cancelGiftAnswer"
                  type="text"
                  value={answer}
                  onChange={handleSetSecurityAnswer}
                  placeholder="answer to security question"
                  name="cancelGiftAnswer"
                />
              </div>
            </fieldset>
          )}
          <div className="w-full flex justify-end mt-2">
            <button
              type="button"
              className="py-5 w-full disabled:cursor-not-allowed disabled:text-red-300 text-red-600 hover:text-red-500 font-semibold cursor-pointer border-t border-solid border-neutral-400 text-sm flex flex-row items-center justify-center gap-2"
              onClick={handleCancelGift}
            >
              Cancel Gift
            </button>
          </div>
        </DialogContent>
      </Dialog>
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
        className="grow rounded-b-md bg-white py-5 lg:p-5 outline-none focus:shadow-black"
        value="sent"
      >
        <div className="columns-1 lg:columns-2 column-gap:[20px] min-h-screen">
          {loadingSent ? (
            <div className="text-center text-neutral-400 py-6">
              Loading gifts sent...
            </div>
          ) : giftsSent.length === 0 ? (
            <div className="text-center text-neutral-400 py-6">
              No gifts sent.
            </div>
          ) : (
            giftsSent?.map((gift) => (
              <GiftCard
                gift={gift}
                received={false}
                key={gift.giftPda}
                handleCancelGift={() => {
                  confirmCancelGift({ gift });
                }}
              />
            ))
          )}
        </div>
      </Tabs.Content>
      <Tabs.Content
        className="grow rounded-b-md bg-white py-5 lg:p-5 outline-none focus:shadow-black"
        value="received"
      >
        <div className="columns-1 lg:columns-2 column-gap:[20px] min-h-screen">
          {loadingReceived ? (
            <div className="text-center text-neutral-400 py-6">
              Loading gifts received...
            </div>
          ) : giftsReceived.length === 0 ? (
            <div className="text-center text-neutral-400 py-6">
              No gifts received.
            </div>
          ) : (
            giftsReceived?.map((gift) => (
              <GiftCard key={gift.giftPda} received={true} gift={gift} />
            ))
          )}
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
}

function GiftCard({
  gift,
  received,
  handleCancelGift,
}: {
  gift: GiftAndNFTData;
  received: boolean;
  handleCancelGift?: () => void;
}) {
  const isClaimed = gift.giftData.status === GiftStatus.Claimed;
  const isCancelled = gift.giftData.status === GiftStatus.Cancelled;
  const now = Math.floor(Date.now() / 1000);
  const deliveryDate = gift.giftData.deliveryDate;
  let tagLabel = "";
  let tagClass = "";

  if (isClaimed) {
    tagLabel = "claimed";
    tagClass = "bg-green-200";
  } else if (isCancelled) {
    tagLabel = "cancelled";
    tagClass = "bg-red-200";
  } else if (deliveryDate < now) {
    tagLabel = "not claimed";
    tagClass = "bg-red-200";
  } else {
    tagLabel = "not delivered";
    tagClass = "bg-yellow-100";
  }

  return (
    <div
      key={gift.giftData.index}
      className="bg-white rounded-2xl p-5 mb-5 shadow-sm flex flex-col gap-1 break-inside-avoid"
    >
      <div className="rounded-2xl mb-2 text-left cursor-pointer overflow-hidden relative">
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
      <div className="font-bold text-lg relative">
        {gift.nftData.name || "Gift Name"}
        {!received && (
          <div className="absolute top-2 right-2 z-10">
            <GiftDropdown handleCancelGift={handleCancelGift} />
          </div>
        )}
      </div>
      <div>
        <span className={`${tagClass} rounded-md py-0.5 px-3 text-xs`}>
          {tagLabel}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 mt-2">
        <div className="flex flex-row items-center justify-between w-full text-black/90 text-xs lg:text-sm">
          <span className="flex items-center gap-1">
            <Calendar className="mr-1 w-4 h-4" />
            Created On
          </span>
          <span className="font-mono">
            {formatDate(gift.giftData.createdOn)}
          </span>
        </div>
        <div className="flex flex-row items-center justify-between w-full text-black/90 text-xs lg:text-sm">
          <span className="flex items-center gap-1">
            <Van className="mr-1 w-4 h-4" />
            Delivery Date
          </span>
          <span className="font-mono">
            {formatDate(gift.giftData.deliveryDate)}
          </span>
        </div>
        <div className="flex flex-row items-center justify-between w-full text-black/90 text-xs lg:text-sm">
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
        {gift.giftData.status === GiftStatus.Claimed && (
          <div className="flex flex-row items-center justify-between w-full text-black/90 text-xs lg:text-sm">
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
        {gift.giftData.status === GiftStatus.Claimed && (
          <div className="flex flex-row items-center justify-between w-full text-black/90 text-xs lg:text-sm">
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
    // alert(":");
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

// Dropdown Menu component for settings
function GiftDropdown({ handleCancelGift }: { handleCancelGift?: () => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      // @ts-ignore
      if (!e.target?.closest?.(`#settings-dropdown-menu`)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" id="settings-dropdown-menu">
      <button
        type="button"
        className="p-1 rounded-full cursor-default hover:bg-gray-100/50 focus:bg-gray-200/50 bg-gray-100/30 focus:outline-none"
        aria-label="Settings"
        onClick={() => setOpen((v) => !v)}
      >
        <EllipsisVertical size={16} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-1">
          <button
            type="button"
            className="w-full cursor-pointer px-3 py-1 text-left text-sm text-red-600 hover:bg-gray-50 rounded-t-lg rounded-b-lg"
            onClick={handleCancelGift}
          >
            Cancel Gift
          </button>
        </div>
      )}
    </div>
  );
}

export default Gifts;
