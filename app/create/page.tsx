"use client";

import "@radix-ui/themes/styles.css";
import { toast } from "sonner";

type Steps = {
  [key: string]: {
    hash: `#${string}`;
    title: string;
  };
};
enum CREATE_GIFT_ERROR {
  FAILED_TO_UPLOAD_TO_IPFS = "failed to upload data to IPFS storage",
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export enum CreateGiftStage {
  NotStarted = "not_started",
  UploadingImage = "uploading_image", // Correct spelling
  WrappingGift = "wrapping_gift", // Locking/wrapping the NFT as a gift
  SavingGiftInfo = "saving_gift_information", // Saving gift details to database
  GiftCreatedSuccessfully = "gift_created_successfully", // Success stage
  Error = "error",
}
import {
  fetchDigitalAsset,
  findMetadataPda,
  getCreateMetadataAccountV3Instruction,
} from "@metaplex-foundation/mpl-token-metadata-kit";
import {
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
  createTransactionMessage,
  getAddressEncoder,
  getProgramDerivedAddress,
  Instruction,
  lamports,
  pipe,
  setTransactionMessageLifetimeUsingBlockhash,
  TransactionSigner,
} from "@solana/kit";
import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  getCreateAccountInstruction,
  getTransferSolInstruction,
} from "@solana-program/system";
import { RECURSIVE_HASH_DEPTH } from "@/app/helper/constants";
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
  Calendar,
  DollarSign,
  ImageUpIcon,
  Key,
  LockKeyhole,
  Mail,
  Sparkles,
} from "lucide-react";
import { DatePicker } from "@/app/components/datepicker";
import { Button } from "../components/ui/button";
import { IconXmark } from "symbols-react";
import { createPrivyTransactionSendingSigner, rpc } from "../lib/utils";
import { usePrivy } from "@privy-io/react-auth";
import { ConnectButton } from "../components/connect-button";

type CreateGiftData = {
  name: string;
  giftAmount: number;
  email: string;
  birthday: string;
  securityQuestion: string;
  securityAnswer: string;
};

enum GiftCreationStatus {
  Loading = "loading",
  Success = "success",
  Error = "error",
}

