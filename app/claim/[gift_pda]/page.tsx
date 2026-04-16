"use client";

import { usePrivy } from "@privy-io/react-auth"; // or from wherever your wallet hook comes
import {
  ConnectedStandardSolanaWallet,
  useSignTransaction,
} from "@privy-io/react-auth/solana";
import { fetchGift, getClaimGiftInstruction } from "@/app/generated/solgift";
import { UiWalletAccount, useWallets } from "@wallet-standard/react";
import { ArrowRight, CrossIcon, X } from "lucide-react";
import { getAddMemoInstruction } from "@solana-program/memo";
import { decryptQuestion, recursiveSha256 } from "@/app/helper/compute";
import { RECURSIVE_HASH_DEPTH } from "@/app/helper/constants";
import {
  fetchDigitalAsset,
  findAssociatedTokenPda,
} from "@metaplex-foundation/mpl-token-metadata-kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  address,
  Address,
  appendTransactionMessageInstructions,
  assertIsFullySignedTransaction,
  assertIsTransactionMessageWithBlockhashLifetime,
  assertIsTransactionWithBlockhashLifetime,
  compileTransaction,
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
  createNoopSigner,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  getTransactionDecoder,
  getTransactionEncoder,
  Instruction,
  KeyPairSigner,
  lamports,
  partiallySignTransaction,
  partiallySignTransactionMessageWithSigners,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayer,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  TransactionSigner,
} from "@solana/kit";
import { useWallets as privyUseWallets } from "@privy-io/react-auth/solana";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useConnector } from "@solana/connector/react";
import {
  createAuthorizedRecipientSigner,
  createPrivySigner,
} from "@/app/lib/utils";
import { WalletModal } from "@/app/components/wallet-modal";
import { getTransferSolInstruction } from "@solana-program/system";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import Link from "next/link";
import {
  useWalletAccountTransactionSendingSigner,
  useWalletAccountTransactionSigner,
} from "@solana/react";
// import { createPrivyPartialSigner } from "@/app/lib/utils";

const rpc = createSolanaRpc("https://api.devnet.solana.com");
const rpcSubscriptions = createSolanaRpcSubscriptions(
  "ws://api.devnet.solana.com"
);

enum ClaimGiftErrors {
  INVALID_GIFT_ID,
  GIFT_DOESNT_EXIST,
  GIFT_ALREADY_CLAIMED,
  GIFT_LOCKED,
  FAILED_TO_CLAIM_GIFT,
}

// const SOLGIFT_PROGRAM_ADDRESS: Address = idl.address as Address;

