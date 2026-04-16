"use client";

import "@radix-ui/themes/styles.css";
import { toast } from "sonner";

type Steps = {
  [key: string]: {
    hash: `#${string}`;
    title: string;
  };
};

const steps: Steps = {
  step_1: {
    hash: "#upload-image",
    title: "Upload Image",
  },
  step_2: {
    hash: "#security-questions",
    title: "Add Security Questions",
  },
  step_3: {
    hash: "#wrap-gift",
    title: "Wrap and Send",
  },
};

import { createClient } from "@/app/lib/supabase/client";
import {
  fetchDigitalAsset,
  findMetadataPda,
  getCreateMetadataAccountV3Instruction,
} from "@metaplex-foundation/mpl-token-metadata-kit";
import {
  address,
  compileTransaction,
  createKeyPairSignerFromPrivateKeyBytes,
  getBase64EncodedWireTransaction,
  getBase64Encoder,
  setTransactionMessageFeePayerSigner,
  signAndSendTransactionMessageWithSigners,
} from "@solana/kit";
import { useWalletAccountTransactionSendingSigner } from "@solana/react";

import {
  Address,
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getAddressEncoder,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  Instruction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  TransactionSigner,
} from "@solana/kit";
import React, { useEffect, useState, useRef } from "react";
import {
  getCreateAccountInstruction,
  getTransferSolInstruction,
} from "@solana-program/system";
import { RECURSIVE_HASH_DEPTH } from "@/app/helper/constants";
import idl from "@/solgift.json";
import {
  getCreateGiftInstruction,
  SOLGIFT_PROGRAM_ADDRESS,
} from "@/app/generated/solgift";
import { encryptQuestion, recursiveSha256 } from "@/app/helper/compute";
import {
  assertProgramsDeployed,
  uploadImageToPinata,
  uploadMetadataToPinata,
} from "@/app/helper/program";
import { LAMPORTS_PER_SOL, TOKEN_PROGRAM_ADDRESS } from "@solana/client";
import { u16ToLeBytes, getToday } from "@/app/helper/compute";
import { UiWalletAccount, useWallets } from "@wallet-standard/react";
import {
  ConnectedStandardSolanaWallet,
  useWallets as privyUseWallets,
} from "@privy-io/react-auth/solana";
import { useConnector } from "@solana/connector/react";
import {
  getSetAuthorityInstruction,
  AuthorityType,
  getInitializeMintInstruction,
  getMintSize,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getMintToInstruction,
} from "@solana-program/token";
import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleCheckBig,
  Dice1,
  File,
  ImageDownIcon,
  ImageIcon,
  ImageUpIcon,
  MessageCircleWarning,
  TriangleAlert,
} from "lucide-react";
import Image from "next/image";
import { DatePicker } from "@/app/components/datepicker";
import { inter, spaceMono } from "../fonts/fonts";
import HCaptcha from "@hcaptcha/react-hcaptcha";
// import Link from "next/link"; ← will use <a> instead to get full control of hash behavior!
import { Button } from "../components/ui/button";
import { IconWarninglight } from "symbols-react";
import { createPrivySigner, validateDeliveryDate } from "../lib/utils";
import { usePrivy } from "@privy-io/react-auth";
import { WalletModal } from "../components/wallet-modal";
import Link from "next/link";

const rpc = createSolanaRpc("https://api.devnet.solana.com");
const rpcSubscriptions = createSolanaRpcSubscriptions(
  "ws://api.devnet.solana.com"
);

type CreateGiftData = {
  name: string;
  giftAmount: number;
  email: string;
  birthday: string;
  securityQuestion: string;
  securityAnswer: string;
};