export default function CreateGiftForm() {
  const { ready, user, authenticated } = usePrivy();
  const { isConnected, isConnecting, account, connector } = useConnector();

  const formattedDate = getToday();
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

  const [createGiftData, setCreateGiftData] = useState<CreateGiftData>({
    name: "Kef",
    giftAmount: 0.001,
    birthday: formattedDate,
    email: "mark@gmail.com",
    securityQuestion: "our favorite band name",
    securityAnswer: "linkinpark",
  });

  const [imageFile, setImageFile] = useState<null | File>(null);

  const handleSetGiftAmount = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCreateGiftData((prev) => {
        return { ...prev, giftAmount: Number(e.target.value) };
      });
    },
    []
  );

  const handleSetGiftName = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCreateGiftData((prev) => {
        return { ...prev, name: e.target.value };
      });
    },
    []
  );

  const handleSetSecurityAnswer = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    []
  );

  const handleSetRecipientEmail = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setCreateGiftData((prev) => ({
        ...prev,
        email: value,
      }));
    },
    []
  );

  const handleSetSecurityQuestion = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCreateGiftData((prev) => ({
        ...prev,
        securityQuestion: e.target.value.trim(),
      }));
    },
    []
  );

  const connectedToExternalWallet = useMemo(
    () => !isConnecting && isConnected && account && connector,
    [isConnecting, isConnected, account, connector]
  );
  const connectedToEmbeddedWallet = useMemo(
    () => ready && user && authenticated,
    [ready, user, authenticated]
  );

  return (
    <main
      className={`antialiased bg-custom-gradient w-screen overflow-x-hidden min-h-screen py-20 text-black`}
    >
      <form
        onSubmit={(e) => e.preventDefault()}
        className="max-w-5xl mx-auto flex md:flex-row flex-col justify-center items-start"
      >
        <div className={` flex flex-col gap-4 rounded-[44px] p-6 w-full`}>
          <UploadImage imageFile={imageFile} setImageFile={setImageFile} />

          <fieldset className="flex w-full font-semibold text-sm flex-row justify-between items-center py-3.5 bg-white/5 px-3 rounded-lg">
            <label
              className="flex flex-row items-center gap-2 text-neutral-400 leading-none"
              htmlFor="giftAmount"
            >
              <Sparkles size={16} /> Modify image with AI
            </label>
          </fieldset>
        </div>

        <div
          className={` flex flex-col font-bold gap-4 rounded-[44px] p-6 w-full`}
        >
          <fieldset className="flex w-full flex-col justify-start">
            <input
              className="rounded-md shrink-0 grow text-left text-5xl border-none py-2.5 leading-none text-neutral-300 outline-none"
              id="nftName"
              type="text"
              name="nftName"
              value={createGiftData.name}
              onChange={handleSetGiftName}
              placeholder="Happy birthday!"
            />
          </fieldset>
          <fieldset className="flex w-full font-semibold text-sm flex-row justify-between items-center bg-white/5 py-1 pl-3 pr-1 rounded-lg">
            <label
              className="flex flex-row items-center gap-2 text-neutral-400 leading-none"
              htmlFor="birthday"
            >
              <Calendar size={16} /> Gift Reveal Date
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
          <fieldset className="flex w-full font-semibold text-sm flex-row justify-between items-center bg-white/5 py-1 pl-3 pr-1 rounded-lg">
            <label
              className="flex flex-row items-center gap-2 text-neutral-400 leading-none"
              htmlFor="email"
            >
              <Mail size={16} /> Recipient Email
            </label>
            <input
              className="rounded-full shrink-0 text-right grow border-none py-2.5 text-sm px-3 leading-none text-neutral-300 outline-none"
              id="email"
              type="text"
              value={createGiftData.email}
              onChange={handleSetRecipientEmail}
              placeholder="mark@gmail.com"
              name="email"
            />
          </fieldset>

          <fieldset className="flex w-full font-semibold text-sm flex-row justify-between items-center bg-white/5 py-1 px-3 rounded-lg">
            <label
              className="flex flex-row items-center gap-2 text-neutral-400 leading-none"
              htmlFor="giftAmount"
            >
              <DollarSign size={16} /> Gift Amount
            </label>
            <div>
              <input
                className="rounded-md shrink-0 grow text-right border-none py-2.5 leading-none text-neutral-300 outline-none"
                id="giftAmount"
                min={0}
                step="any"
                value={createGiftData.giftAmount}
                onChange={handleSetGiftAmount}
                type="number"
                name="giftAmount"
              />{" "}
              <span className="text-neutral-300">SOL</span>
            </div>
          </fieldset>

          <div className="flex flex-col items-start rounded-lg bg-white/5 py-1">
            <fieldset className="flex w-full font-semibold text-sm flex-row gap-2 justify-between items-center pl-3 pr-1 rounded-lg">
              <LockKeyhole size={16} className="text-neutral-400" />
              <div className="border-b w-full border-black/5 border-solid flex flex-row items-center">
                <label
                  className="leading-none text-neutral-400"
                  htmlFor="question"
                >
                  Security Question
                </label>
                <input
                  id="question"
                  className="border-solid shrink-0 text-right grow py-2.5 text-sm px-3 leading-none text-neutral-300 outline-none"
                  type="text"
                  value={createGiftData.securityQuestion}
                  onChange={handleSetSecurityQuestion}
                  name="question"
                  placeholder="Our favorite band name?"
                />
              </div>
            </fieldset>

            <fieldset className="flex w-full font-semibold text-sm flex-row gap-2 justify-between items-center pl-3 pr-1 rounded-lg">
              <Key size={16} className="text-neutral-400" />{" "}
              <div className="w-full flex flex-row items-center">
                <label
                  className="leading-none text-neutral-400"
                  htmlFor="answer"
                >
                  Security Answer
                </label>
                <input
                  className="border-solid shrink-0 text-right grow py-2.5 text-sm px-3 leading-none text-neutral-300 outline-none"
                  id="answer"
                  type="text"
                  onChange={handleSetSecurityAnswer}
                  value={createGiftData.securityAnswer}
                  name="answer"
                  placeholder="linkinpark"
                />
              </div>
            </fieldset>
          </div>
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
            <ConnectButton />
          )}
        </div>
      </form>
    </main>
  );
}

