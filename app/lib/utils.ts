import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CreateGiftData } from "./types";
import { DateTime } from "luxon";
import { createSolanaRpc } from "@solana/kit";
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

export async function sendAndConfirm(options: sendAndConfirmParams) {
  const { instructions, payer, rpc, rpcSubscriptions } = options;
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  console.log(payer.address);
  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(payer.address, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions([...instructions], tx)
  );

  console.log("Preparing to sign transaction.");

  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);

  console.log("Signed Transaction:", signedTransaction);

  assertIsSendableTransaction(signedTransaction);
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
        "[ERROR] Simulation error:",
        JSON.stringify(
          simulation.err,
          (_, v) => (typeof v === "bigint" ? v.toString() : v),
          2
        )
      );
      console.error("📋 Logs:");
      simulation.logs?.forEach((log: string, i: number) =>
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
    simulation.logs?.forEach((log: string, i: number) =>
      console.log(`  [${i}] ${log}`)
    );
  } catch (simErr: any) {
    // SolanaError wraps simulation errors — extract the logs
    const logs = simErr?.context?.logs ?? simErr?.logs ?? [];
    console.error("[ERROR] Simulation threw:", simErr?.message ?? simErr);
    logs.forEach((log: string, i: number) => console.log(`  [${i}] ${log}`));
    throw simErr;
  }

  try {
    await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(
      signedTransaction,
      {
        commitment: "confirmed",
      }
    );
  } catch (err: any) {
    // @solana/kit wraps the RPC error — the logs are in err.context
    console.error("[ERROR] Send failed:", err?.message);
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
  if (!createGiftData.phone || createGiftData.phone.length < 8) {
    throw new Error(
      "Recipient phone number is required and must be at least 8 digits"
    );
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
import { TransactionSendingSigner } from "@solana/connector";

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

      try {
        const results = await Promise.all(
          transactions.map(async (tx, index) => {
            try {
              console.log(
                `[Authorized-Recipient] Signing transaction ${index + 1} with keypair...`
              );

              // KeyPairSigner has a signTransactions method that takes TransactionMessage
              // We need to sign the raw transaction
              const [signedTx] = await signer.signTransactions([tx]);

              const signature = signedTx[signer.address];

              // Decode to extract the signature
              console.log(
                `[Authorized-Recipient] ✅ Transaction ${index + 1} signed:`,
                signature
              );

              return {
                signature,
                publicKey: signer.address,
              };
            } catch (error) {
              console.error(
                `[Authorized-Recipient] ❌ Error signing transaction ${index + 1}:`,
                error
              );
              throw error;
            }
          })
        );

        return results;
      } catch (error) {
        console.error(
          "[Authorized-Recipient] ❌ Error in signTransactions:",
          error
        );
        throw error;
      }
    },
  };
}

export const rpc = createSolanaRpc("https://api.devnet.solana.com");