export default function CreateGiftForm() {
  const { ready, user, authenticated } = usePrivy();
  const {
    isConnected,
    account,
    connector,
    walletConnectUri,
    clearWalletConnectUri,
  } = useConnector();
  const formattedDate = getToday();
  const uiWallets = useWallets(); // gives you branded UiWalletAccount objects
  const { wallets } = privyUseWallets();
  const wallet = wallets.find((w) => w.standardWallet?.name === "Privy");
  // Cross-reference by address to get the branded UiWalletAccount
  const uiWalletAccount =
    uiWallets.flatMap((w) => w.accounts).find((a) => a.address === account) ??
    null;

  const [createGiftData, setCreateGiftData] = useState<CreateGiftData>({
    name: "Kef",
    giftAmount: 0.001,
    birthday: formattedDate,
    email: "mark@gmail.com",
    securityQuestion: "our favorite band name",
    securityAnswer: "linkinpark",
  });

  const [imageFile, setImageFile] = useState<null | File>(null);

  function handleSetGiftAmount(e: React.ChangeEvent<HTMLInputElement>) {
    setCreateGiftData((prev) => {
      return { ...prev, giftAmount: Number(e.target.value) };
    });
  }

  function handleSetGiftName(e: React.ChangeEvent<HTMLInputElement>) {
    setCreateGiftData((prev) => {
      return { ...prev, name: e.target.value };
    });
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
    setCreateGiftData((prev) => ({
      ...prev,
      securityAnswer: filtered,
    }));
  }

  function handleSetRecipientEmail(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setCreateGiftData((prev) => {
      return { ...prev, email: value };
    });
  }

  function handleSetSecurityQuestion(e: React.ChangeEvent<HTMLInputElement>) {
    setCreateGiftData((prev) => {
      return { ...prev, securityQuestion: e.target.value.trim() };
    });
  }

  const [status, setStatus] = React.useState<{
    step_1: "warning" | "completed" | "not_completed";
    step_2: "warning" | "completed" | "not_completed";
    step_3: "warning" | "completed" | "not_completed";
  }>({
    step_1: "not_completed",
    step_2: "not_completed",
    step_3: "not_completed",
  });

  function toggleOpenWalletModal() {
    setOpenWalletModal((prev) => !prev);
  }

  React.useEffect(() => {
    // Check for Step 1 completion
    const step1Completed =
      imageFile != null &&
      !!createGiftData.birthday &&
      !!createGiftData.giftAmount &&
      !!createGiftData.name &&
      String(createGiftData.giftAmount).length > 0 &&
      String(createGiftData.name).trim().length > 0;

    // Check for Step 2 completion (now includes email validation)
    function validateEmail(email: string): boolean {
      // Very basic email regex for simple validation
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    }
    const step2Completed =
      !!createGiftData.securityQuestion &&
      !!createGiftData.securityAnswer &&
      !!createGiftData.email &&
      String(createGiftData.securityQuestion).trim().length > 0 &&
      String(createGiftData.securityAnswer).trim().length > 0 &&
      String(createGiftData.email).trim().length > 0 &&
      validateEmail(createGiftData.email);

    setStatus((prev) => ({
      ...prev,
      step_1: step1Completed ? "completed" : "not_completed",
      step_2: step2Completed ? "completed" : "not_completed",
      // step_3 handled elsewhere after send
    }));
  }, [
    imageFile,
    createGiftData.birthday,
    createGiftData.giftAmount,
    createGiftData.name,
    createGiftData.securityQuestion,
    createGiftData.securityAnswer,
    createGiftData.email,
  ]);

  const [windowHash, setWindowHash] = React.useState<string | undefined>(
    undefined
  );

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      // Only execute client-side
      if (
        window.location.pathname === "/create-gift" &&
        !window.location.hash &&
        typeof window.location.replace === "function"
      ) {
        window.location.replace("/create-gift#upload-image");
      }
    }
  }, []);

  React.useEffect(() => {
    setWindowHash(window.location.hash);
    const onHashChange = () => setWindowHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false);

  // Custom NavStepLink to prevent scroll when changing only hash on same route
  function NavStepLink({
    toHash,
    title,
    status,
    windowHash,
  }: {
    title: string;
    toHash: string;
    status: string;
    windowHash?: string;
  }) {
    return (
      // Use <a> to get full control and prevent browser hash-scroll
      <a
        href={`/create-gift${toHash}`}
        onClick={(e) => {
          e.preventDefault();

          // Update URL hash but do NOT scroll! Use replaceState.
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", `/create-gift${toHash}`);
            setWindowHash(toHash);
          }
        }}
        tabIndex={0}
        role="link"
        className={`inline-flex items-center  bg-white justify-start gap-0.5 px-5 py-1 whitespace-nowrap rounded-xl font-semibold text-sm transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0  active:scale-[0.98] cursor-pointer text-left ${
          windowHash === toHash ? "text-purple-600" : "text-neutral-500"
        }`}
      >
        <div className="flex flex-row items-center">
          <Count selected={windowHash === toHash} status={status} />
        </div>
        <span className="ml-2 flex-1">{title}</span>
      </a>
    );
  }

  const connectedToExternalWallet = isConnected && account && connector;
  const connectedToEmbeddedWallet = ready && user && authenticated;

  return (
    <main
      className={`antialiased bg-white w-full min-h-screen py-5 text-black`}
    >
      <WalletModal
        open={openWalletModal}
        onOpenChange={toggleOpenWalletModal}
      />
      <nav className="flex flex-col items-left px-5 pt-22 gap-3 fixed bg-white border-r border-solid border-black/10 top-0 z-30 py-7 h-screen w-[300px] left-0">
        <NavStepLink
          toHash={steps.step_1.hash}
          windowHash={windowHash}
          title={steps.step_1.title}
          status={status.step_1}
        ></NavStepLink>
        <NavStepLink
          toHash={steps.step_2.hash}
          windowHash={windowHash}
          title={steps.step_2.title}
          status={status.step_2}
        ></NavStepLink>
        <NavStepLink
          toHash={steps.step_3.hash}
          windowHash={windowHash}
          title={steps.step_3.title}
          status={status.step_3}
        ></NavStepLink>
      </nav>
      <form
        onSubmit={(e) => e.preventDefault()}
        className="w-[650px] mx-auto gap-10 flex flex-col items-center"
      >
        <div
          className={`bg-white ${windowHash !== steps.step_1.hash && "hidden"} bg-red-300 flex flex-col gap-4 rounded-[44px] p-12 w-full pb-60`}
        >
          <fieldset className="flex w-full flex-col justify-start ">
            <h1
              className={`text-black font-bold text-2xl text-left mb-4 ${inter.className}`}
            >
              Upload a moment from past
            </h1>
            <p className="text-neutral-500 text-xs mb-4">
              The image you upload will appear on your NFT gift and be viewable
              to anyone with the link after the gift is revealed, so choose
              something you'd feel comfortable sharing publicly. For example,
              use a photo you wouldn't mind posting on Facebook.
            </p>
            <UploadImage imageFile={imageFile} setImageFile={setImageFile} />
          </fieldset>

          <fieldset className="flex w-full flex-col justify-start mt-4">
            <label
              className="mb-2.5 block text-neutral-500 text-sm leading-none text-violet12"
              htmlFor="birthday"
            >
              Gift Reveal Date
            </label>
            <DatePicker
              birthday={
                createGiftData.birthday
                  ? (() => {
                      const parts = createGiftData.birthday.split("-");
                      if (parts.length === 3) {
                        const [year, month, day] = parts;
                        const parsedDate = new Date(
                          Number(year),
                          Number(month) - 1,
                          Number(day)
                        );
                        if (!isNaN(parsedDate.getTime())) {
                          return parsedDate;
                        }
                      }
                      return new Date();
                    })()
                  : null
              }
              setBirthday={(date: Date) => {
                const day = String(date.getDate()).padStart(2, "0");
                const month = String(date.getMonth() + 1).padStart(2, "0");
                const year = date.getFullYear();
                setCreateGiftData((prev) => ({
                  ...prev,
                  birthday: `${year}-${month}-${day}`,
                }));
              }}
            />
          </fieldset>

          <fieldset className="flex w-full flex-col justify-start">
            <label
              className="mb-2.5 block text-neutral-500 text-sm leading-none text-violet12"
              htmlFor="giftAmount"
            >
              Gift Amount (SOL)
            </label>
            <input
              className="rounded-full shrink-0 grow border-none py-2.5 text-sm px-3 leading-none text-violet11 shadow-[0_0_0_1px] shadow-neutral-300 outline-none focus:shadow-[0_0_0_1.5px] focus:shadow-violet8"
              id="giftAmount"
              min={0}
              step="any"
              value={createGiftData.giftAmount}
              onChange={handleSetGiftAmount}
              type="number"
              name="giftAmount"
            />
          </fieldset>

          <fieldset className="flex w-full flex-col justify-start">
            <label
              className="mb-2.5 block text-neutral-500 text-sm leading-none text-violet12"
              htmlFor="nftName"
            >
              Gift Card Text
            </label>
            <input
              className="rounded-full shrink-0 grow border-none py-2.5 text-sm px-3 leading-none text-violet11 shadow-[0_0_0_1px] shadow-neutral-300 outline-none focus:shadow-[0_0_0_1.5px] focus:shadow-violet8"
              id="nftName"
              type="text"
              name="nftName"
              value={createGiftData.name}
              onChange={handleSetGiftName}
              placeholder="Happy birthday!"
            />
          </fieldset>
        </div>

        <div
          className={`bg-white ${windowHash !== steps.step_2.hash && "hidden"} flex flex-col gap-4 rounded-[44px] p-12 w-full pb-60`}
        >
          <fieldset className="flex w-full flex-col justify-start">
            <h1
              className={`text-black font-bold text-2xl text-left mb-4 ${inter.className}`}
            >
              Add Security Questions
            </h1>
            <p className="text-neutral-500 text-xs mb-4">
              Enter the recipient's email and a security question/answer they
              know. They'll need the answer to claim the gift.
            </p>
            <label
              className="mb-2.5 block text-neutral-500 text-sm leading-none text-violet12"
              htmlFor="email"
            >
              Email
            </label>
            <input
              className="rounded-full shrink-0 grow border-none py-2.5 text-sm px-3 leading-none text-violet11 shadow-[0_0_0_1px] shadow-neutral-300 outline-none focus:shadow-[0_0_0_1.5px] focus:shadow-violet8"
              id="email"
              type="text"
              value={createGiftData.email}
              onChange={handleSetRecipientEmail}
              placeholder="mark@gmail.com"
              name="email"
            />
          </fieldset>

          <fieldset className="flex w-full flex-col justify-start">
            <label
              className="mb-2.5 block text-neutral-500 text-sm leading-none text-violet12"
              htmlFor="question"
            >
              Security Question
            </label>
            <input
              className="rounded-full shrink-0 grow border-none py-2.5 text-sm px-3 leading-none text-violet11 shadow-[0_0_0_1px] shadow-neutral-300 outline-none focus:shadow-[0_0_0_1.5px] focus:shadow-violet8"
              id="question"
              type="text"
              value={createGiftData.securityQuestion}
              onChange={handleSetSecurityQuestion}
              name="question"
              placeholder="Our favorite band name?"
            />
          </fieldset>

          <fieldset className="flex w-full flex-col justify-start">
            <label
              className="mb-2.5 block text-neutral-500 text-sm leading-none text-violet12"
              htmlFor="answer"
            >
              Security Answer
            </label>
            <input
              className="rounded-full shrink-0 grow border-none py-2.5 text-sm px-3 leading-none text-violet11 shadow-[0_0_0_1px] shadow-neutral-300 outline-none focus:shadow-[0_0_0_1.5px] focus:shadow-violet8"
              id="answer"
              type="text"
              onChange={handleSetSecurityAnswer}
              value={createGiftData.securityAnswer}
              name="answer"
              placeholder="linkinpark"
            />
          </fieldset>
        </div>

        <div
          className={`bg-white ${windowHash !== steps.step_3.hash && "hidden"} flex flex-col gap-4 rounded-[44px] p-12 w-full pb-60`}
        >
          {imageFile !== null ? (
            <div className="flex flex-col items-center justify-center gap-10">
              <NFTPreviewCard
                imageFile={imageFile}
                nftName={createGiftData.name}
                giftAmount={createGiftData.giftAmount}
              />

              {connectedToExternalWallet && uiWalletAccount !== null ? (
                <SendGiftWithExternalWallet
                  uiWalletAccount={uiWalletAccount}
                  imageFile={imageFile}
                  createGiftData={createGiftData}
                />
              ) : connectedToEmbeddedWallet && wallet !== undefined ? (
                <SendGiftWithEmbeddedWallet
                  wallet={wallet}
                  imageFile={imageFile}
                  createGiftData={createGiftData}
                />
              ) : (
                <Modal open={uiWalletAccount === null} />
              )}
            </div>
          ) : (
            <p>Uplaod Image</p>
          )}
        </div>
      </form>
    </main>
  );
}

