import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CreateGiftData } from "./types";
import {
  appendTransactionMessageInstructions,
  assertIsSendableTransaction,
  assertIsTransactionWithBlockhashLifetime,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  Instruction,
  pipe,
  Rpc,
  RpcSubscriptions,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayer,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  SolanaRpcApi,
  SolanaRpcSubscriptionsApi,
  TransactionSigner,
} from "@solana/kit";

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
