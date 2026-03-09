"use client";

import { ConnectButton } from "@/app/components/connect-button";

import "@radix-ui/themes/styles.css";

import {
  createAndMint,
  createNft,
  fetchDigitalAsset,
  findMetadataPda,
  getCreateMetadataAccountV3Instruction,
  TokenStandard,
} from "@metaplex-foundation/mpl-token-metadata-kit";
import {
  createKeyPairSignerFromPrivateKeyBytes,
  getBase64EncodedWireTransaction,
  getBase64Encoder,
  KeyPairSigner,
} from "@solana/kit";

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
import React, { useEffect, useState } from "react";
import {
  getCreateAccountInstruction,
  getTransferSolInstruction,
} from "@solana-program/system";
import { RECURSIVE_HASH_DEPTH } from "@/app/helper/constants";
import idl from "@/solgift.json";
import {
  getCreateGiftInstruction,
  getInitializeUserInstruction,
} from "@/app/generated/solgift";
import { encryptQuestion, recursiveSha256 } from "@/app/helper/compute";
import {
  assertProgramsDeployed,
  loadDefaultKeypair,
  uploadImageToPinata,
  uploadMetadataToPinata,
} from "@/app/helper/program";
import { LAMPORTS_PER_SOL, TOKEN_PROGRAM_ADDRESS } from "@solana/client";
import { u16ToLeBytes, getToday } from "@/app/helper/compute";
import {
  getSetAuthorityInstruction,
  AuthorityType,
  getInitializeMintInstruction,
  getMintSize,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getMintToInstruction,
} from "@solana-program/token";
import { createClient } from "@/app/lib/supabase/client";
import { createServerClient } from "@supabase/ssr";
import { File, Image, ImageDownIcon, ImageUpIcon } from "lucide-react";
import { DatePickerDemo } from "../components/ui/datepicker";
import { spaceMono } from "../fonts/fonts";
import HCaptcha from "@hcaptcha/react-hcaptcha";

const rpc = createSolanaRpc("http://127.0.0.1:8899");
const rpcSubscriptions = createSolanaRpcSubscriptions("ws://127.0.0.1:8900");
const SOLGIFT_PROGRAM_ADDRESS: Address = idl.address as Address;

type CreateGiftData = {
  name: string;
  giftAmount: number;
  phone: string;
  birthday: string;
  securityQuestion: string;
  securityAnswer: string;
};