type ModalProps = {
  open: boolean;
};

function Modal({ open }: ModalProps) {
  return <p>pclaim</p>;
}

type SendGiftWithExternalWalletProps = {
  uiWalletAccount: UiWalletAccount;
  imageFile: File;
  createGiftData: CreateGiftData;
};
function SendGiftWithExternalWallet({
  uiWalletAccount,
  imageFile,
  createGiftData,
}: SendGiftWithExternalWalletProps) {
  const signer = useWalletAccountTransactionSendingSigner(
    uiWalletAccount,
    "solana:devnet"
  );

  return (
    <SendGift
      signer={signer}
      imageFile={imageFile}
      createGiftData={createGiftData}
    />
  );
}

type SendGiftWithEmbeddedWalletProps = {
  wallet: ConnectedStandardSolanaWallet;
  imageFile: File;
  createGiftData: CreateGiftData;
};
function SendGiftWithEmbeddedWallet({
  wallet,
  imageFile,
  createGiftData,
}: SendGiftWithEmbeddedWalletProps) {
  const signer = createPrivySigner(wallet);
  return (
    <SendGift
      signer={signer}
      imageFile={imageFile}
      createGiftData={createGiftData}
    />
  );
}

type SendGiftProps = {
  signer: TransactionSigner<string>;
  imageFile: File;
  createGiftData: CreateGiftData;
};
function SendGift({ signer, imageFile, createGiftData }: SendGiftProps) {
  const encoder = new TextEncoder();
  const handleCreateGift = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    // HCAPTHC VERIFUCATION

    const nftName = createGiftData.name.trim();
    if (!nftName) throw new Error("Enter NFT Name");

    await assertProgramsDeployed(rpc, [
      SOLGIFT_PROGRAM_ADDRESS,
      "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s" as Address<"metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s">, // Metaplex token metadata
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address<"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA">, // SPL Token (should always exist)
    ]);
    try {
      if (!imageFile) {
        toast.error("Upload Image", {
          description: "Please upload an image to create a gift.",
        });
        throw new Error("Please upload an image to create a gift.");
      }

      if (imageFile?.size > 5 * 1024 * 1024) {
        toast.error("Image Too Large", {
          description: "File too large, should be lessthan 5MB",
        });
        throw Error("File too large, should be lessthan 5MB");
      }

      if (!signer) {
        toast.error("Connect Wallet", {
          description: "Please connect your wallet to continue.",
        });
        throw Error("Please connect your wallet to continue.");
      }

      const nftDescription = "A present!";
      const question = createGiftData.securityQuestion;
      // let imageCid: string =
      //   "bafkreidgjaaey4q3ergcx5cz5wv65jlc5yzcmx3ayz5ewe5afdkazjmyga"; // await uploadImageToPinata(imageFile);
      // let metadataCid: string = await uploadMetadataToPinata({
      //   nftName,
      //   nftDescription,
      //   imageCid,
      // });

      const metadataCid =
        "bafkreihwdt4qma5eggireiuflt6k4h6yqgnv7pk7f4umd52rnwyrxzexuq";

      //"bafkreihwdt4qma5eggireiuflt6k4h6yqgnv7pk7f4umd52rnwyrxzexuq";

      // step 3: nftMint nftmf
      try {
        const email: string = createGiftData.email;
        const salt = crypto.getRandomValues(new Uint8Array(32));
        const answer = createGiftData.securityAnswer;

        const combined = new Uint8Array([
          ...encoder.encode(answer as string),
          ...encoder.encode(email),
          ...salt,
        ]);

        const instructions = [];
        let count: number = 0;
        const nftMint = await generateKeyPairSigner();
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
        const authorizedClaimer = authorizedClaimerKeypair.address;

        async function sendAndConfirm(options: {
          instructions: Instruction[];
          payer: TransactionSigner;
        }) {
          const { instructions, payer } = options;

          const { value: latestBlockhash } = await rpc
            .getLatestBlockhash()
            .send();

          const transactionMessage = pipe(
            createTransactionMessage({ version: "legacy" }),
            (tx) => setTransactionMessageFeePayerSigner(payer, tx),
            (tx) =>
              setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
            (tx) => appendTransactionMessageInstructions(instructions, tx)
          );

          // ── Simulate without signing first (pass accounts, skip signers) ──────────
          // Build an unsigned wire transaction just for simulation
          const unsignedForSim = compileTransaction(transactionMessage);

          const { value: simulation } = await rpc
            .simulateTransaction(
              getBase64EncodedWireTransaction(unsignedForSim),
              {
                encoding: "base64",
                replaceRecentBlockhash: true,
                sigVerify: false, // ← critical: skip sig check so unsigned tx simulates fine
                commitment: "confirmed",
              }
            )
            .send();

          console.log("📋 Simulation logs:");
          simulation.logs?.forEach((log, i) => console.log(`  [${i}] ${log}`));

          if (simulation.err) {
            // If this is a known Anchor custom error, show a readable message.
            // From program: 3012 = GiftError::BelowMinimumAmount
            // (See anchor/programs/solgift/src/error.rs)
            let customMessage = "";

            // Check for Anchor's custom error pattern
            if (
              typeof simulation.err === "object" &&
              "InstructionError" in simulation.err &&
              Array.isArray((simulation.err as any).InstructionError) &&
              (simulation.err as any).InstructionError.length === 2
            ) {
              const [, detail] = simulation.err.InstructionError;
              // If 'Custom' is present, extract the code
              if (detail && typeof detail === "object" && "Custom" in detail) {
                const code = detail.Custom;
                if (code === 3012) {
                  customMessage =
                    "Minimum gift amount is 0.001 SOL. Please increase the SOL value.";
                } else {
                  customMessage = `Anchor program custom error code: ${code}`;
                }
              }
            }

            console.error(
              "❌ Simulation failed:",
              JSON.stringify(
                simulation.err,
                (_, v) => (typeof v === "bigint" ? v.toString() : v),
                2
              )
            );
            throw new Error(
              customMessage
                ? `Simulation failed: ${customMessage}`
                : `Simulation failed: ${JSON.stringify(simulation.err)}`
            );
          }

          console.log("✅ Simulation passed — prompting wallet...");

          // ── signAndSendTransactionMessageWithSigners calls TransactionSendingSigner ──
          // This is the ONLY function that triggers Phantom for a SendingSigner
          const signature =
            await signAndSendTransactionMessageWithSigners(transactionMessage);

          console.log("✅ Sent:", signature);
          return signature;
        }

        const addressEncoder = getAddressEncoder();

        const [userPda] = await getProgramDerivedAddress({
          programAddress: SOLGIFT_PROGRAM_ADDRESS,
          seeds: ["user", addressEncoder.encode(signer.address)],
        });

        const userAccount = await rpc
          .getAccountInfo(userPda, { encoding: "base64" })
          .send();

        if (userAccount?.value) {
          const rawBytes = getBase64Encoder().encode(userAccount.value.data[0]);
          const view = new DataView(
            rawBytes.buffer,
            rawBytes.byteOffset,
            rawBytes.byteLength
          );
          count = view.getUint16(8, true);
        } else {
          console.log("NO ACC");
        }

        console.log("userAccount exists:", !!userAccount?.value);
        console.log("count:", count);

        // ---- Ensure we're minting a true NFT (non-fungible token) following Solana Metaplex standard ----
        // 1. Derive PDA for the NFT gift account
        const [giftPda] = await getProgramDerivedAddress({
          programAddress: SOLGIFT_PROGRAM_ADDRESS,
          seeds: [
            encoder.encode("gift"),
            addressEncoder.encode(signer.address),
            u16ToLeBytes(count),
          ],
        });

        const [giftNftAta] = await findAssociatedTokenPda({
          mint: nftMint.address,
          owner: giftPda,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
        });
        console.log("GIFT NFT ATA", giftNftAta);
        console.log("GIFT PDA", giftPda);

        console.log("USER PDA", userPda);
        console.log("NFT", nftMint.address);
        console.log("Authorized claimer", authorizedClaimer);

        const [metadataPda] = await findMetadataPda({ mint: nftMint.address });

        // Create mint account for NFT (mint has 0 decimals, 1 supply, non-fungible!)
        const mintSize = getMintSize();
        const mintRent = await rpc
          .getMinimumBalanceForRentExemption(BigInt(mintSize))
          .send();
        const createMintAccountIx = getCreateAccountInstruction({
          payer: signer,
          newAccount: nftMint,
          lamports: mintRent,
          space: BigInt(mintSize),
          programAddress: TOKEN_PROGRAM_ADDRESS,
        });

        // Initialize mint - decimals: 0, mint and freeze authority = signer (required for NFT)
        const initMintIx = getInitializeMintInstruction({
          mint: nftMint.address,
          decimals: 0, // this is required for NFT (non-fungible)
          mintAuthority: signer.address,
          freezeAuthority: signer.address,
        });

        // Create Associated Token Account for the gift PDA to hold the NFT
        const createAtaIx = await getCreateAssociatedTokenInstructionAsync({
          payer: signer,
          ata: giftNftAta,
          owner: giftPda,
          mint: nftMint.address,
        });

        // Mint exactly 1 token into the gift PDA's ATA (supply = 1 means NFT)
        const mintToIx = getMintToInstruction({
          mint: nftMint.address,
          token: giftNftAta,
          mintAuthority: signer,
          amount: 1n,
        });

        // Attach Metaplex metadata, making this a certified NFT per standard, using URI, symbol, creators, etc.
        const createMetadataIx = getCreateMetadataAccountV3Instruction({
          metadata: metadataPda,
          mint: nftMint.address,
          mintAuthority: signer,
          payer: signer,
          updateAuthority: signer.address,
          data: {
            name: nftName as string,
            symbol: "GIFT",
            uri: `https://sapphire-tremendous-mackerel-441.mypinata.cloud/ipfs/${metadataCid}`,
            sellerFeeBasisPoints: 0, // no royalties
            creators: null, // or provide an array with creators if you want
            collection: null,
            uses: null,
          },
          isMutable: false,
          collectionDetails: null,
        });

        // Revoke mint authority so no more tokens can ever be minted for this NFT.
        const revokeMintIx = getSetAuthorityInstruction({
          owned: nftMint.address,
          owner: signer,
          authorityType: AuthorityType.MintTokens,
          newAuthority: null,
        });

        // Revoke freeze authority so mint can't be frozen/unfrozen anymore.
        const revokeFreezeIx = getSetAuthorityInstruction({
          owned: nftMint.address,
          owner: signer,
          authorityType: AuthorityType.FreezeAccount,
          newAuthority: null,
        });

        // -----------
        // The combination of:
        // - 0 decimals,
        // - max supply 1,
        // - Metaplex metadata (Token Metadata Program with URI & name),
        // makes this a true NFT.
        // To ensure this appears as an NFT and not just a "Token," make sure the Metaplex metadata is successfully created and attached to the mint account using the Token Metadata Program.
        // This is done by sending a `createMetadataIx` instruction that includes the NFT's name, symbol, URI, and other relevant fields.
        // After your transaction, you can verify the NFT by checking the metadata account on Solscan or any Solana explorer.
        // If the NFT still shows up only as a generic token in wallets like Phantom, double-check that:
        //   1. The URI is correct and serves proper JSON metadata.
        //   2. The metadata account address matches the mint.
        //   3. Wallets have refreshed their metadata cache (sometimes delays happen).
        // The recipient should receive this as an NFT in wallets that support NFTs (like Phantom).
        // -----------
        const minRent = await rpc
          .getMinimumBalanceForRentExemption(BigInt(0)) // 0 bytes = plain wallet
          .send();

        // Compute minRent required for ATA token account that will hold the NFT mint
        // 165 is the size, in bytes, of an SPL Token Account according to the SPL Token program specification.
        // See: https://spl.solana.com/token#account-layout
        const TOKEN_ACCOUNT_SIZE = 165;
        const minAtaRent = await rpc
          .getMinimumBalanceForRentExemption(BigInt(TOKEN_ACCOUNT_SIZE))
          .send();
        const lamportsForOneTransaction = BigInt(5000);

        const fundRecipientIx = getTransferSolInstruction({
          source: signer,
          destination: authorizedClaimer,
          amount: lamports(
            minRent + minRent + minAtaRent + lamportsForOneTransaction
          ),
        });

        const answerHash = await recursiveSha256(
          combined,
          RECURSIVE_HASH_DEPTH
        );

        const giftAmountValueRaw = createGiftData.giftAmount;
        const giftAmountValue =
          typeof giftAmountValueRaw === "string" ||
          typeof giftAmountValueRaw === "number"
            ? Number(giftAmountValueRaw)
            : 0;
        const solAmount: bigint = lamports(
          BigInt(Math.floor(giftAmountValue * Number(LAMPORTS_PER_SOL)))
        );

        if (
          !createGiftData.birthday ||
          !/^\d{4}-\d{2}-\d{2}$/.test(createGiftData.birthday)
        ) {
          throw new Error("Invalid date format. Expected yyyy-mm-dd");
        }

        // Parse the date string (yyyy-mm-dd)
        const [y, m, d] = createGiftData.birthday.split("-").map(Number);

        // Create date at midnight in user's local timezone
        const selectedDate = new Date(y, m - 1, d);
        selectedDate.setHours(0, 0, 0, 0);

        // Get today at midnight in user's local timezone
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Validate: selected date must be today or future
        if (selectedDate < todayStart) {
          alert("Cannot schedule gifts for past dates");
          return;
        }

        // Convert to Unix timestamp (UTC) - midnight in user's timezone
        const birthdayTimestamp: bigint = BigInt(
          Math.floor(selectedDate.getTime() / 1000)
        );

        const createGiftIx = getCreateGiftInstruction({
          signer: signer,
          user: userPda,
          gift: giftPda,
          nftMint: nftMint.address,
          salt: salt,
          answerHash: answerHash,
          solAmount: solAmount,
          deliveryDate: birthdayTimestamp,
          authorizedClaimer: authorizedClaimer,
        });

        console.log("CREATE GIFT ALL DATA", {
          signer: signer,
          user: userPda,
          gift: giftPda,
          nftMint: nftMint.address,
          salt: salt,
          answerHash: answerHash,
          solAmount: solAmount,
          deliveryDate: birthdayTimestamp,
          authorizedClaimer: authorizedClaimer,
        });
        console.log("INDEX", count);

        instructions.push(createMintAccountIx); // allocate
        instructions.push(initMintIx); // initialize mint, signer = authority
        instructions.push(createAtaIx); // create gift PDA's ATA
        instructions.push(mintToIx); // mint 1 token → supply = 1
        instructions.push(createMetadataIx); // attach metadata, signer still authority ✅
        instructions.push(revokeMintIx); // mint_authority → None ✅
        instructions.push(revokeFreezeIx); // freeze_authority → None
        instructions.push(createGiftIx); // Anchor checks all pass ✅
        instructions.push(fundRecipientIx);

        // At this point, sendAndConfirm will submit a (likely atomic) transaction to the cluster.
        // Some indexers (or even the chain's state propagation) may take a moment before the asset is discoverable via RPC.
        // If we fetch the asset now, it's possible the indexer hasn't caught up yet. That's why we see 'asset does not exist'.

        const sx = await sendAndConfirm({
          instructions,
          payer: signer,
        });

        // Retry logic: polling a few times with a small delay for the asset to become discoverable.
        // If fetchDigitalAsset fails due to not found, we wait and retry.
        let asset = null;
        const maxTries = 5;
        const delayMs = 1200;

        for (let i = 0; i < maxTries; i++) {
          try {
            asset = await fetchDigitalAsset(rpc, nftMint.address);
            console.log(
              "[ASSET CREATION SUCCESS] after",
              i,
              "tries. Name:",
              asset.metadata.name
            );
            console.log(
              "[ASSET CREATION SUCCESS] after",
              i,
              "tries. URI:",
              asset.metadata.uri
            );
            // If fetchDigitalAsset succeeds, break loop
            break;
          } catch (err) {
            // Only retry on not found errors, else throw
            if (i === maxTries - 1) throw err;
            await new Promise((res) => setTimeout(res, delayMs));
          }
        }

        try {
          // Encrypt the security question with (email + salt) and push it to supabase
          // Assuming `securityQuestion`, `email`, and `salt` are all defined earlier in the function

          // Helper: simple encryption using window.crypto.subtle with AES-GCM
          // Derive a key from (email + salt), encrypt the question

          // Do the encryption
          const encryptedSecurityQuestion = await encryptQuestion(
            question,
            email,
            salt
          );

          // Prepare row for supabase
          const insertData = {
            security_question: encryptedSecurityQuestion,
            sender: signer.address,
            index: count, // ID field is the u16 used for gift PDA
            gift_pda: giftPda,
          };

          // Retry logic with exponential backoff: total ~5 seconds max wait
          let response;
          const maxTotalWait = 5000; // ms
          const initialDelay = 200; // ms
          const maxAttempts = 5;
          let delay = initialDelay;
          let totalWaited = 0;
          let lastErr;
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
              response = await fetch(`/api/v1/users/${signer.address}/gifts`, {
                method: "POST",
                body: JSON.stringify(insertData),
                headers: {
                  "Content-Type": "application/json",
                },
              });
              if (response.ok) break;
              lastErr = new Error(`HTTP ${response.status}`);
            } catch (err) {
              lastErr = err;
            }
            if (attempt < maxAttempts - 1) {
              await new Promise((res) => setTimeout(res, delay));
              totalWaited += delay;
              // Prevent exceeding total allowed wait
              if (totalWaited + delay > maxTotalWait) break;
              delay *= 2;
            }
          }
          if (!response || !response.ok)
            throw lastErr || new Error("Failed to save data after retries");

          if (!response.ok) {
            // Try to get error message from response, otherwise default
            let errMsg = "Failed to save data";
            try {
              const errorData = await response.json();
              errMsg = errorData?.message || errMsg;
            } catch {}
            throw new Error(errMsg);
          }

          // redirect to /dashboard/gifts/[gift_pda]
          // window.location.href = `/claim/${giftPda}`;
        } catch (error) {
          alert(error + "SUPP N");
        }

        console.log("NFT created successfully!");
        console.log("Mint address:", nftMint.address);
        console.log("Signature:", sx);
      } catch (error: any) {
        if (
          error === "User rejected the request." ||
          (typeof error === "string" &&
            error.includes("User rejected the request.")) ||
          (typeof error?.message === "string" &&
            error.message.includes("User rejected the request."))
        ) {
          return;
        }
        console.error(error);
        toast.error("Failed to create gift");
      }
    } catch (error) {
      alert(error + "DNFVNRO");
      console.log(error);
    }
  };

  return (
    <div className="flex flex-col w-[350px]">
      <Button
        type="submit"
        variant={"default"}
        onClick={handleCreateGift}
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
          SEND GIFT!
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
    </div>
  );
}

