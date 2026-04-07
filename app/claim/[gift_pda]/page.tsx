"use client";

import { usePrivy } from "@privy-io/react-auth"; // or from wherever your wallet hook comes
import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import {
  CreateGiftInput,
  fetchGift,
  getClaimGiftInstruction,
  Gift,
  GiftClaimed,
} from "@/app/generated/solgift";
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
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useConnector } from "@solana/connector/react";
import {
  createAuthorizedRecipientSigner,
  createPrivySigner,
} from "@/app/lib/utils";
import { WalletModal } from "@/app/components/wallet-modal";
import { getTransferSolInstruction } from "@solana-program/system";
// import { createPrivyPartialSigner } from "@/app/lib/utils";

const rpc = createSolanaRpc("https://api.devnet.solana.com");
const rpcSubscriptions = createSolanaRpcSubscriptions(
  "ws://api.devnet.solana.com"
);

// const SOLGIFT_PROGRAM_ADDRESS: Address = idl.address as Address;

// This page pulls the gift_pda from the URL, then sets up React state hooks
export default function Page() {
  const encoder = new TextEncoder();
  const params = useParams();
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
  const { wallets } = useWallets();

  const { ready, user, authenticated } = usePrivy();
  // console.log(ready, user, authenticated, "HIANDY");
  const {
    isConnected,
    isConnecting,
    account,
    connector,
    walletConnectUri,
    clearWalletConnectUri,
  } = useConnector();

  const connectedToExternalWallet = isConnected && account && connector;
  const connectedToEmbeddedWallet = ready && user && authenticated;

  console.log(connectedToEmbeddedWallet, "connectedToEmbeddedWallet --anakns ");

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
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Fetch cipher and gift data
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/v1/gifts/${gift_pda}`, {
          method: "GET",
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData);
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
    if (!(connectedToEmbeddedWallet || connectedToExternalWallet)) return;

    const wallet = wallets.find((w) => w.standardWallet?.name === "Privy");
    if (!wallet) {
      throw new Error("No privy wallet");
    }
    const signer = createPrivySigner(wallet);

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
    // console.log(authorizedClaimerKeypair);
    // return;
    const payer = createAuthorizedRecipientSigner(authorizedClaimerKeypair);
    console.log(payer.address, "AUTHORAIZED CLAIMER");

    if (payer.address !== gift.data.authorizedClaimer) {
      throw new Error("UNAUTHORIZEDC LCAIMER");
      return;
    }
    console.log("ddd");
    // setAuthorizedClaimer();
    const [giftNftAta] = await findAssociatedTokenPda({
      mint: gift.data.nftMint,
      owner: gift_pda as Address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const [assetRecipientNftAta] = await findAssociatedTokenPda({
      mint: gift.data.nftMint,
      owner: address(wallet.address),
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    console.log(
      {
        authorizedClaimer: payer,
        assetRecipient: signer,
        gift: address(gift_pda),
        nftMint: gift.data.nftMint,
        giftNftAta: giftNftAta,
        assetRecipientNftAta: assetRecipientNftAta,
        answerHash: answerHash,
      },
      "CLAIM GIFT INFOR"
    );
    const claimGiftIx = getClaimGiftInstruction({
      authorizedClaimer: payer,
      assetRecipient: signer,
      gift: address(gift_pda),
      nftMint: gift.data.nftMint,
      giftNftAta: giftNftAta,
      assetRecipientNftAta: assetRecipientNftAta,
      answerHash: answerHash,
    });

    console.log("NFT MINT ADDRSEE", gift.data.nftMint);
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

      // const transactionMessage = pipe(
      //   createTransactionMessage({ version: 0 }),
      //   (tx) => setTransactionMessageFeePayer(payer.address, tx),

      //   (tx) => appendTransactionMessageInstructions(instructions, tx)
      // );
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
        (tx) =>
          setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => appendTransactionMessageInstructions(instructions, tx)
      );

      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);

      // Check if transaction is sendable & has expected signatures
      assertIsTransactionWithBlockhashLifetime(signedTransaction);
      assertIsFullySignedTransaction(signedTransaction);

      // Print all signer addresses who have successfully signed
      // The signatures are stored as an array matching the staticKeys/publicKeys in the transaction
      // Print out which public keys have a signature
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

    const sx = await sendAndConfirm({
      instructions,
      payer: payer,
    });

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

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
    const asset = await fetchDigitalAsset(rpc, gift.data.nftMint);

    console.log("NFT created successfully!");
    console.log("Mint address:", gift.data.nftMint);
    // console.log("Signature for claiming GIFT:", sx);

    console.log("Name:", asset.metadata.name);
    console.log("URI:", asset.metadata.uri);

    try {
      // It is generally better practice to include a JSON body even if your backend handler uses URL params,
      // for explicitness and forward compatibility. Many APIs include required information in the body.
      // Industry convention: Always send a JSON payload if your HTTP method is POST.
      const response = await fetch(
        `/api/v1/users/${address(wallet.address)}/gifts/${gift_pda}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient: address(wallet.address),
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
    if (!(connectedToEmbeddedWallet || connectedToExternalWallet)) {
      setIsModalOpen(true);
      return;
    }
    const answer = e.target.answer.value;
    claimGift(answer);
  }
  const [incorrectPhone, setIncorrectPhone] = useState(true);

  async function handleDecryptQuestion(phone: string) {
    if (phone.length === 10) {
      try {
        const res = await decryptQuestion(cipher, gift.data.salt, phone);
        setDecrypted(res);
        setIncorrectPhone(false);
      } catch (error) {
        setIncorrectPhone(true);
        console.log(error);
      }
    }
  }
  useEffect(() => {
    handleDecryptQuestion(phone);
  }, [phone]);

  return (
    <main
      className={`antialiased bg-sky-50 min-h-screen py-20 px-10 text-black`}
    >
      <form
        onSubmit={handleClaimGift}
        className="w-[650px] mx-auto gap-10 flex flex-col items-center"
      >
        <div className="bg-white flex flex-col gap-4 rounded-[44px] p-12 w-full">
          <fieldset className="flex w-full flex-col justify-start">
            <label
              className="mb-2.5 block text-neutral-500 text-sm leading-none text-violet12"
              htmlFor="phone"
            >
              Phone
            </label>
            <input
              className="rounded-full shrink-0 grow border-none py-2.5 text-sm px-3 leading-none text-violet11 shadow-[0_0_0_1px] shadow-neutral-300 outline-none focus:shadow-[0_0_0_1.5px] focus:shadow-violet8"
              id="phone"
              type="text"
              value={phone}
              onChange={handleSetRecipientPhone}
              placeholder="1234567890"
              name="phone"
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

        <button
          type="submit"
          disabled={incorrectPhone}
          className="inline-flex disabled:cursor-not-allowed bg-teal-300 hover:bg-teal-200 hover:scale-[102%] duration-500 py-4 w-full text-2xl items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.98] cursor-pointer"
        >
          CLAIM!
        </button>
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