export default function CreateGiftForm() {
  const formattedDate = getToday();
  // const { signer, ready } = useKitTransactionSigner();
  const [createGiftData, setCreateGiftData] = useState<CreateGiftData>({
    name: "",
    giftAmount: 0.5,
    birthday: formattedDate,
    phone: "",
    securityQuestion: "",
    securityAnswer: "",
  });
  const [signer, setSigner] = useState<KeyPairSigner<string> | null>(null);
  async function createSigner() {
    const signer = await loadDefaultKeypair();
    setSigner(signer);
  }
  useEffect(() => {
    createSigner();
  }, []);

  const [imageFile, setImageFile] = useState<null | File>(null);

  const encoder = new TextEncoder();

  function handleSetGiftAmount(e: React.ChangeEvent<HTMLInputElement>) {
    setCreateGiftData((prev) => {
      return { ...prev, giftAmount: Number(e.target.value) };
    });
  }

  function handleSetGiftName(e: React.ChangeEvent<HTMLInputElement>) {
    setCreateGiftData((prev) => {
      return { ...prev, name: e.target.value.trim() };
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

  function handleSetRecipientPhone(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.replace(/[^0-9]/g, "");
    setCreateGiftData((prev) => {
      return { ...prev, phone: value };
    });
  }

  function handleSetSecurityQuestion(e: React.ChangeEvent<HTMLInputElement>) {
    setCreateGiftData((prev) => {
      return { ...prev, securityQuestion: e.target.value.trim() };
    });
  }

  const handleCreateGift = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    // HCAPTHC VERIFUCATION

    await assertProgramsDeployed(rpc, [
      SOLGIFT_PROGRAM_ADDRESS,
      "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s" as Address<"metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s">, // Metaplex token metadata
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address<"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA">, // SPL Token (should always exist)
    ]);
    try {
      if (!imageFile) {
        alert("upload image");
        throw Error("upload image");
      }

      if (imageFile?.size > 5 * 1024 * 1024) {
        alert("File too large, should be lessthan 5MB");
        throw Error("File too large");
      }

      if (!signer) {
        alert("connect wallet da");
        throw Error("CONNECT WALLET");
      }

      const nftName = createGiftData.name;
      console.log(nftName, "NFT NAME");
      // const nftDescription = createGiftData.get("nftDescription")! as string;
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
        const phone: string = createGiftData.phone;
        const salt = crypto.getRandomValues(new Uint8Array(32)); // [121, 33, 44 ....]
        const answer = createGiftData.securityAnswer;

        const combined = new Uint8Array([
          ...encoder.encode(answer as string), // "KIo -> [75 77 111]
          ...encoder.encode(phone),
          ...salt,
        ]);

        const instructions = [];
        let count: number = 0;
        const nftMint = await generateKeyPairSigner();
        const combined_reverse = new Uint8Array([
          ...salt,
          ...encoder.encode(phone),
          ...encoder.encode(answer),
        ]);

        const seed = new Uint8Array(
          await crypto.subtle.digest("SHA-256", combined_reverse)
        );

        const authorizedClaimerKeypair =
          await createKeyPairSignerFromPrivateKeyBytes(seed);
        // const authorizedClaimerKeypair = await generateKeyPairSigner();
        const authorizedClaimer = authorizedClaimerKeypair.address;

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

          const { value: latestBlockhash } = await rpc
            .getLatestBlockhash()
            .send();

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

        const addressEncoder = getAddressEncoder();

        const [userPda] = await getProgramDerivedAddress({
          programAddress: SOLGIFT_PROGRAM_ADDRESS,
          seeds: ["user", addressEncoder.encode(signer.address)],
        });

        const userAccount = await rpc
          .getAccountInfo(userPda, { encoding: "base64" })
          .send();

        if (!userAccount?.value) {
          const initializeUserIx = getInitializeUserInstruction({
            signer: signer,
            user: userPda,
          });
          instructions.push(initializeUserIx);
        } else {
          const rawBytes = getBase64Encoder().encode(userAccount.value.data[0]);
          const view = new DataView(
            rawBytes.buffer,
            rawBytes.byteOffset,
            rawBytes.byteLength
          );
          count = view.getUint16(8, true);
        }

        console.log("userAccount exists:", !!userAccount?.value);
        console.log("count:", count);
        console.log("instruction[0]:", instructions[0]);

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

        const [metadataPda] = await findMetadataPda({ mint: nftMint.address });
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
        // 2. Initialize mint — signer is mint + freeze authority
        const initMintIx = getInitializeMintInstruction({
          mint: nftMint.address,
          decimals: 0,
          mintAuthority: signer.address,
          freezeAuthority: signer.address,
        });

        // 3. Create gift PDA's ATA
        const createAtaIx = await getCreateAssociatedTokenInstructionAsync({
          payer: signer,
          ata: giftNftAta,
          owner: giftPda,
          mint: nftMint.address,
        });

        // 4. Mint exactly 1 token into gift PDA's ATA
        const mintToIx = getMintToInstruction({
          mint: nftMint.address,
          token: giftNftAta,
          mintAuthority: signer,
          amount: 1n,
        });

        // 5. Attach Metaplex metadata — signer still owns mint authority here ✅
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
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
          },
          isMutable: false,
          collectionDetails: null,
        });

        // 6. Revoke mint authority — signer still owns it ✅
        const revokeMintIx = getSetAuthorityInstruction({
          owned: nftMint.address,
          owner: signer,
          authorityType: AuthorityType.MintTokens,
          newAuthority: null,
        });

        // 7. Revoke freeze authority — signer still owns it ✅
        const revokeFreezeIx = getSetAuthorityInstruction({
          owned: nftMint.address,
          owner: signer,
          authorityType: AuthorityType.FreezeAccount,
          newAuthority: null,
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

        const birthdayValue = createGiftData.birthday;

        const birthdayTimestamp: bigint = BigInt(
          Math.floor(new Date(birthdayValue).getTime() / 1000)
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

        // const removeMintAuthority = getSetAuthorityInstruction({
        //   owned: nftMint.address,
        //   owner: signer,
        //   authorityType: AuthorityType.MintTokens,
        //   newAuthority: null,
        // });

        // const freezeAuthorityIx = getSetAuthorityInstruction({
        //   owned: nftMint.address,
        //   owner: signer,
        //   authorityType: AuthorityType.FreezeAccount,
        //   newAuthority: null,
        // });

        // instructions.push(createIx);
        // instructions.push(mintIx);
        // instructions.push(removeMintAuthority);
        // instructions.push(freezeAuthorityIx);
        // instructions.push(fundRecipientIx);
        // instructions.push(createGiftIx);
        instructions.push(createMintAccountIx); // allocate
        instructions.push(initMintIx); // initialize mint, signer = authority
        instructions.push(createAtaIx); // create gift PDA's ATA
        instructions.push(mintToIx); // mint 1 token → supply = 1
        instructions.push(createMetadataIx); // attach metadata, signer still authority ✅
        instructions.push(revokeMintIx); // mint_authority → None ✅
        instructions.push(revokeFreezeIx); // freeze_authority → None
        instructions.push(createGiftIx); // Anchor checks all pass ✅
        instructions.push(fundRecipientIx);

        const sx = await sendAndConfirm({
          instructions,
          payer: signer,
        });

        const asset = await fetchDigitalAsset(rpc, nftMint.address);

        try {
          // Encrypt the security question with (phone + salt) and push it to supabase
          // Assuming `securityQuestion`, `phone`, and `salt` are all defined earlier in the function

          // Helper: simple encryption using window.crypto.subtle with AES-GCM
          // Derive a key from (phone + salt), encrypt the question

          // Do the encryption
          const encryptedSecurityQuestion = await encryptQuestion(
            question,
            phone,
            salt
          );

          // Prepare row for supabase
          const insertData = {
            security_question: encryptedSecurityQuestion,
            created_by: signer.address,
            index: count, // ID field is the u16 used for gift PDA
            gift_pda: giftPda,
            nft_mint: nftMint.address,
          };

          const response = await fetch(
            `/api/v1/users/${signer.address}/gifts`,
            {
              method: "POST",
              body: JSON.stringify(insertData),
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

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
          window.location.href = `/claim/${giftPda}`;
        } catch (error) {
          alert(error);
        }

        console.log("NFT created successfully!");
        console.log("Mint address:", nftMint.address);
        console.log("Signature:", sx);
        console.log("Name:", asset.metadata.name);
        console.log("URI:", asset.metadata.uri);
      } catch (error: any) {
        alert(error);
      }
    } catch (error) {
      alert(error);
      console.log(error);
    }
  };

  return (
    <main
      className={`${spaceMono.className} antialiased bg-amber-400 h-full py-20 px-10 text-black`}
    >
      <form
        onSubmit={handleCreateGift}
        className="max-w-[650px] my-20 mx-auto flex flex-col gap-15 "
      >
        <div
          className="w-full flex flex-col gap-2.5 rounded-[35px] p-10 bg-white border-[6px] border-black shadow-[-5px_5px_0_0_rgba(0,0,0)]"
          // className="w-full flex flex-col gap-2.5 rounded-[35px] p-10 bg-white border-[6px] border-black"
        >
          <fieldset className="mb-[15px] flex w-full flex-col justify-start">
            <UploadImage imageFile={imageFile} setImageFile={setImageFile} />
          </fieldset>

          <fieldset className="mb-[15px] flex w-full flex-col justify-start">
            <label
              className="mb-2.5 block text-[13px] leading-none text-violet12"
              htmlFor="birthday"
            >
              Gift Reveal Date
            </label>
            <DatePickerDemo
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

          <fieldset className="mb-[15px] flex w-full flex-col justify-start">
            <label
              className="mb-2.5 block text-[13px] leading-none text-violet12"
              htmlFor="giftAmount"
            >
              Gift Amount (SOL)
            </label>
            <input
              className="h-[35px] shrink-0 grow rounded px-2.5 text-[15px] leading-none text-violet11 shadow-[0_0_0_1px] shadow-violet7 outline-none focus:shadow-[0_0_0_2px] focus:shadow-violet8"
              id="giftAmount"
              min={0}
              value={createGiftData.giftAmount}
              onChange={handleSetGiftAmount}
              type="number"
              name="giftAmount"
            />
          </fieldset>

          <fieldset className="mb-[15px] flex w-full flex-col justify-start">
            <label
              className="mb-2.5 block text-[13px] leading-none text-violet12"
              htmlFor="nftName"
            >
              Gift Card Text
            </label>
            <input
              className="h-[35px] shrink-0 grow rounded px-2.5 text-[15px] leading-none text-violet11 shadow-[0_0_0_1px] shadow-violet7 outline-none focus:shadow-[0_0_0_2px] focus:shadow-violet8"
              id="nftName"
              type="text"
              name="nftName"
              value={createGiftData.name}
              onChange={handleSetGiftName}
              placeholder="Happy birthday!"
            />
          </fieldset>

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
              value={createGiftData.phone}
              onChange={handleSetRecipientPhone}
              placeholder="1234567890"
              name="phone"
            />
          </fieldset>

          <fieldset className="mb-[15px] flex w-full flex-col justify-start">
            <label
              className="mb-2.5 block text-[13px] leading-none text-violet12"
              htmlFor="question"
            >
              Security Question
            </label>
            <input
              className="h-[35px] shrink-0 grow rounded-lg p-2.5 text-[15px] leading-none text-violet11 shadow-[0_0_0_1px] shadow-violet7 outline-none focus:shadow-[0_0_0_2px] focus:shadow-violet8"
              id="question"
              type="text"
              value={createGiftData.securityQuestion}
              onChange={handleSetSecurityQuestion}
              name="question"
              placeholder="Which city did we first meet in?"
            />
          </fieldset>

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
              value={createGiftData.securityAnswer}
              name="answer"
              placeholder="santacruz"
            />
          </fieldset>
        </div>

        <button
          type="submit"
          className="relative z-2 font-extrabold text-2xl text-black rounded-xl py-4 px-8 bg-sky-400 border-[6px] border-black shadow-[-5px_5px_0_0_rgba(0,0,0)] cursor-pointer transition-all duration-200
          hover:shadow-[-9px_9px_0_0_rgba(0,0,0)] active:shadow-[-5px_5px_0_0_rgba(0,0,0)] active:translate-0
          hover:translate-x-1 hover:-translate-y-1"
        >
          SEND GIFT!
        </button>
      </form>
      {/* <form>
        <HCaptcha
          sitekey="your-sitekey"
          onVerify={(token, ekey) => console.log(token, ekey)}
        />
      </form> */}
    </main>
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
          className="flex h-[400px] w-full mx-auto flex-col justify-center items-center border-2 border-dashed border-gray-400 rounded-3xl p-8 cursor-pointer hover:border-gray-600 transition-colors duration-150 text-gray-700 bg-white"
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