function NFTPreviewCard({
  imageFile,
  nftName = "NFT Gift",
  giftAmount = 0.001,
}: {
  imageFile: File;
  nftName: string;
  giftAmount: number;
}) {
  return (
    <div className="flex flex-col items-center bg-white rounded shadow p-3 pb-8 relative w-[350px] border border-neutral-200">
      <div className="aspect-6/7 bg-neutral-100 rounded-t-xs overflow-hidden w-full flex justify-center items-center border-b border-neutral-200">
        <img
          src={URL.createObjectURL(imageFile)}
          alt="NFT Preview"
          className="object-cover object-center w-full h-full"
        />
      </div>
      <div className="w-full px-2 pb-1 pt-4 flex flex-row gap-2 justify-end items-center text-xs font-mono text-neutral-700">
        <span className="truncate text-right">{nftName}</span>
        <span className="opacity-75 text-right">{giftAmount} SOL</span>
      </div>
      <div className="absolute left-3 right-3 bottom-2 h-2 rounded-b-lg bg-neutral-100 blur-sm opacity-50 -z-10" />
    </div>
  );
}

type UploadImageProps = {
  imageFile: null | File;
  setImageFile: React.Dispatch<React.SetStateAction<File | null>>;
};
function UploadImage({ imageFile, setImageFile }: UploadImageProps) {
  return (
    <>
      {imageFile ? (
        <div className="flex justify-center items-center">
          <img
            src={URL.createObjectURL(imageFile)}
            alt="Preview"
            className="rounded-md w-full object-contain shadow-sm border"
          />
        </div>
      ) : (
        <label
          htmlFor="image-upload"
          className="flex h-[400px] w-full mx-auto flex-col justify-center items-center border-2 border-dashed border-gray-300 rounded-3xl p-8 cursor-pointer hover:border-gray-500 transition-colors duration-150 text-gray-600 bg-white"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              setImageFile(e.dataTransfer.files[0]);
            }
          }}
        >
          <ImageUpIcon />
          <span className="text-sm">Click to upload or drag and drop</span>
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setImageFile(e.target.files[0]);
              }
            }}
          />
        </label>
      )}
    </>
  );
}

type CountProps = { selected: boolean; status: string };

function Count({ selected, status }: CountProps) {
  return (
    <span
      className={`flex items-center justify-center rounded-full h-4 w-4 border-2 font-semibold  ${status === "completed" ? "bg-purple-600 border-purple-600 text-white" : selected ? "border-purple-600" : "bg-neutral-200 border-neutral-200 text-black"} border-solid text-center`}
    >
      {/* <span className={`${status === "completed" ? "block" : "hidden"}`}>
        <Check size={10} strokeWidth={1.2} absoluteStrokeWidth />
      </span> */}
    </span>
  );
}