type SendGiftWithExternalWalletProps = {
  uiWalletAccount: UiWalletAccount;
  imageFile: File | null;
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
  imageFile: File | null;
  createGiftData: CreateGiftData;
};
function SendGiftWithEmbeddedWallet({
  wallet,
  imageFile,
  createGiftData,
}: SendGiftWithEmbeddedWalletProps) {
  const signer = createPrivyTransactionSendingSigner(wallet);
  return (
    <SendGift
      signer={signer}
      imageFile={imageFile}
      createGiftData={createGiftData}
    />
  );
}

type GiftCreationStage = {
  info?: string;
  stage: CreateGiftStage;
  status: GiftCreationStatus;
  errorMessage: string;
};

type SendGiftProps = {
  signer: TransactionSigner<string>;
  imageFile: File | null;
  createGiftData: CreateGiftData;
};
function SendGift({ signer, imageFile, createGiftData }: SendGiftProps) {
  const encoder = useMemo(() => new TextEncoder(), []);
  const [giftCreationStage, setGiftCreationStage] = useState<
    GiftCreationStage[]
  >([]);

  async function handleCreateGift(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    // HCAPTHC VERIFUCATION

    if (!imageFile) {
      toast.error("Upload Image");
      throw new Error("Please upload an image to create a gift.");
    }
    const nftName = createGiftData.name.trim();
    if (!nftName) throw new Error("Enter NFT Name");

    await assertProgramsDeployed(rpc, [
      SOLGIFT_PROGRAM_ADDRESS,
      "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s" as Address<"metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s">, // Metaplex token metadata
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address<"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA">, // SPL Token (should always exist)
    ]);
    try {
      setGiftCreationStage((prev) => {
        return [
          ...prev,
          {
            errorMessage: "",
            stage: CreateGiftStage.UploadingImage,
            status: GiftCreationStatus.Loading,
          },
        ];
      });

      if (!signer) {
        toast.error("Connect Wallet", {
          description: "Please connect your wallet to continue.",
        });

        throw Error("Please connect your wallet to continue.");
      }
      let imageCid: string = await uploadImageToPinata(imageFile);
      const nftDescription = "A present!";
      let metadataCid: string = await uploadMetadataToPinata({
        nftName,
        nftDescription,
        imageCid,
      });

      const question = createGiftData.securityQuestion;
      if (!imageCid || !metadataCid) {
        setGiftCreationStage((prev) => {
          const idx = prev.findIndex(
            (s) => s.stage === CreateGiftStage.UploadingImage
          );
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              errorMessage: "Failed to upload image to IPFS",
              status: GiftCreationStatus.Error,
            };
            return updated;
          }
          return prev;
        });
        throw new Error(
          `PINATA ERROR: ${CREATE_GIFT_ERROR.FAILED_TO_UPLOAD_TO_IPFS}`
        );
      }
      // "bafkreidgjaaey4q3ergcx5cz5wv65jlc5yzcmx3ayz5ewe5afdkazjmyga"; // await uploadImageToPinata(imageFile);

      setGiftCreationStage((prev) => {
        const idx = prev.findIndex(
          (s) => s.stage === CreateGiftStage.UploadingImage
        );
        if (idx !== -1) {
          // Update existing UploadingImage stage
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            errorMessage: "",
            status: GiftCreationStatus.Success,
          };
          return updated;
        }
        // If not found, just return prev unchanged (or you may choose to push, but per instruction do not)
        return prev;
      });

      setGiftCreationStage((prev) => {
        return [
          ...prev,
          {
            errorMessage: "",
            stage: CreateGiftStage.WrappingGift,
            status: GiftCreationStatus.Loading,
          },
        ];
      });

      // const metadataCid =
      //   "bafkreihwdt4qma5eggireiuflt6k4h6yqgnv7pk7f4umd52rnwyrxzexuq";

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
        const answerHash_n_2 = await recursiveSha256(
          combined,
          RECURSIVE_HASH_DEPTH - 2
        );

        const answerHash_n_1 = await recursiveSha256(
          combined,
          RECURSIVE_HASH_DEPTH - 1
        );

        const concatenatedHash = new Uint8Array(
          answerHash_n_1.length + answerHash_n_2.length + salt.length
        );
        concatenatedHash.set(answerHash_n_1, 0);
        concatenatedHash.set(answerHash_n_2, answerHash_n_1.length);
        concatenatedHash.set(
          salt,
          answerHash_n_1.length + answerHash_n_2.length
        );

        const nftMintseed = new Uint8Array(
          await crypto.subtle.digest("SHA-256", concatenatedHash)
        );

        const nftMint =
          await createKeyPairSignerFromPrivateKeyBytes(nftMintseed);

        // const nftMint = await generateKeyPairSigner();
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
        }

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

        const [metadataPda] = await findMetadataPda({
          mint: nftMint.address,
        });

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
          salt: salt,
          nftMint: nftMint.address,
          giftNftAta: giftNftAta,
          answerHash: answerHash,
          solAmount: solAmount,
          deliveryDate: birthdayTimestamp,
          authorizedClaimer: authorizedClaimer,
        });

        // console.log("CREATE GIFT ALL DATA", {
        //   signer: signer,
        //   user: userPda,
        //   gift: giftPda,
        //   nftMint: nftMint.address,
        //   salt: salt,
        //   answerHash: answerHash,
        //   solAmount: solAmount,
        //   deliveryDate: birthdayTimestamp,
        //   authorizedClaimer: authorizedClaimer,
        // });
        // console.log("INDEX", count);

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

        setGiftCreationStage((prev) => {
          const idx = prev.findIndex(
            (s) => s.stage === CreateGiftStage.WrappingGift
          );
          if (idx !== -1) {
            // Update existing UploadingImage stage
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              errorMessage: "",
              status: GiftCreationStatus.Success,
            };
            return updated;
          }
          // If not found, just return prev unchanged (or you may choose to push, but per instruction do not)
          return prev;
        });

        // Retry logic: polling a few times with a small delay for the asset to become discoverable.
        // If fetchDigitalAsset fails due to not found, we wait and retry.
        let asset = null;
        const maxTries = 3;
        const delayMs = 1200;

        for (let i = 0; i < maxTries; i++) {
          try {
            asset = await fetchDigitalAsset(rpc, nftMint.address);
            // If fetchDigitalAsset succeeds, break loop
            break;
          } catch (err) {
            // Only retry on not found errors, else throw
            if (i === maxTries - 1) throw err;
            await new Promise((res) => setTimeout(res, delayMs));
          }
        }

        setGiftCreationStage((prev) => {
          return [
            ...prev,
            {
              errorMessage: "",
              stage: CreateGiftStage.SavingGiftInfo,
              status: GiftCreationStatus.Loading,
            },
          ];
        });

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
        const maxTotalWait = 3000; // ms
        const initialDelay = 200; // ms
        const maxAttempts = 3;
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
            if (totalWaited + delay > maxTotalWait) {
              break;
            }
            delay *= 2;
          }
        }
        if (!response || !response.ok)
          throw lastErr || new Error("Failed to save data after retries");

        if (!response.ok) {
          // Try to get error message from response, otherwise default
          let errMsg = "Failed to save data";
          const errorData = await response.json();
          errMsg = errorData?.message || errMsg;

          setGiftCreationStage((prev) => {
            const idx = prev.findIndex(
              (s) => s.stage === CreateGiftStage.SavingGiftInfo
            );
            if (idx !== -1) {
              // Update existing UploadingImage stage
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                errorMessage: errMsg,
                status: GiftCreationStatus.Error,
              };
              return updated;
            }
            // If not found, just return prev unchanged (or you may choose to push, but per instruction do not)
            return prev;
          });
          throw new Error(errMsg);
        }

        setGiftCreationStage((prev) => {
          const idx = prev.findIndex(
            (s) => s.stage === CreateGiftStage.SavingGiftInfo
          );
          if (idx !== -1) {
            // Update existing UploadingImage stage
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              errorMessage: "",
              status: GiftCreationStatus.Success,
            };
            return updated;
          }
          // If not found, just return prev unchanged (or you may choose to push, but per instruction do not)
          return prev;
        });

        // console.log("NFT created successfully!");
        // console.log("Mint address:", nftMint.address);
        // console.log("Signature:", sx);
        setGiftCreationStage((prev) => {
          return [
            ...prev,
            {
              errorMessage: "",
              info: String(sx),
              stage: CreateGiftStage.GiftCreatedSuccessfully,
              status: GiftCreationStatus.Success,
            },
          ];
        });
      } catch (error: any) {
        if (
          error === "User rejected the request." ||
          (typeof error === "string" &&
            error.includes("User rejected the request.")) ||
          (typeof error?.message === "string" &&
            error.message.includes("User rejected the request."))
        ) {
          setGiftCreationStage((prev) => {
            const idx = prev.findIndex(
              (s) => s.stage === CreateGiftStage.WrappingGift
            );
            if (idx !== -1) {
              // Update existing UploadingImage stage
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                errorMessage: "User rejected the request.",
                status: GiftCreationStatus.Error,
              };
              return updated;
            }
            // If not found, just return prev unchanged (or you may choose to push, but per instruction do not)
            return prev;
          });
          return;
        }
        setGiftCreationStage((prev) => {
          const idx = prev.findIndex(
            (s) => s.stage === CreateGiftStage.WrappingGift
          );
          if (idx !== -1) {
            // Update existing UploadingImage stage
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              errorMessage: String(error).includes(
                `Error: Simulation failed: "AccountNotFound"`
              )
                ? "Insufficient Balance"
                : "Failed to create gift",

              status: GiftCreationStatus.Error,
            };
            return updated;
          }
          // If not found, just return prev unchanged (or you may choose to push, but per instruction do not)
          return prev;
        });
        console.error(error);
        toast.error("Failed to create gift");
      }
    } catch (error) {
      setGiftCreationStage((prev) => {
        const idx = prev.findIndex(
          (s) => s.stage === CreateGiftStage.WrappingGift
        );
        if (idx !== -1) {
          // Update existing UploadingImage stage
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            errorMessage: "Failed to Create Gift",
            status: GiftCreationStatus.Error,
          };
          return updated;
        }
        // If not found, just return prev unchanged (or you may choose to push, but per instruction do not)
        return prev;
      });
      console.log("ERROR sendAndConfirm", error);
    }
  }

  const handleOpenChangeLoadingStagesModal = useCallback(
    (open: boolean) => {
      if (!open) {
        // Only allow closing if any stage has status Error or gift successfully created
        const canClose =
          giftCreationStage.some(
            (stage) => stage.status === GiftCreationStatus.Error
          ) ||
          (giftCreationStage.length > 0 &&
            giftCreationStage[giftCreationStage.length - 1].status ===
              GiftCreationStatus.Success &&
            giftCreationStage[giftCreationStage.length - 1].stage ===
              CreateGiftStage.GiftCreatedSuccessfully);

        if (canClose) {
          setGiftCreationStage([]);
        }
      }
    },
    [giftCreationStage]
  );

  return (
    <div className="flex flex-col w-full">
      <LoadingStagesModal
        giftCreationStage={giftCreationStage}
        open={giftCreationStage.length !== 0}
        onOpenChange={handleOpenChangeLoadingStagesModal}
      />
      <Button
        type="submit"
        variant={"default"}
        onClick={handleCreateGift}
        className="font-semibold w-full rounded-lg bg-white hover:bg-white/90 h-12 text-black group overflow-hidden relative"
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

type UploadImageProps = {
  imageFile: null | File;
  setImageFile: React.Dispatch<React.SetStateAction<File | null>>;
};
function UploadImage({ imageFile, setImageFile }: UploadImageProps) {
  return (
    <>
      {imageFile ? (
        <div className="w-full h-[350px] flex justify-center items-center">
          <img
            src={URL.createObjectURL(imageFile)}
            alt="Preview"
            className="rounded-md h-full w-full object-cover shadow-sm border"
          />
        </div>
      ) : (
        <label
          htmlFor="image-upload"
          className="relative flex h-[300px] w-full mx-auto justify-center items-center rounded-3xl cursor-pointer bg-custom-gradient-1 overflow-hidden transition-colors duration-150 group"
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
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                if (e.target.files[0].size > 5 * 1024 * 1024) {
                  toast.error("Cannot upload image: File is larger than 5MB.");

                  e.target.value = ""; // reset input
                  return;
                }

                setImageFile(e.target.files[0]);
              }
            }}
          />
          <div className="absolute bottom-6 right-6">
            <span className="block transition-transform duration-200 ease-in-out group-hover:scale-105">
              <ImageUpIcon className="h-8 w-8 text-white drop-shadow-lg" />
            </span>
          </div>
        </label>
      )}
    </>
  );
}

