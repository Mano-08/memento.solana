import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  ClaimGiftErrors,
  CreateGiftData,
  CreateGiftStage,
  GiftCreationStage,
  GiftCreationStatus,
} from "./types";
import { DateTime } from "luxon";
import {
  Account,
  assertIsFullySignedTransaction,
  compileTransaction,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  FixedSizeEncoder,
  generateKeyPair,
  generateKeyPairSigner,
  getProgramDerivedAddress,
  lamports,
  setTransactionMessageFeePayerSigner,
} from "@solana/kit";
import {
  address,
  Address,
  appendTransactionMessageInstructions,
  assertIsSendableTransaction,
  assertIsTransactionWithBlockhashLifetime,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  Instruction,
  KeyPairSigner,
  pipe,
  Rpc,
  RpcSubscriptions,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  SignatureBytes,
  SignatureDictionary,
  signTransactionMessageWithSigners,
  SolanaRpcApi,
  SolanaRpcSubscriptionsApi,
  Transaction,
  TransactionPartialSigner,
  TransactionPartialSignerConfig,
  TransactionSendingSignerConfig,
  TransactionSigner,
  TransactionWithinSizeLimit,
  TransactionWithLifetime,
} from "@solana/kit";
import { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
type sendAndConfirmParams = {
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
  rpc: Rpc<SolanaRpcApi>;
  instructions: Instruction[];
  payer: TransactionSigner;
};

// export async function sendAndConfirm(options: sendAndConfirmParams) {
//   const { instructions, payer, rpc, rpcSubscriptions } = options;
//   const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
//   console.log(payer.address);
//   const transactionMessage = pipe(
//     createTransactionMessage({ version: 0 }),
//     (tx) => setTransactionMessageFeePayer(payer.address, tx),
//     (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
//     (tx) => appendTransactionMessageInstructions([...instructions], tx)
//   );

//   console.log("Preparing to sign transaction.");

//   const signedTransaction =
//     await signTransactionMessageWithSigners(transactionMessage);

//   console.log("Signed Transaction:", signedTransaction);

//   assertIsSendableTransaction(signedTransaction);
//   assertIsTransactionWithBlockhashLifetime(signedTransaction);

//   // ── Simulate first to get full logs before attempting send ───────────────
//   try {
//     const { value: simulation } = await rpc
//       .simulateTransaction(
//         getBase64EncodedWireTransaction(signedTransaction), // encode signed tx → base64 wire format
//         {
//           encoding: "base64",
//           replaceRecentBlockhash: true, // use current blockhash for simulation
//           commitment: "confirmed",
//         }
//       )
//       .send();

//     if (simulation.err) {
//       console.error(
//         "[ERROR] Simulation error:",
//         JSON.stringify(
//           simulation.err,
//           (_, v) => (typeof v === "bigint" ? v.toString() : v),
//           2
//         )
//       );
//       console.error("📋 Logs:");
//       simulation.logs?.forEach((log: string, i: number) =>
//         console.log(`  [${i}] ${log}`)
//       );
//       throw new Error(
//         `Simulation failed: ${JSON.stringify(
//           simulation.err,
//           (_, v) => (typeof v === "bigint" ? v.toString() : v),
//           2
//         )}`
//       );
//     }

//     console.log("✅ Simulation passed, sending...");
//     console.log("📋 Simulation logs:");
//     simulation.logs?.forEach((log: string, i: number) =>
//       console.log(`  [${i}] ${log}`)
//     );
//   } catch (simErr: any) {
//     // SolanaError wraps simulation errors — extract the logs
//     const logs = simErr?.context?.logs ?? simErr?.logs ?? [];
//     console.error("[ERROR] Simulation threw:", simErr?.message ?? simErr);
//     logs.forEach((log: string, i: number) => console.log(`  [${i}] ${log}`));
//     throw simErr;
//   }

//   try {
//     await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(
//       signedTransaction,
//       {
//         commitment: "confirmed",
//       }
//     );
//   } catch (err: any) {
//     // @solana/kit wraps the RPC error — the logs are in err.context
//     console.error("[ERROR] Send failed:", err?.message);
//     console.error("   Error code:", err?.context?.err);

//     const logs: string[] = err?.context?.logs ?? [];
//     if (logs.length) {
//       console.error("📋 Transaction logs:");
//       logs.forEach((log, i) => console.error(`  [${i}] ${log}`));
//     } else {
//       // Fall back to full error dump
//       console.error(
//         "   Full error:",
//         JSON.stringify(
//           err,
//           (_, v) => (typeof v === "bigint" ? v.toString() : v),
//           2
//         )
//       );
//     }

//     throw err;
//   }

//   const sig = getSignatureFromTransaction(signedTransaction);
//   return sig;
// }

export function validateGiftCreationInputs(
  createGiftData: CreateGiftData,
  imageFile: File
): boolean {
  if (!imageFile) {
    throw new Error("upload image");
  }
  if (imageFile?.size > 5 * 1024 * 1024) {
    throw new Error("File too large");
  }
  if (!createGiftData.birthday) {
    throw new Error("Birthday is required");
  }

  // Check for valid date
  const date = new Date(createGiftData.birthday);
  // Invalid date is NaN, and toString = 'Invalid Date'
  if (isNaN(date.getTime()) || date.toString() === "Invalid Date") {
    throw new Error("Birthday must be a valid date");
  }

  // Check that the date is today or in the future
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  if (date < today) {
    throw new Error("Birthday must be today or in the future");
  }
  if (
    !createGiftData.giftAmount ||
    isNaN(Number(createGiftData.giftAmount)) ||
    Number(createGiftData.giftAmount) <= 0
  ) {
    throw new Error("Gift amount must be a valid positive number");
  }
  if (!createGiftData.name.trim()) {
    throw new Error("Name is required");
  }
  if (
    !createGiftData.email ||
    typeof createGiftData.email !== "string" ||
    createGiftData.email.trim().length === 0
  ) {
    throw new Error("Recipient email is required");
  }
  if (!createGiftData.securityAnswer) {
    throw new Error("Security answer is required");
  }
  if (!createGiftData.securityQuestion) {
    throw new Error("Security question is required");
  }
  return true;
}

export function truncate(account: string) {
  return `${account.slice(0, 4)}...${account.slice(-4)}`;
}

export function validateDeliveryDate(deliveryDate: Date): {
  valid: boolean;
  error?: string;
} {
  const now = DateTime.now(); // User's local timezone
  const delivery = DateTime.fromJSDate(deliveryDate);

  // Get start of today in user's timezone
  const todayStart = now.startOf("day");
  const deliveryStart = delivery.startOf("day");

  // Must be today or future
  if (deliveryStart < todayStart) {
    return {
      valid: false,
      error: "Cannot schedule gifts in the past",
    };
  }

  // Convert to UTC Unix timestamp for Solana
  const deliveryTimestamp = Math.floor(delivery.toSeconds());

  return { valid: true };
}

import { getTransactionEncoder, getTransactionDecoder } from "@solana/kit";
import { LAMPORTS_PER_SOL, TransactionSendingSigner } from "@solana/connector";
import {
  getCreateAccountInstruction,
  getTransferSolInstruction,
} from "@solana-program/system";
import {
  getCreateGiftInstruction,
  Gift,
  SOLGIFT_PROGRAM_ADDRESS,
} from "../generated/solgift";
import { u16ToLeBytes } from "../helper/compute";
import {
  fetchDigitalAsset,
  findAssociatedTokenPda,
  findMasterEditionPda,
  findMetadataPda,
  getCreateMasterEditionV3Instruction,
  getCreateMetadataAccountV3Instruction,
} from "@metaplex-foundation/mpl-token-metadata-kit";
import {
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMintInstruction,
  getMintSize,
  getMintToInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import { getAddMemoInstruction } from "@solana-program/memo";

export function createPrivySigner(
  wallet: ConnectedStandardSolanaWallet
): TransactionPartialSigner {
  const walletAddress: Address = address(wallet.address);

  return {
    address: walletAddress,
    signTransactions: async (
      transactions: readonly (Transaction &
        TransactionWithinSizeLimit &
        TransactionWithLifetime)[],
      _config?: TransactionPartialSignerConfig
    ): Promise<readonly SignatureDictionary[]> => {
      console.log(
        `[Privy-Signer] invoked for ${transactions.length} transaction(s)`
      );

      const encoder = getTransactionEncoder();
      const decoder = getTransactionDecoder();

      try {
        const results = await Promise.all(
          transactions.map(async (tx, index) => {
            try {
              console.log(
                `[Privy-Signer] Encoding transaction ${index + 1}/${transactions.length}...`
              );

              // Encode to ReadonlyUint8Array
              const txBytes = encoder.encode(tx);

              // Convert to mutable Uint8Array (Privy requirement)
              const mutableTxBytes = new Uint8Array(txBytes);

              console.log(
                `[Privy-Signer] Signing transaction ${index + 1}/${transactions.length}...`
              );

              // Sign with Privy wallet
              const { signedTransaction } = await wallet.signTransaction({
                transaction: mutableTxBytes,
              });

              console.log(
                `[Privy-Signer] Decoding signed transaction ${index + 1}...`
              );

              // Decode the signed transaction
              const decodedTx = decoder.decode(signedTransaction);

              // Extract the signature
              // console.log(decodedTx);
              const signature = decodedTx.signatures[address(wallet.address)];
              if (!signature) throw new Error("No Signature");
              console.log(
                `[Privy-Signer] ✅ Transaction ${index + 1} signed:`,
                signature
              );

              // Return type: { [address: string]: SignatureBytes }
              return {
                [address(wallet.address)]: signature,
              };
            } catch (error) {
              console.error(
                `[Privy-Signer] ❌ Error signing transaction ${index + 1}:`,
                error
              );
              throw new Error(
                `[Privy-Signer] Failed to sign transaction ${index + 1}: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            }
          })
        );

        console.log(
          `[Privy-Signer] ✅ All ${transactions.length} transaction(s) signed successfully`
        );
        return results;
      } catch (error) {
        console.error("[Privy-Signer] ❌ Error in signTransactions:", error);
        throw error;
      }
    },
  };
}

export function createPrivyTransactionSendingSigner(
  wallet: ConnectedStandardSolanaWallet
): TransactionSendingSigner {
  const walletAddress: Address = address(wallet.address);

  return {
    address: walletAddress,
    signAndSendTransactions: async (
      transactions: readonly (
        | Transaction
        | (Transaction & TransactionWithLifetime)
      )[],
      config?: TransactionSendingSignerConfig
    ): Promise<readonly SignatureBytes[]> => {
      console.log(
        `[Privy-Signer] invoked for ${transactions.length} transaction(s)`
      );

      const encoder = getTransactionEncoder();
      // const decoder = getTransactionDecoder();

      try {
        const results = await Promise.all(
          transactions.map(async (tx, index) => {
            try {
              console.log(
                `[Privy-Signer] Encoding transaction ${index + 1}/${transactions.length}...`
              );

              // Encode to ReadonlyUint8Array
              const txBytes = encoder.encode(tx);

              // Convert to mutable Uint8Array (Privy requirement)
              const mutableTxBytes = new Uint8Array(txBytes);

              console.log(
                `[Privy-Signer] Signing transaction ${index + 1}/${transactions.length}...`
              );

              // Sign with Privy wallet
              const { signature } = await wallet.signAndSendTransaction({
                chain: "solana:devnet",
                transaction: mutableTxBytes,
              });

              return signature as SignatureBytes;
            } catch (error) {
              console.error(
                `[Privy-Signer] ❌ Error signing transaction ${index + 1}:`,
                error
              );
              throw new Error(
                `[Privy-Signer] Failed to sign transaction ${index + 1}: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            }
          })
        );

        console.log(
          `[Privy-Signer] ✅ All ${transactions.length} transaction(s) signed successfully`
        );
        return results;
      } catch (error) {
        console.error("[Privy-Signer] ❌ Error in signTransactions:", error);
        throw error;
      }
    },
  };
}

export function createAuthorizedRecipientSigner(
  signer: KeyPairSigner<string>
): TransactionPartialSigner {
  return {
    address: signer.address,
    signTransactions: async (
      transactions: readonly (Transaction &
        TransactionWithinSizeLimit &
        TransactionWithLifetime)[],
      _config?: TransactionPartialSignerConfig
    ): Promise<readonly SignatureDictionary[]> => {
      console.log(
        `[Authorized-Recipient] signer invoked for ${transactions.length} transaction(s)`
      );
      return signer.signTransactions(transactions);
    },
  };
}

export const rpc = createSolanaRpc("https://api.devnet.solana.com");
const rpcSubscriptions = createSolanaRpcSubscriptions(
  "wss://api.devnet.solana.com"
);

export async function runSimulation({
  userPda,
  salt,
  count,
  encoder,
  addressEncoder,
  signer,
  createGiftData,
  setGiftCreationStage,
  authorizedClaimer,
  authorizedClaimerSigner,
}: {
  userPda: Address<string>;
  salt: Uint8Array<ArrayBuffer>;
  count: number;
  encoder: TextEncoder;
  addressEncoder: FixedSizeEncoder<Address<string>, 32>;
  signer: TransactionSigner<string>;
  createGiftData: CreateGiftData;
  setGiftCreationStage: React.Dispatch<
    React.SetStateAction<GiftCreationStage[]>
  >;
  authorizedClaimer: Address;
  authorizedClaimerSigner: TransactionPartialSigner;
}) {
  try {
    setGiftCreationStage((prev) => {
      return [
        ...prev,
        {
          errorMessage: "",
          stage: CreateGiftStage.PreparingTransaction,
          status: GiftCreationStatus.Loading,
        },
      ];
    });

    const sim_instructions: Instruction[] = [];

    sim_instructions.push();

    const nftMint = await generateKeyPairSigner();

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
    const sim_createMintAccountIx = getCreateAccountInstruction({
      payer: signer,
      newAccount: nftMint,
      lamports: mintRent,
      space: BigInt(mintSize),
      programAddress: TOKEN_PROGRAM_ADDRESS,
    });

    // Initialize mint - decimals: 0, mint and freeze authority = signer (required for NFT)
    const sim_initMintIx = getInitializeMintInstruction({
      mint: nftMint.address,
      decimals: 0, // this is required for NFT (non-fungible)
      mintAuthority: signer.address,
      freezeAuthority: signer.address,
    });

    // Create Associated Token Account for the gift PDA to hold the NFT
    const sim_createAtaIx = await getCreateAssociatedTokenInstructionAsync({
      payer: signer,
      ata: giftNftAta,
      owner: giftPda,
      mint: nftMint.address,
    });

    // Mint exactly 1 token into the gift PDA's ATA (supply = 1 means NFT)
    const sim_mintToIx = getMintToInstruction({
      mint: nftMint.address,
      token: giftNftAta,
      mintAuthority: signer,
      amount: 1n,
    });

    // Attach Metaplex metadata, making this a certified NFT per standard, using URI, symbol, creators, etc.
    const sim_createMetadataIx = getCreateMetadataAccountV3Instruction({
      metadata: metadataPda,
      mint: nftMint.address,
      mintAuthority: signer,
      payer: signer,
      updateAuthority: signer.address,
      data: {
        name: "nftName",
        symbol: "GIFT",
        uri: `https://test/ipfs/test`,
        sellerFeeBasisPoints: 0, // no royalties
        creators: null, // or provide an array with creators if you want
        collection: null,
        uses: null,
      },
      isMutable: false,
      collectionDetails: null,
    });

    const [masterEditionPda] = await findMasterEditionPda({
      mint: nftMint.address,
    });

    const sim_createMasterEditionIx = getCreateMasterEditionV3Instruction({
      edition: masterEditionPda,
      mint: nftMint.address,
      updateAuthority: signer,
      mintAuthority: signer,
      payer: signer,
      metadata: metadataPda,
      maxSupply: 0, // 0 = unique NFT, no prints allowed
    });

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

    const sim_fundRecipientIx = getTransferSolInstruction({
      source: signer,
      destination: authorizedClaimer,
      amount: lamports(
        minRent + minRent + minAtaRent + lamportsForOneTransaction
      ),
    });

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

    const sim_createGiftIx = getCreateGiftInstruction({
      signer: signer,
      user: userPda,
      gift: giftPda,
      salt: salt,
      nftMint: nftMint.address,
      giftNftAta: giftNftAta,
      solAmount: solAmount,
      deliveryDate: birthdayTimestamp,
      authorizedClaimer: authorizedClaimerSigner,
    });

    sim_instructions.push(sim_createMintAccountIx); // allocate
    sim_instructions.push(sim_initMintIx); // initialize mint, signer = authority
    sim_instructions.push(sim_createAtaIx); // create gift PDA's ATA
    sim_instructions.push(sim_mintToIx); // mint 1 token → supply = 1
    sim_instructions.push(sim_createMetadataIx); // attach metadata, signer still authority ✅
    sim_instructions.push(sim_createMasterEditionIx);
    sim_instructions.push(sim_createGiftIx); // Anchor checks all pass ✅
    sim_instructions.push(sim_fundRecipientIx);

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const transactionMessage = pipe(
      createTransactionMessage({ version: "legacy" }),
      (tx) => setTransactionMessageFeePayerSigner(signer, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstructions(sim_instructions, tx)
    );

    const unsignedForSim = compileTransaction(transactionMessage);
    const { value: simulation } = await rpc
      .simulateTransaction(getBase64EncodedWireTransaction(unsignedForSim), {
        encoding: "base64",
        replaceRecentBlockhash: true,
        sigVerify: false, // ← critical: skip sig check so unsigned tx simulates fine
        commitment: "confirmed",
      })
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
  } catch (error) {
    setGiftCreationStage((prev) => {
      const idx = prev.findIndex(
        (s) => s.stage === CreateGiftStage.PreparingTransaction
      );
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          errorMessage: "Internal Error",
          status: GiftCreationStatus.Error,
        };
        return updated;
      }
      return prev;
    });
    throw new Error(String(error));
  }
}

export async function claimRentAuthorizedClaimer({
  nftMint,
  authorizedClaimerKeypair,
  sender,
}: {
  nftMint: Address<string>;
  authorizedClaimerKeypair: KeyPairSigner;
  sender: Address<string> | null;
}) {
  try {
    if (!sender) return;
    const { value: sol_left } = await rpc
      .getBalance(authorizedClaimerKeypair.address)
      .send();

    // Second tx: clean up SOL from authorized claimer
    if (sol_left - lamports(5000n) <= 0) return;
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
    const emptyAuthorizedClaimerIx = getTransferSolInstruction({
      source: authorizedClaimerKeypair,
      destination: sender,
      amount: sol_left - lamports(5000n),
    });
    const instructions_2: Instruction[] = [];
    instructions_2.push(emptyAuthorizedClaimerIx);
    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(authorizedClaimerKeypair, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
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

    // console.log("NFT created successfully!");
    // console.log("Mint address:", nftMint);

    // console.log("Name:", asset.metadata.name);
    // console.log("URI:", asset.metadata.uri);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function sendAndConfirm(options: {
  instructions: Instruction[];
  signer: TransactionSigner<string>;
  payer: TransactionSigner<string>;
  setClaimGiftError?: React.Dispatch<
    React.SetStateAction<ClaimGiftErrors | null>
  >;
}) {
  const { instructions, payer, signer, setClaimGiftError } = options;

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

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
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx)
  );

  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);

  assertIsTransactionWithBlockhashLifetime(signedTransaction);
  assertIsFullySignedTransaction(signedTransaction);

  const transactionSigners = signedTransaction.signatures;

  console.log("✅ Signers signature status:");
  Object.entries(transactionSigners).forEach(([address, signature], i) => {
    const hasSignature = signature !== null;
    if (hasSignature) {
      console.log(`  [${i}] Signed: ${address}`);
    } else {
      console.log(`  [${i}] NOT SIGNED: ${address}`);
    }
  });

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
      if (setClaimGiftError)
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
      simulation.logs?.forEach((log, i) => console.log(`  [${i}] ${log}`));
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
    if (setClaimGiftError)
      setClaimGiftError(ClaimGiftErrors.FAILED_TO_CLAIM_GIFT);
    const logs = simErr?.context?.logs ?? simErr?.logs ?? [];
    console.error("❌ Simulation threw:", simErr?.message ?? simErr);
    logs.forEach((log: string, i: number) => console.log(`  [${i}] ${log}`));

    throw simErr;
  }

  try {
    await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(
      signedTransaction,
      { commitment: "confirmed" }
    );
  } catch (err: any) {
    // @solana/kit wraps the RPC error — the logs are in err.context
    if (setClaimGiftError)
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