// This page pulls the gift_pda from the URL, then sets up React state hooks
export default function Page() {
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
  const [gift, setGift] = useState<any | null>(null);
  const [cipher, setCipher] = useState<string>("");
  const [email, setPhone] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [decrypted, setDecrypted] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [claimGiftError, setClaimGiftError] = useState<ClaimGiftErrors | null>(
    null
  );

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

        // 2. Check if gift exists onchain, if not skip backend call
        const giftData = await fetchGift(rpc, gift_pda as Address);
        if (!giftData) {
          setClaimGiftError(ClaimGiftErrors.GIFT_DOESNT_EXIST);
          throw new Error("Gift does not exist onchain");
        }
        setGift(giftData);

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

  function handleSetRecipientEmail(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setPhone(value);
  }

  async function claimGift(answer: string, signer: TransactionSigner<string>) {
    try {
      if (!(connectedToEmbeddedWallet || connectedToExternalWallet)) return;

      const salt = gift.data.salt;
      const combined = new Uint8Array([
        ...encoder.encode(answer),
        ...encoder.encode(email.toString()),
        ...salt,
      ]);
      const answerHash_n_1 = await recursiveSha256(
        combined,
        RECURSIVE_HASH_DEPTH - 1
      );

      // const answerHash_n_2 = await recursiveSha256(
      //   combined,
      //   RECURSIVE_HASH_DEPTH - 2
      // );

      // const concatenatedHash = new Uint8Array(
      //   answerHash_n_1.length + answerHash_n_2.length
      // );
      // concatenatedHash.set(answerHash_n_1, 0);
      // concatenatedHash.set(answerHash_n_2, answerHash_n_1.length);

      // const nftMintseed = new Uint8Array(
      //   await crypto.subtle.digest("SHA-256", concatenatedHash)
      // );

      const nftMint = gift.data.nftMint;
      console.log(nftMint);
      // await createKeyPairSignerFromPrivateKeyBytes(nftMintseed);

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
      const payer = createAuthorizedRecipientSigner(authorizedClaimerKeypair);
      console.log(payer.address, "AUTHORAIZED CLAIMER");

      if (payer.address !== gift.data.authorizedClaimer) {
        throw new Error("UNAUTHORIZEDC LCAIMER");
        return;
      }
      console.log("ddd");
      // setAuthorizedClaimer();
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
          answerHash: answerHash_n_1,
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
        answerHash: answerHash_n_1,
      });

      console.log("NFT MINT ADDRSEE", nftMint);
      const instructions = [];
      instructions.push(claimGiftIx);

      const { value: sol_left } = await rpc
        .getBalance(authorizedClaimerKeypair.address)
        .send();

      const emptyAuthorizedClaimerIx = getTransferSolInstruction({
        source: authorizedClaimerKeypair,
        destination: gift.data.sender,
        amount: sol_left - lamports(5000n),
      });
      const instructions_2: Instruction[] = [];
      instructions_2.push(emptyAuthorizedClaimerIx);

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

      await sendAndConfirm({
        instructions,
        payer: payer,
      });

      // Second tx: clean up SOL from authorized claimer
      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

      const transactionMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) =>
          setTransactionMessageFeePayerSigner(authorizedClaimerKeypair, tx),
        (tx) =>
          setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => appendTransactionMessageInstructions(instructions_2, tx)
      );

      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      assertIsTransactionWithBlockhashLifetime(signedTransaction);
      await sendAndConfirmTransactionFactory({
        rpc,
        rpcSubscriptions,
      })(signedTransaction, { commitment: "confirmed" });

      const asset = await fetchDigitalAsset(rpc, nftMint);

      console.log("NFT created successfully!");
      console.log("Mint address:", nftMint);

      console.log("Name:", asset.metadata.name);
      console.log("URI:", asset.metadata.uri);

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
    }
  }

  function handleClaimGift(
    e: React.MouseEvent<HTMLButtonElement>,
    signer: TransactionSigner<string>
  ) {
    e.preventDefault();
    if (!(connectedToEmbeddedWallet || connectedToExternalWallet)) {
      setIsModalOpen(true);
      return;
    }
    // const answer = (e.target as any).answer.value;
    const answer = "linkinpark";
    claimGift(answer, signer);
  }

  const [incorrectEmail, setIncorrectEmail] = useState(true);

  async function handleDecryptQuestion(email: string) {
    try {
      const res = await decryptQuestion(cipher, gift.data.salt, email);
      setDecrypted(res);
      setIncorrectEmail(false);
    } catch (error) {
      setIncorrectEmail(true);
      // Maybe if decrypt fails, the email is incorrect but not always an error for gift claim. No claimGiftError here.
      console.log(error);
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

  return (
    <main
      className={`antialiased bg-purple-50 min-h-screen py-20 px-10 text-black`}
    >
      <Modal closeGiftErrorModal={closeGiftErrorModal} error={claimGiftError} />
      <form className="w-[650px] mx-auto gap-10 flex flex-col items-center">
        <div className="bg-white flex flex-col gap-4 rounded-[44px] p-12 w-full">
          <fieldset className="flex w-full flex-col justify-start">
            <label
              className="mb-2.5 block text-neutral-500 text-sm leading-none text-violet12"
              htmlFor="email"
            >
              Email
            </label>
            <input
              className="rounded-full shrink-0 grow border-none py-2.5 text-sm px-3 leading-none text-violet11 shadow-[0_0_0_1px] shadow-neutral-300 outline-none focus:shadow-[0_0_0_1.5px] focus:shadow-violet8"
              id="email"
              type="email"
              value={email}
              onChange={handleSetRecipientEmail}
              placeholder="mark@gmail.com"
              name="email"
            />
          </fieldset>

          {decrypted && (
            <fieldset className="flex w-full flex-col justify-start">
              <label
                className="mb-2.5 block text-neutral-500 text-sm leading-none text-violet12"
                htmlFor="answer"
              >
                {decrypted}
              </label>
              <input
                className="rounded-full shrink-0 grow border-none py-2.5 text-sm px-3 leading-none text-violet11 shadow-[0_0_0_1px] shadow-neutral-300 outline-none focus:shadow-[0_0_0_1.5px] focus:shadow-violet8"
                id="answer"
                type="text"
                onChange={handleSetSecurityAnswer}
                value={answer}
                name="answer"
                placeholder="santacruz"
              />
            </fieldset>
          )}
        </div>

        {wallet ? (
          <ClaimGiftWithEmbeddedWallet
            wallet={wallet}
            handleClaimGift={handleClaimGift}
            incorrectEmail={incorrectEmail}
          />
        ) : uiWalletAccount ? (
          <ClaimGiftWithExternalWallet
            uiWalletAccount={uiWalletAccount}
            handleClaimGift={handleClaimGift}
            incorrectEmail={incorrectEmail}
          />
        ) : (
          <p>CONNECT WALLET zuka</p>
        )}
      </form>
      <WalletModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          // Clear WalletConnect URI when modal closes
          if (!open) {
            clearWalletConnectUri();
          }
        }}
        walletConnectUri={walletConnectUri}
        onClearWalletConnectUri={clearWalletConnectUri}
      />
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
      <DialogContent className="sm:max-w-md rounded-[24px]">
        <div className="flex flex-col gap-5 items-center text-center">
          <DialogTitle className="text-lg font-semibold px-6 pt-8">
            {title}
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground px-6">
            {description}
          </DialogDescription>
        </div>
        <div className="border-t border-black/10">
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
  incorrectEmail: boolean;
};

function ClaimGiftWithExternalWallet({
  uiWalletAccount,
  incorrectEmail,
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
  incorrectEmail: boolean;
};

function ClaimGiftWithEmbeddedWallet({
  wallet,
  handleClaimGift,
  incorrectEmail,
}: ClaimGiftWithEmbeddedWalletProps) {
  const signer = createPrivySigner(wallet);
  return (
    <ClaimGiftButton
      signer={signer}
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
  incorrectEmail: boolean;
};

function ClaimGiftButton({
  signer,
  handleClaimGift,
  incorrectEmail,
}: ClaimGiftButtonProps) {
  return (
    <Button
      type="submit"
      onClick={(e) => handleClaimGift(e, signer)}
      disabled={incorrectEmail}
      variant={"default"}
      className="text-white w-full rounded-full bg-purple-600 hover:bg-purple-500 h-12 group overflow-hidden relative"
    >
      <span
        className="
    inline-block
    transition-transform
    duration-200
    ease-in-out
    group-hover:-translate-x-1
  "
      >
        Claim Gift!
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
