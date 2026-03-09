"use client";

import { spaceMono } from "@/app/fonts/fonts";
import {
  CreateGiftInput,
  fetchGift,
  getClaimGiftInstruction,
  Gift,
  GiftClaimed,
} from "@/app/generated/solgift";
import { decryptQuestion, recursiveSha256 } from "@/app/helper/compute";
import { RECURSIVE_HASH_DEPTH } from "@/app/helper/constants";
import {
  fetchDigitalAsset,
  findAssociatedTokenPda,
} from "@metaplex-foundation/mpl-token-metadata-kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  Address,
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  Instruction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  TransactionSigner,
} from "@solana/kit";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const rpc = createSolanaRpc("http://127.0.0.1:8899");
const rpcSubscriptions = createSolanaRpcSubscriptions("ws://127.0.0.1:8900");
// const SOLGIFT_PROGRAM_ADDRESS: Address = idl.address as Address;

// This page pulls the gift_pda from the URL, then sets up React state hooks
export default function Page() {
  const encoder = new TextEncoder();
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
  const params = useParams();
  // gift_pda is the param key from /claim/[gift_pda]
  const gift_pda =
    typeof params === "object" && params !== null
      ? (params as { [key: string]: string })["gift_pda"]
      : "";
  const [gift, setGift] = useState<any | null>(null);
  const [cipher, setCipher] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [decrypted, setDecrypted] = useState<string>("");

  // Fetch cipher and gift data
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/v1/gifts/${gift_pda}`, {
          method: "GET",
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw Error(errorData);
        }
        const dbData = await response.json();
        setCipher(dbData.data.security_question || "");
        const giftData = await fetchGift(rpc, gift_pda as Address);
        setGift(giftData);
        console.log("giftdata", giftData);
        console.log("dbadata", dbData);
      } catch (err) {
        console.error("Failed to fetch data", err);
      }
    }
    fetchData();
  }, [gift_pda]);

  function handleSetRecipientPhone(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.replace(/[^0-9]/g, "");
    setPhone(value);
  }

  async function claimGift(answer: string) {
    const privyWallet = await generateKeyPairSigner();
    console.log(privyWallet);
    const salt = gift.data.salt;
    const combined = new Uint8Array([
      ...encoder.encode(answer),
      ...encoder.encode(phone.toString()),
      ...salt,
    ]);
    const answerHash = await recursiveSha256(
      combined,
      RECURSIVE_HASH_DEPTH - 1
    );

    const combined_reverse = new Uint8Array([
      ...salt,
      ...encoder.encode(phone.toString()),
      ...encoder.encode(answer),
    ]);

    const seed = new Uint8Array(
      await crypto.subtle.digest("SHA-256", combined_reverse)
    );
    const authorizedClaimerKeypair =
      await createKeyPairSignerFromPrivateKeyBytes(new Uint8Array(seed));

    if (authorizedClaimerKeypair.address !== gift.data.authorizedClaimer) {
      throw Error("UNAUTHORIZEDC LCAIMER");
      return;
    }
    // setAuthorizedClaimer();
    const [giftNftAta] = await findAssociatedTokenPda({
      mint: gift.data.nftMint,
      owner: gift_pda as Address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const [assetRecipientNftAta] = await findAssociatedTokenPda({
      mint: gift.data.nftMint,
      owner: privyWallet.address as Address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const claimGiftIx = getClaimGiftInstruction({
      authorizedClaimer: authorizedClaimerKeypair,
      assetRecipient: privyWallet,
      gift: gift_pda as Address,
      nftMint: gift.data.nftMint,
      giftNftAta: giftNftAta,
      assetRecipientNftAta: assetRecipientNftAta,
      answerHash: answerHash,
    });
    const instructions = [];
    instructions.push(claimGiftIx);

    async function sendAndConfirm(options: {
      instructions: Instruction[];
      payer: TransactionSigner;
    }) {
      const { instructions, payer } = options;

      const transactionMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayer(payer.address, tx),
        (tx) => appendTransactionMessageInstructions(instructions, tx)
      );

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

      const txWithLifetime = setTransactionMessageLifetimeUsingBlockhash(
        latestBlockhash,
        transactionMessage
      );

      const signedTransaction =
        await signTransactionMessageWithSigners(txWithLifetime);

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

    const sx = await sendAndConfirm({
      instructions,
      payer: authorizedClaimerKeypair,
    });

    const asset = await fetchDigitalAsset(rpc, gift.data.nftMint);

    console.log("NFT created successfully!");
    console.log("Mint address:", gift.data.nftMint);
    console.log("Signature:", sx);
    console.log("Name:", asset.metadata.name);
    console.log("URI:", asset.metadata.uri);

    try {
      // It is generally better practice to include a JSON body even if your backend handler uses URL params,
      // for explicitness and forward compatibility. Many APIs include required information in the body.
      // Industry convention: Always send a JSON payload if your HTTP method is POST.
      const response = await fetch(
        `/api/v1/users/${privyWallet.address}/gifts/${gift_pda}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient: privyWallet.address,
            gift_pda: gift_pda,
          }),
        }
      );

      if (!response.ok) {
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
      console.error("Error making request to backend:", error);
    }
  }

  function handleClaimGift(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const answer = e.target.answer.value;

    claimGift(answer);
  }

  useEffect(() => {
    if (phone.length === 10) {
      decryptQuestion(cipher, gift.data.salt, phone)
        .then((res) => {
          setDecrypted(res);
        })
        .catch((err) => {
          console.error("Error decrypting security question", err);
        });
    }
  }, [phone]);
  return (
    <main
      className={`${spaceMono.className} antialiased bg-sky-300 min-h-screen py-20 px-10 text-black`}
    >
      <form
        onSubmit={handleClaimGift}
        className="max-w-[650px] my-20 mx-auto flex flex-col gap-15 "
      >
        <div className="w-full flex flex-col gap-2.5 rounded-[35px] p-10 bg-white border-[6px] border-black shadow-[-5px_5px_0_0_rgba(0,0,0)]">
          <fieldset className="mb-[15px] flex w-full flex-col justify-start">
            <label
              className="mb-2.5 block text-[13px] leading-none text-violet12"
              htmlFor="phone"
            >
              Phone
            </label>
            <input
              className="h-[35px] shrink-0 grow rounded px-2.5 text-[15px] leading-none text-violet11 shadow-[0_0_0_1px] shadow-violet7 outline-none focus:shadow-[0_0_0_2px] focus:shadow-violet8"
              id="phone"
              type="text"
              value={phone}
              onChange={handleSetRecipientPhone}
              placeholder="1234567890"
              name="phone"
            />
          </fieldset>

          {decrypted && (
            <fieldset className="mb-[15px] flex w-full flex-col justify-start">
              <label
                className="mb-2.5 block text-[13px] leading-none text-violet12"
                htmlFor="answer"
              >
                Security Answer
              </label>
              <input
                className="h-[35px] shrink-0 grow rounded-lg p-2.5 text-[15px] leading-none text-violet11 shadow-[0_0_0_1px] shadow-violet7 outline-none focus:shadow-[0_0_0_2px] focus:shadow-violet8"
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

        <button
          type="submit"
          className="relative z-2 font-extrabold text-2xl text-black rounded-xl py-4 px-8 bg-amber-300 border-[6px] border-black shadow-[-5px_5px_0_0_rgba(0,0,0)] cursor-pointer transition-all duration-200
          hover:shadow-[-10px_10px_0_0_rgba(0,0,0)]
          hover:translate-x-1 hover:-translate-y-1"
        >
          CLAIM!
        </button>
      </form>
    </main>
  );
}