function LoadingStagesModal({
  giftCreationStage,
  open,
  onOpenChange,
}: {
  giftCreationStage: GiftCreationStage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const stageLabels: { stage: CreateGiftStage; label: string }[] = [
    { stage: CreateGiftStage.UploadingImage, label: "Upload Image" },
    { stage: CreateGiftStage.WrappingGift, label: "Wrapping Gift" },
    { stage: CreateGiftStage.SavingGiftInfo, label: "Saving Gift Info" },
    { stage: CreateGiftStage.GiftCreatedSuccessfully, label: "Gift Created!" },
  ];

  function getStageInfo(stage: CreateGiftStage): GiftCreationStage | undefined {
    return giftCreationStage.find((s) => s.stage === stage);
  }

  const firstError = giftCreationStage.find(
    (s) => s.status === GiftCreationStatus.Error && s.errorMessage
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md [&>button]:hidden rounded-[24px] p-6">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-base text-left">
            Creating Gift
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
        <div className="flex flex-col gap-3 items-start w-full">
          {stageLabels.map(({ stage, label }) => {
            const currentStageInfo = getStageInfo(stage);
            const isLoading =
              currentStageInfo?.status === GiftCreationStatus.Loading;

            // Style logic
            let labelClasses = ["transition-colors", "duration-200"];
            if (isLoading) {
              // Opacity 100%, text-2xl, font-bold
              labelClasses.push(
                "text-xl",
                "opacity-100",
                "text-black",
                "font-bold"
              );
            } else {
              // All other: base, opacity-75, regular
              labelClasses.push("text-sm", "text-black/50");
            }

            const isCompleted =
              currentStageInfo?.status === GiftCreationStatus.Success;
            const notStarted = !currentStageInfo;
            const isError =
              currentStageInfo?.status === GiftCreationStatus.Error;

            return (
              <div className="flex items-center gap-2.5" key={stage}>
                {/* Icon */}
                {isLoading ? (
                  // Show independent spinner when loading
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
                      // Deep green background, white tick
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
                      // Red background, white X
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
                {/* Stage Name */}
                <span className={labelClasses.join(" ")}>{label}</span>
              </div>
            );
          })}
        </div>
        {firstError && (
          <div className="rounded-xl mt-2 p-3 text-xs border border-red-200 bg-red-50 text-black">
            {firstError.errorMessage}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
