"use client";

import { usePrivy } from "@privy-io/react-auth"; // or from wherever your wallet hook comes
import { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";
import {
  fetchGift,
  getClaimGiftInstruction,
  Gift,
  GiftStatus,
} from "@/app/generated/solgift";
import { UiWalletAccount, useWallets } from "@wallet-standard/react";
import {
  ArrowRight,
  Calendar,
  Check,
  DollarSign,
  Key,
  Mail,
  Puzzle,
} from "lucide-react";
import { getAddMemoInstruction } from "@solana-program/memo";
import { decryptQuestion, recursiveSha256 } from "@/app/helper/compute";

import { REGEXP_ONLY_DIGITS } from "input-otp";

import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

function InputOTPPattern({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field className="w-fit px-7 text-neutral-500">
      <FieldLabel
        htmlFor="digits-only"
        className="flex flex-row items-center gap-2"
      >
        <Key size={16} />
        Enter OTP
      </FieldLabel>
      <InputOTP
        id="digits-only"
        maxLength={4}
        pattern={REGEXP_ONLY_DIGITS}
        value={value}
        onChange={onChange}
      >
        <InputOTPGroup className="text-neutral-800 font-semibold">
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
        </InputOTPGroup>
      </InputOTP>
    </Field>
  );
}

import {
  fetchDigitalAsset,
  findAssociatedTokenPda,
} from "@metaplex-foundation/mpl-token-metadata-kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  Account,
  address,
  Address,
  appendTransactionMessageInstructions,
  assertIsFullySignedTransaction,
  assertIsTransactionWithBlockhashLifetime,
  createKeyPairSignerFromPrivateKeyBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  Instruction,
  KeyPairSigner,
  lamports,
  pipe,
  ReadonlyUint8Array,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  Signature,
  signTransactionMessageWithSigners,
  TransactionSigner,
} from "@solana/kit";
import { useWallets as privyUseWallets } from "@privy-io/react-auth/solana";
import { useParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { useConnector } from "@solana/connector/react";
import {
  claimRentAuthorizedClaimer,
  createAuthorizedRecipientSigner,
  createPrivySigner,
} from "@/app/lib/utils";
import { getTransferSolInstruction } from "@solana-program/system";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import Link from "next/link";
import { useWalletAccountTransactionSigner } from "@solana/react";
import { ConnectButton } from "@/app/components/connect-button";
import { IconXmark } from "symbols-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { signatureBytesToBase58 } from "@solana/connector";
import CustomConfetti from "@/app/components/confetti";
import { toast } from "sonner";
import { Spinner } from "@/app/components/ui/spinner";
import { sendOtpToEmailAddress } from "@/app/lib/nodemailer/mail";
import { SparkleCluster } from "@/app/components/stars";
import { ClaimGiftErrors } from "@/app/lib/types";

const rpc = createSolanaRpc("https://api.devnet.solana.com");
const rpcSubscriptions = createSolanaRpcSubscriptions(
  "wss://api.devnet.solana.com"
);

type GiftClaimedResponse = {
  gift: Account<Gift, string>;
  nft: { name: string; image: string };
  signature: string;
} | null;

export enum GiftClaimStages {
  VerifyAnswer = "verify_answer",
  ClaimingGift = "claiming_gift",
}

export enum GiftClaimingStatus {
  Loading = "loading",
  Success = "success",
  Error = "error",
}

type GiftClaimStage = {
  info?: string;
  stage: GiftClaimStages;
  status: GiftClaimingStatus;
  errorMessage?: string;
};

// const SOLGIFT_PROGRAM_ADDRESS: Address = idl.address as Address;

// This page pulls the gift_pda from the URL, then sets up React state hooks
export default function Page() {
  const [giftClaimStages, setGiftClaimStages] = useState<GiftClaimStage[]>([]);
  const { ready, user, authenticated } = usePrivy();
  const { isConnected, account, connector } = useConnector();

  const connectedToExternalWallet = isConnected && account && connector;
  const connectedToEmbeddedWallet = ready && user && authenticated;
  const encoder = new TextEncoder();
  const params = useParams();
  const uiWallets = useWallets();
  const { wallets } = privyUseWallets();
  const uiWalletAccount =
    uiWallets.flatMap((w) => w.accounts).find((a) => a.address === account) ??
    null;

  const wallet = wallets.find((w) => w.standardWallet?.name === "Privy");
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

  console.log(connectedToEmbeddedWallet, "connectedToEmbeddedWallet --anakns ");

  // gift_pda is the param key from /claim/[gift_pda]
  const gift_pda =
    typeof params === "object" && params !== null
      ? (params as { [key: string]: string })["gift_pda"]
      : "";
  const [gift, setGift] = useState<Account<Gift, string> | null>(null);
  const [cipher, setCipher] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [decrypted, setDecrypted] = useState<string>("");
  const [claimGiftError, setClaimGiftError] = useState<ClaimGiftErrors | null>(
    null
  );
  const [giftReceivedModalOpen, setGiftReceivedModalOpen] =
    useState<boolean>(false);
  const [giftClaimed, setGiftClaimed] = useState<GiftClaimedResponse>(null);
  console.log(cipher);

  // Fetch cipher and gift data
  useEffect(() => {
    async function fetchData() {
      try {
        // 1. Check if gift_pda is a valid Solana address
        if (
          typeof gift_pda !== "string" ||
          !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(gift_pda)
        ) {
          setClaimGiftError(ClaimGiftErrors.INVALID_GIFT_ID);
          throw new Error("Invalid Gift ID");
        }

        console.log("CHECK 1 passed");

        // 2. Check if gift exists onchain, if not skip backend call
        const giftData = await fetchGift(rpc, gift_pda as Address);
        console.log("giftData, giftData", giftData, gift_pda, rpc);
        if (!giftData) {
          setClaimGiftError(ClaimGiftErrors.GIFT_DOESNT_EXIST);
          throw new Error("Gift does not exist onchain");
        }
        setGift(giftData);
        console.log("CHECK 2 passed");

        // Now call backend API for metadata, etc.
        const response = await fetch(`/api/v1/gifts/${gift_pda}`, {
          method: "GET",
        });
        if (!response.ok) {
          setClaimGiftError(ClaimGiftErrors.GIFT_DOESNT_EXIST);
          const errorData = await response.json();
          throw new Error(errorData);
        }
        const dbData = await response.json();
        setCipher(dbData.data.security_question || "");
      } catch (err: any) {
        console.error("Failed to fetch data", err);
      }
    }
    fetchData();
  }, [gift_pda]);

  async function claimGift(answer: string, signer: TransactionSigner<string>) {
    setIsClaimingGift(true);
    setGiftReceivedModalOpen(true);
    try {
      if (!(connectedToEmbeddedWallet || connectedToExternalWallet)) return;
      if (!gift) {
        toast.error("Failed to fetch gift detials.");
        throw new Error("Faield to fetch gift details.");
      }

      setGiftClaimStages((prev) => {
        return [
          ...prev,
          {
            errorMessage: "",
            stage: GiftClaimStages.VerifyAnswer,
            status: GiftClaimingStatus.Loading,
          },
        ];
      });

      const salt = gift.data.salt;
      const nftMint = gift.data.nftMint;

      const combined_reverse = new Uint8Array([
        ...salt,
        ...encoder.encode(email.toString()),
        ...encoder.encode(answer),
      ]);

      const seed = new Uint8Array(
        await crypto.subtle.digest("SHA-256", combined_reverse)
      );
      const authorizedClaimerKeypair =
        await createKeyPairSignerFromPrivateKeyBytes(new Uint8Array(seed));

      if (authorizedClaimerKeypair.address !== gift.data.authorizedClaimer) {
        toast.error("Unauthorized claimer");
        setGiftClaimStages((prev) => {
          const idx = prev.findIndex(
            (s) => s.stage === GiftClaimStages.VerifyAnswer
          );
          if (idx !== -1) {
            // Update existing UploadingImage stage
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              errorMessage: "Incorrect answer",
              status: GiftClaimingStatus.Error,
            };
            return updated;
          }
          // If not found, just return prev unchanged (or you may choose to push, but per instruction do not)
          return prev;
        });
        throw new Error("Incorrect answer");
      }
      setGiftClaimStages((prev) => {
        const idx = prev.findIndex(
          (s) => s.stage === GiftClaimStages.VerifyAnswer
        );
        if (idx !== -1) {
          // Update existing UploadingImage stage
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            errorMessage: "",
            status: GiftClaimingStatus.Success,
          };
          return updated;
        }
        // If not found, just return prev unchanged (or you may choose to push, but per instruction do not)
        return prev;
      });
      const payer = createAuthorizedRecipientSigner(authorizedClaimerKeypair);

      const [giftNftAta] = await findAssociatedTokenPda({
        mint: nftMint,
        owner: gift_pda as Address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      });
      const [assetRecipientNftAta] = await findAssociatedTokenPda({
        mint: nftMint,
        owner: address(signer.address),
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      });
      console.log(
        {
          authorizedClaimer: payer,
          assetRecipient: signer,
          gift: address(gift_pda),
          nftMint: nftMint,
          giftNftAta: giftNftAta,
          assetRecipientNftAta: assetRecipientNftAta,
          // answerHash: answerHash_n_2,
        },
        "CLAIM GIFT INFOR"
      );
      const claimGiftIx = getClaimGiftInstruction({
        authorizedClaimer: payer,
        assetRecipient: signer,
        gift: address(gift_pda),
        nftMint: nftMint,
        giftNftAta: giftNftAta,
        assetRecipientNftAta: assetRecipientNftAta,
      });

      console.log("NFT MINT ADDRSEE", nftMint);
      const instructions = [];
      instructions.push(claimGiftIx);

      async function sendAndConfirm(options: {
        instructions: Instruction[];
        payer: TransactionSigner<string>;
      }) {
        const { instructions, payer } = options;

        const { value: latestBlockhash } = await rpc
          .getLatestBlockhash()
          .send();

        console.log(payer.address, signer.address, "BLINK");

        const transactionMessage = pipe(
          createTransactionMessage({ version: 0 }),
          (tx) => setTransactionMessageFeePayerSigner(payer, tx),
          (tx) =>
            appendTransactionMessageInstructions(
              [
                getAddMemoInstruction({
                  memo: "adding signer",
                  signers: [payer, signer],
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
            setClaimGiftError(ClaimGiftErrors.FAILED_TO_CLAIM_GIFT);
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
          simulation.logs?.forEach((log, i) => console.log(`  [${i}] ${log}`));
        } catch (simErr: any) {
          // SolanaError wraps simulation errors — extract the logs
          setClaimGiftError(ClaimGiftErrors.FAILED_TO_CLAIM_GIFT);
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
          setClaimGiftError(ClaimGiftErrors.FAILED_TO_CLAIM_GIFT);
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

      let sx: Signature | null = null;
      try {
        sx = await sendAndConfirm({
          instructions,
          payer: payer,
        });

        toast.success(
          <span>
            Gift cancelled successfully.{" "}
            <a
              href={`https://solscan.io/tx/${sx}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#6366f1", textDecoration: "underline" }}
            >
              View on Solscan
            </a>
          </span>
        );
      } catch (error) {
        setGiftClaimStages((prev) => {
          const idx = prev.findIndex(
            (s) => s.stage === GiftClaimStages.ClaimingGift
          );
          if (idx !== -1) {
            // Update existing UploadingImage stage
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              errorMessage: "Couldnt Claim Gift, try again!",
              status: GiftClaimingStatus.Error,
            };
            return updated;
          }
          // If not found, just return prev unchanged (or you may choose to push, but per instruction do not)
          return prev;
        });
        throw error;
      }

      setGiftClaimStages((prev) => {
        return [
          ...prev,
          {
            errorMessage: "",
            stage: GiftClaimStages.ClaimingGift,
            status: GiftClaimingStatus.Loading,
          },
        ];
      });
      // const sx = await sendAndConfirm({
      //   instructions,
      //   payer: payer,
      // });

      setGiftClaimStages((prev) => {
        const idx = prev.findIndex(
          (s) => s.stage === GiftClaimStages.ClaimingGift
        );
        if (idx !== -1) {
          // Update existing UploadingImage stage
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            errorMessage: "",
            status: GiftClaimingStatus.Success,
          };
          return updated;
        }
        // If not found, just return prev unchanged (or you may choose to push, but per instruction do not)
        return prev;
      });

      await claimRentAuthorizedClaimer({
        nftMint,
        authorizedClaimerKeypair,
        sender: gift.data.sender,
      });

      try {
        // It is generally better practice to include a JSON body even if your backend handler uses URL params,
        // for explicitness and forward compatibility. Many APIs include required information in the body.
        // Industry convention: Always send a JSON payload if your HTTP method is POST.
        const response = await fetch(
          `/api/v1/users/${address(signer.address)}/gifts/${gift_pda}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              recipient: address(signer.address),
              gift_pda: gift_pda,
            }),
          }
        );

        if (!response.ok) {
          setClaimGiftError(ClaimGiftErrors.FAILED_TO_CLAIM_GIFT);
          const error = await response.json();
          console.error("Failed to notify backend about claimed gift:", error);
        } else {
          const result = await response.json();
          console.log(
            "Successfully notified backend about claimed gift:",
            result
          );
        }

        let updatedGift: Account<Gift, string> | null = null;
        let attempts = 0;
        let delay = 500; // Start at 0.5s
        const maxDelay = 8000;
        const maxAttempts = 7; // ~63 seconds max

        while (attempts < maxAttempts) {
          try {
            updatedGift = await fetchGift(rpc, gift_pda as Address);
            if (
              updatedGift &&
              updatedGift.data &&
              updatedGift.data.status === GiftStatus.Claimed
            ) {
              break;
            }
          } catch (err) {}
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = Math.min(delay * 2, maxDelay);
          attempts++;
        }

        if (!updatedGift) updatedGift = gift;

        const asset = await fetchDigitalAsset(rpc, nftMint);
        const metadata = await fetch(asset.metadata.uri);
        const metadataBody = await metadata.json();
        setGiftClaimed({
          gift: updatedGift!,
          nft: {
            name: metadataBody.name ?? "",
            image: metadataBody.image ?? "",
          },
          signature: sx!,
        });
      } catch (error) {
        setClaimGiftError(ClaimGiftErrors.FAILED_TO_CLAIM_GIFT);
        console.error("Error making request to backend:", error);
      }
    } catch (err: any) {
      // Set specific errors when possible (some are above)
      // Already set in abort cases above.
      // If none set, set generic failed to claim
      if (!claimGiftError) {
        setClaimGiftError(ClaimGiftErrors.FAILED_TO_CLAIM_GIFT);
      }
      // Log error for debug
      console.error("claimGift error", err);
    } finally {
      setIsClaimingGift(false);
    }
  }

  function handleClaimGift(
    e: React.MouseEvent<HTMLButtonElement>,
    signer: TransactionSigner<string>
  ) {
    e.preventDefault();
    if (!(connectedToEmbeddedWallet || connectedToExternalWallet)) {
      return;
    }
    // const answer = (e.target as any).answer.value;
    const answer = "linkinpark";
    claimGift(answer, signer);
  }

  const [incorrectEmail, setIncorrectEmail] = useState(true);

  async function handleDecryptQuestion(email: string) {
    try {
      if (!gift) return;
      const res = await decryptQuestion(
        cipher,
        new Uint8Array(gift.data.salt),
        email
      );
      setDecrypted(res);
      setIncorrectEmail(false);
    } catch (error) {
      setIncorrectEmail(true);
      console.error(error);
    }
  }
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(email)) {
      handleDecryptQuestion(email);
    }
  }, [email]);

  function closeGiftErrorModal() {
    setClaimGiftError(null);
  }

  const handleReceivedModalOpenChange = useCallback(
    (open: boolean) => {
      // return;
      if (!open) {
        // Only allow closing if any stage has status Error or all claim stages succeeded
        const canClose =
          giftClaimStages.some(
            (stage) => stage.status === GiftClaimingStatus.Error
          ) ||
          (giftClaimStages.length > 0 &&
            giftClaimStages.every(
              (stage) => stage.status === GiftClaimingStatus.Success
            ));

        if (canClose) {
          setGiftReceivedModalOpen(open);
          setGiftClaimStages([]);
        }
      }
    },
    [giftClaimStages]
  );

  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [isClaimingGift, setIsClaimingGift] = useState<boolean>(false);
  return (
    <main
      className={`antialiased bg-custom-landing min-h-screen flex items-center justify-between py-20 px-6 w-screen overflow-x-hidden`}
    >
      <Modal closeGiftErrorModal={closeGiftErrorModal} error={claimGiftError} />

      {gift && (
        <EmailOTPModal
          decrypted={decrypted}
          open={!emailVerified}
          cipher={cipher}
          email={email}
          salt={gift.data.salt}
          gift_pda={gift.address}
          setEmail={setEmail}
          setEmailVerified={setEmailVerified}
        />
      )}

      <LoadingClaimStagesModal
        giftClaimStages={giftClaimStages}
        giftClaimed={giftClaimed}
        open={giftReceivedModalOpen}
        onOpenChange={handleReceivedModalOpenChange}
      />
      <form
        onSubmit={(e) => e.preventDefault()}
        className="lg:max-w-xl mx-auto flex gap-6 lg:w-auto w-full flex-col items-center"
      >
        <div
          className={`lg:min-w-[400px] w-full flex flex-col gap-4 animate-slideUp delay-200! ${
            !decrypted ? "opacity-30 cursor-not-allowed rounded-lg" : ""
          }`}
          style={{ pointerEvents: "auto" }}
          onMouseOver={(e) => {
            if (!decrypted) e.currentTarget.style.cursor = "not-allowed";
          }}
          onMouseOut={(e) => {
            if (!decrypted) e.currentTarget.style.cursor = "";
          }}
        >
          <fieldset
            className={`flex w-full font-semibold text-sm flex-col gap-2 justify-between items-start rounded-[20px] transition-transform duration-400 groupfocus-within:scale-105 bg-white p-4 lg:focus-within:scale-110 lg:focus-within:rounded-2xl lg:focus-within:p-4`}
          >
            <label
              className="flex flex-row items-center gap-2 text-neutral-700 leading-none"
              htmlFor="answer"
            >
              <Puzzle size={16} /> {decrypted ? decrypted : "A secret question"}
            </label>
            <div className="w-full rounded-lg bg-white">
              <input
                className="rounded-lg w-full shrink-0 px-1.5 text-left grow border-none text-sm py-2 leading-none text-neutral-800 outline-none bg-transparent"
                id="answer"
                type="text"
                onChange={handleSetSecurityAnswer}
                value={answer}
                name="answer"
                placeholder={decrypted ? "santacruz" : "A secret answer"}
                style={{ background: "transparent" }}
                disabled={!decrypted}
              />
            </div>
          </fieldset>
        </div>

        <div className="animate-slideUp delay-400! w-full">
          {wallet ? (
            <ClaimGiftWithEmbeddedWallet
              wallet={wallet}
              answer={answer}
              isClaimingGift={isClaimingGift}
              handleClaimGift={handleClaimGift}
              incorrectEmail={incorrectEmail}
            />
          ) : uiWalletAccount ? (
            <ClaimGiftWithExternalWallet
              isClaimingGift={isClaimingGift}
              answer={answer}
              uiWalletAccount={uiWalletAccount}
              handleClaimGift={handleClaimGift}
              incorrectEmail={incorrectEmail}
            />
          ) : (
            <ConnectButton
              disabled={!decrypted}
              text={"Connect Wallet to Claim Gift"}
              className={`${decrypted ? "hover:bg-amber-400/90 bg-amber-400" : "hover:bg-amber-400/70 bg-amber-400/50 opacity-50"} font-semibold text-black my-2 px-3 py-2 text-sm rounded-lg w-full`}
            />
          )}
        </div>
      </form>
    </main>
  );
}

function Modal({
  error,
  closeGiftErrorModal,
}: {
  error: ClaimGiftErrors | null;
  closeGiftErrorModal: () => void;
}) {
  // Modal content based on error code
  let title = "Error";
  let description = "";
  switch (error) {
    case ClaimGiftErrors.INVALID_GIFT_ID:
      title = "Invalid Gift ID";
      description =
        "The gift link is invalid or corrupt. Please check your link or try again with a valid gift code.";
      break;
    case ClaimGiftErrors.GIFT_DOESNT_EXIST:
      title = "Gift Not Found";
      description =
        "This gift could not be found. It may have been deleted or never existed. Double-check the code or contact the sender.";
      break;
    case ClaimGiftErrors.GIFT_ALREADY_CLAIMED:
      title = "Gift Already Claimed";
      description =
        "Looks like this gift has already been claimed. Each gift can only be claimed once.";
      break;
    case ClaimGiftErrors.GIFT_LOCKED:
      title = "Gift Locked";
      description =
        "This gift is currently locked and cannot be claimed. Please try again later or contact the sender for more information.";
      break;
    case ClaimGiftErrors.FAILED_TO_CLAIM_GIFT:
      title = "Failed To Claim Gift";
      description =
        "Something went wrong while claiming your gift. Please try again or contact support if the problem persists.";
      break;
    default:
      title = "Unknown Error";
      description = "An unknown error occurred. Please refresh and try again.";
      break;
  }

  return (
    <Dialog open={error !== null} onOpenChange={closeGiftErrorModal}>
      <DialogContent className="lg:max-w-md rounded-[24px]">
        <div className="flex flex-col gap-5 items-center text-center">
          <DialogTitle className="text-lg font-semibold px-6 pt-8">
            {title}
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground px-6">
            {description}
          </DialogDescription>
        </div>
        <div className="border-t border-solid border-neutral-400">
          {error === ClaimGiftErrors.INVALID_GIFT_ID ||
          error === ClaimGiftErrors.GIFT_DOESNT_EXIST ? (
            <Link
              href="/"
              className="w-full mx-auto rounded-[16px] text-red-700 hover:text-red-600 h-12 flex items-center justify-center font-medium transition-colors disabled:bg-muted/40 disabled:text-muted-foreground"
            >
              Back to Home
            </Link>
          ) : (
            <DialogClose asChild>
              <button className="w-full mx-auto rounded-[16px text-red-700 hover:text-red-600 h-12 flex items-center justify-center font-medium transition-colors disabled:bg-muted/40 disabled:text-muted-foreground">
                Close
              </button>
            </DialogClose>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ClaimGiftWithExternalWalletProps = {
  uiWalletAccount: UiWalletAccount;
  handleClaimGift: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    signer: TransactionSigner<string>
  ) => void;
  answer: string;
  incorrectEmail: boolean;
  isClaimingGift: boolean;
};

function ClaimGiftWithExternalWallet({
  uiWalletAccount,
  answer,
  incorrectEmail,
  isClaimingGift,
  handleClaimGift,
}: ClaimGiftWithExternalWalletProps) {
  const signer = useWalletAccountTransactionSigner(
    uiWalletAccount,
    "solana:devnet"
  );
  console.log("LINKIN PARK", signer);
  return (
    <ClaimGiftButton
      signer={signer}
      answer={answer}
      isClaimingGift={isClaimingGift}
      handleClaimGift={handleClaimGift}
      incorrectEmail={incorrectEmail}
    />
  );
}

type ClaimGiftWithEmbeddedWalletProps = {
  wallet: ConnectedStandardSolanaWallet;
  handleClaimGift: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    signer: TransactionSigner<string>
  ) => void;
  answer: string;
  incorrectEmail: boolean;
  isClaimingGift: boolean;
};

function ClaimGiftWithEmbeddedWallet({
  wallet,
  handleClaimGift,
  isClaimingGift,
  answer,
  incorrectEmail,
}: ClaimGiftWithEmbeddedWalletProps) {
  const signer = createPrivySigner(wallet);
  return (
    <ClaimGiftButton
      signer={signer}
      answer={answer}
      isClaimingGift={isClaimingGift}
      handleClaimGift={handleClaimGift}
      incorrectEmail={incorrectEmail}
    />
  );
}

type ClaimGiftButtonProps = {
  signer: TransactionSigner<string>;
  handleClaimGift: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    signer: TransactionSigner<string>
  ) => void;
  answer: string;
  incorrectEmail: boolean;
  isClaimingGift: boolean;
};

function ClaimGiftButton({
  signer,
  handleClaimGift,
  isClaimingGift,
  answer,
  incorrectEmail,
}: ClaimGiftButtonProps) {
  return (
    <Button
      type="submit"
      onClick={(e) => handleClaimGift(e, signer)}
      disabled={incorrectEmail || isClaimingGift || answer.trim() === ""}
      variant={"default"}
      className="font-semibold cursor-pointer text-black  my-2 px-3 py-2 text-sm rounded-lg w-full bg-lime-400 hover:bg-lime-400/90"
    >
      <span
        className="
          inline-flex
          flex-row items-center justify-center gap-2
          transition-transform
          duration-200
          ease-in-out
          group-hover:-translate-x-1
        "
      >
        <SparkleCluster />
        {isClaimingGift && <Spinner />} Claim Gift!
      </span>
      <span
        className="
          inline-block
          transition-transform
          duration-200
          ease-in-out
          group-hover:translate-x-1
          align-middle
        "
      >
        <ArrowRight />
      </span>
    </Button>
  );
}

enum OtpRequestStatus {
  IDLE = "request not initiated",
  OTP_SENT_TO_EMAIL = "otp request sent",
  FAILED_TO_SEND_OTP = "failed to send otp request",
  OTP_DID_NOT_MATCH = "otp value did not match",
  INVALID_OTP_TYPE = "otp must be 4 digit",
  OTP_VERIFIED = "otp successfully verified",
  FAILED_TO_VERIFY_OTP = "failed to verify otp",
}

function EmailOTPModal({
  decrypted,
  open,
  cipher,
  email,
  setEmail,
  setEmailVerified,
  salt,
  gift_pda,
}: {
  decrypted: string;
  cipher: string;
  open: boolean;
  email: string;
  salt: ReadonlyUint8Array<ArrayBufferLike>;
  gift_pda: Address<string>;
  setEmailVerified: React.Dispatch<React.SetStateAction<boolean>>;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [isVerifyingOTP, setIsVerifyingOTP] = useState<boolean>(false);
  const [isSendingOTPViaEmail, setIsSendingOTPViaEmail] =
    useState<boolean>(false);
  const [otpVerificationStatus, setOtpVerificationStatus] =
    useState<OtpRequestStatus>(OtpRequestStatus.IDLE);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpEntered, setOtpEntered] = useState<string>("");
  // Helper: get message and error state from status
  function getStatusBoxInfo(status: OtpRequestStatus) {
    switch (status) {
      case OtpRequestStatus.OTP_SENT_TO_EMAIL:
        return {
          message: "OTP has been sent to your email.",
          isError: false,
        };
      case OtpRequestStatus.FAILED_TO_SEND_OTP:
        return {
          message: "Failed to send OTP. Please try again.",
          isError: true,
        };
      case OtpRequestStatus.OTP_DID_NOT_MATCH:
        return {
          message: "Incorrect OTP. Please check the code and try again.",
          isError: true,
        };
      case OtpRequestStatus.OTP_VERIFIED:
        return {
          message: "OTP verified successfully!",
          isError: false,
        };
      case OtpRequestStatus.INVALID_OTP_TYPE:
        return {
          message: "OTP must be a 4-digit number.",
          isError: true,
        };
      case OtpRequestStatus.FAILED_TO_VERIFY_OTP:
        return {
          message: "Failed to verify OTP. Please try again.",
          isError: true,
        };
      default:
        return null;
    }
  }

  async function requestOTP() {
    if (!decrypted) return;
    setIsSendingOTPViaEmail(true);
    try {
      try {
        const s = await decryptQuestion(cipher, new Uint8Array(salt), email);
        console.log("FFI", s);
      } catch (error) {
        console.log("FIO", error);
      }
      const response = await fetch("/api/v1/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          salt: Buffer.from(salt).toString("base64"),
          gift_pda,
        }),
      });
      if (response.ok) {
        setOtpVerificationStatus(OtpRequestStatus.OTP_SENT_TO_EMAIL);
        setOtpRequested(true);
      }
    } catch (error) {
      setOtpVerificationStatus(OtpRequestStatus.FAILED_TO_SEND_OTP);
      setOtpRequested(false);
      console.error(error);
    } finally {
      setIsSendingOTPViaEmail(false);
    }
  }

  async function verifyOtp(otpEntered: string) {
    try {
      setIsVerifyingOTP(true);
      if (!/^\d{4}$/.test(otpEntered)) {
        setOtpVerificationStatus(OtpRequestStatus.INVALID_OTP_TYPE);
        console.error("OTP must be a 4-digit numeric value (0000-9999).");
        return;
      }
      const response = await fetch("/api/v1/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code: otpEntered,
        }),
      });
      if (response.ok) {
        setOtpVerificationStatus(OtpRequestStatus.OTP_VERIFIED);
        setEmailVerified(true);
      } else if (response.status === 410) {
        setOtpVerificationStatus(OtpRequestStatus.OTP_DID_NOT_MATCH);
      } else {
        setOtpVerificationStatus(OtpRequestStatus.FAILED_TO_VERIFY_OTP);
        console.error("Internal server error, status: " + response.status);
      }
    } catch (error) {
      setOtpVerificationStatus(OtpRequestStatus.FAILED_TO_VERIFY_OTP);
      console.error(error);
    } finally {
      setIsVerifyingOTP(false);
    }
  }

  const statusBox = getStatusBoxInfo(otpVerificationStatus);

  return (
    <Dialog open={open}>
      <DialogContent className="lg:max-w-md [&>button]:hidden rounded-[24px]">
        <DialogHeader className="flex flex-row items-center justify-between px-7 pt-7">
          <DialogTitle className="text-base text-left">
            Verify Email
          </DialogTitle>
        </DialogHeader>

        <fieldset
          className={`flex w-full font-semibold text-sm flex-col gap-2 justify-between items-start px-7 ${decrypted === "" && "pb-7"}`}
        >
          <label
            className="flex flex-row items-center gap-2 text-neutral-500 leading-none"
            htmlFor="email"
          >
            <Mail size={16} /> Email
          </label>
          <div className="w-full rounded-lg bg-white">
            <input
              className={`
                ${otpRequested && "cursor-default"}
                rounded-lg w-full shrink-0 text-left px-1.5 grow border text-sm py-2 leading-none text-neutral-800 bg-transparent
                border-neutral-300
                focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:border-neutral-200
                transition
              `}
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                if (otpRequested || isSendingOTPViaEmail) return;
                setEmail(e.target.value);
              }}
              placeholder="mark@gmail.com"
              name="email"
            />
          </div>
        </fieldset>
        {otpRequested && (
          <InputOTPPattern
            value={otpEntered}
            onChange={function (value: string): void {
              setOtpEntered(value);
              if (value.length === 4) {
                verifyOtp(value);
              }
            }}
          />
        )}
        {statusBox && (
          <div
            className={`mt-2 mx-7 px-3 py-2 rounded-md border text-sm ${
              statusBox.isError
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-lime-300 bg-lime-50 text-lime-800"
            }`}
            data-testid="otp-status-box"
          >
            {statusBox.message}
          </div>
        )}

        {decrypted !== "" && (
          <div className="w-full flex justify-end mt-2">
            {!otpRequested ? (
              <button
                type="button"
                className="py-5 w-full disabled:cursor-not-allowed disabled:text-blue-300 text-blue-600 hover:text-blue-500 font-semibold cursor-pointer border-t border-solid border-neutral-400 text-sm flex flex-row items-center justify-center gap-2"
                onClick={requestOTP}
                disabled={isSendingOTPViaEmail}
              >
                {isSendingOTPViaEmail && <Spinner />}
                Request OTP
              </button>
            ) : (
              <button
                type="button"
                disabled={isVerifyingOTP}
                className="py-5 w-full disabled:cursor-not-allowed disabled:text-blue-300 text-blue-600 hover:text-blue-500 font-semibold cursor-pointer border-t border-solid border-neutral-400 text-sm flex flex-row items-center justify-center gap-2"
                onClick={() => {
                  verifyOtp(otpEntered);
                }}
              >
                {isVerifyingOTP && <Spinner />}
                Verify OTP
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface LoadingClaimStagesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  giftClaimed: GiftClaimedResponse;
  giftClaimStages: GiftClaimStage[];
}

function LoadingClaimStagesModal({
  open,
  onOpenChange,
  giftClaimed,
  giftClaimStages,
}: LoadingClaimStagesModalProps) {
  const stageLabels: { stage: GiftClaimStages; label: string }[] = [
    { stage: GiftClaimStages.VerifyAnswer, label: "Verifying Answer" },
    { stage: GiftClaimStages.ClaimingGift, label: "Claiming Gift" },
  ];

  function getStageInfo(stage: GiftClaimStages): GiftClaimStage | undefined {
    return giftClaimStages.find((s) => s.stage === stage);
  }

  const firstError = giftClaimStages.find(
    (s) => s.status === GiftClaimingStatus.Error && s.errorMessage
  );

  // ✅ Guard: only true when ALL stages explicitly succeeded
  const isGiftClaimed =
    giftClaimStages.length > 0 &&
    stageLabels.every(({ stage }) => {
      const s = getStageInfo(stage);
      return s && s.status === GiftClaimingStatus.Success;
    });

  // ... display helpers unchanged ...
  function displayDeliveryDate(val: any) {
    if (!val) return "--";
    let numVal: number | undefined = undefined;
    if (typeof val === "bigint") numVal = Number(val) * 1000;
    else if (typeof val === "number") numVal = val * 1000;
    else if (!isNaN(Number(val))) numVal = Number(val) * 1000;
    const dt = numVal ? new Date(numVal) : new Date(val);
    return dt.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  function displaySolAmount(val: any) {
    if (!val) return "--";
    let amount: number;
    if (typeof val === "bigint") amount = Number(val);
    else if (typeof val === "string") amount = Number(val);
    else amount = val;
    if (amount > 1e7) amount /= 1e9; // lamports => sol
    return (
      amount.toLocaleString(undefined, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }) + " SOL"
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {isGiftClaimed && <CustomConfetti />}
      <DialogContent className="lg:max-w-md [&>button]:hidden rounded-[24px]">
        <DialogHeader className="flex flex-row items-center justify-between px-7 pt-7">
          <DialogTitle className="text-base text-left">
            {isGiftClaimed ? "Gift claimed successfully" : "Claiming Gift"}
          </DialogTitle>
          <DialogPrimitive.Close asChild>
            <Button
              variant="outline"
              className="rounded-[16px] size-8 p-2 shrink-0 cursor-pointer"
            >
              <IconXmark className="size-3" />
            </Button>
          </DialogPrimitive.Close>
        </DialogHeader>

        {isGiftClaimed && giftClaimed ? (
          <>
            <div className="flex flex-col items-center gap-4 px-7">
              <div className="w-full h-auto rounded-2xl overflow-hidden shadow border border-gray-200 mb-1 bg-white flex items-center justify-center">
                <div className="text-gray-300 flex items-center justify-center w-full h-full text-5xl">
                  <img src={giftClaimed.nft.image} />
                </div>
              </div>
              <div className="font-bold text-2xl text-black text-center">
                {giftClaimed.nft.name}
              </div>
              <div className="flex flex-col w-full gap-2 mt-2">
                <div className="flex flex-row items-center justify-between w-full text-black/90">
                  <div className="flex items-center">
                    <DollarSign className="w-5 h-5 mr-2" />
                    <span>Gift Amount</span>
                  </div>
                  <span className="font-medium">
                    {displaySolAmount(giftClaimed.gift.data.solAmount)}
                  </span>
                </div>
                <div className="flex flex-row items-center justify-between w-full text-black/90">
                  <div className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    <span>Gift Amount</span>
                  </div>
                  <span className="font-medium">
                    {giftClaimed.gift.data.createdOn
                      ? displayDeliveryDate(giftClaimed.gift.data.createdOn)
                      : "--"}
                  </span>
                </div>

                {giftClaimed.signature && (
                  <Link
                    href={`https://solscan.io/tx/${giftClaimed.signature}?cluster=devnet`}
                    target="_blank"
                    className="flex flex-row items-center justify-between w-full text-black/90"
                  >
                    <div className="flex items-center">
                      <Check className="w-5 h-5 mr-2" />
                      <span>Verify on Solscan</span>
                    </div>
                    <span className="font-medium break-all text-right max-w-[150px] text-violet-800">
                      {`${giftClaimed.signature.slice(0, 4)}...${giftClaimed.signature.slice(-4)}`}
                    </span>
                  </Link>
                )}
                <Link
                  href="/dashboard"
                  className="flex flex-row py-5 items-center justify-center w-full text-blue-600 border-t border-solid border-neutral-400 hover:text-blue-500 transition-colors duration-100 cursor-pointer"
                >
                  View on Dashboard
                </Link>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3 items-start w-full px-7 pb-7">
            {stageLabels.map(({ stage, label }) => {
              const currentStageInfo = getStageInfo(stage);
              const isLoading =
                currentStageInfo?.status === GiftClaimingStatus.Loading;
              const isCompleted =
                currentStageInfo?.status === GiftClaimingStatus.Success;
              const isError =
                currentStageInfo?.status === GiftClaimingStatus.Error;
              const notStarted = !currentStageInfo;

              let labelClasses = ["transition-colors", "duration-200"];
              if (isLoading) {
                labelClasses.push("opacity-100", "text-black", "font-bold");
              } else {
                labelClasses.push("text-sm", "text-black/50");
              }

              return (
                <div className="flex items-center gap-2.5" key={stage}>
                  {isLoading ? (
                    <span
                      className="flex items-center justify-center"
                      style={{ minWidth: "1.25rem", minHeight: "1.25rem" }}
                    >
                      <svg
                        className="animate-spin h-5 w-5 text-gray-500"
                        fill="none"
                        viewBox="0 0 16 16"
                      >
                        <circle
                          cx="8"
                          cy="8"
                          r="6"
                          stroke="currentColor"
                          strokeWidth="2"
                          opacity="0.25"
                        />
                        <path
                          d="M14 8a6 6 0 00-6-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  ) : (
                    <span
                      className={[
                        "flex items-center justify-center h-5 w-5 rounded-full border-2 border-solid transition-all duration-200",
                        isCompleted
                          ? "bg-green-700 border-green-700"
                          : notStarted
                            ? "bg-neutral-200 border-neutral-200"
                            : isError
                              ? "bg-red-500 border-red-500"
                              : "bg-gray-100 border-gray-100",
                      ].join(" ")}
                      style={{ minWidth: "1.25rem", minHeight: "1.25rem" }}
                    >
                      {isCompleted ? (
                        <svg
                          className="h-3 w-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 16 16"
                        >
                          <path
                            d="M4 8.5l3 3 5-5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : isError ? (
                        <svg
                          className="h-3 w-3 text-white"
                          fill="none"
                          viewBox="0 0 16 16"
                        >
                          <path
                            d="M4.7 4.7l6.6 6.6M4.7 11.3l6.6-6.6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : null}
                    </span>
                  )}
                  <span className={labelClasses.join(" ")}>{label}</span>
                </div>
              );
            })}
          </div>
        )}

        {firstError && (
          <div className="rounded-xl mt-2 p-3 mx-7 mb-7 text-xs border border-red-200 bg-red-50 text-black">
            {firstError.errorMessage}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
