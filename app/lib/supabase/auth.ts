import { SupabaseClient } from "@supabase/supabase-js";
import {
  address,
  Address,
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createSolanaRpc,
  createTransactionMessage,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { ConnectedWallet } from "@privy-io/react-auth";
import { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";
import { UiWalletAccount } from "@wallet-standard/react";
import {
  useWalletAccountTransactionSendingSigner,
  useWalletAccountTransactionSigner,
} from "@solana/react";
import { useMemo } from "react";
import {
  SolanaCluster,
  useCluster,
  useConnector,
  useConnectorClient,
  WalletConnectorId,
} from "@solana/connector/react";
import {
  ConnectorClient,
  createKitSignersFromWallet,
  createMessageSignerFromWallet,
  createSignableMessage,
} from "@solana/connector/headless";
import { Connection } from "@solana/web3.js";
import { WalletStatus } from "@solana/client";

// type signIntoSupabaseProps = {
//   accountAddress: Address<string> | null;
//   supabase: SupabaseClient<any, "public", "public", any, any>;
//   walletStatus: WalletStatus;
//   connectorId: WalletConnectorId;
//   cluster: SolanaCluster;
//   client: ConnectorClient;
// };

// export async function signIntoSupabase({
//   supabase,
//   walletStatus,
//   connectorId,
//   cluster,
//   client,
//   accountAddress,
// }: signIntoSupabaseProps) {
//   try {
//     const {
//       data: { session },
//     } = await supabase.auth.getSession();

//     // Get the active connector instance (Wallet Standard)
//     const wallet = useMemo(() => {
//       if (!client || !connectorId) return null;
//       return client.getConnector(connectorId);
//     }, [client, connectorId]);

//     // Wallet Standard account (only available when connected)
//     const account =
//       walletStatus.status === "connected"
//         ? walletStatus.session.selectedAccount.account
//         : null;

//     if (!accountAddress) {
//       signOutofSupabase({ supabase });
//       return;
//     }

//     if (session) {
//       const linkedWallet = session.user.user_metadata?.custom_claims
//         ?.address as string | undefined;
//       console.log("LINKED WALLET", linkedWallet);
//       if (linkedWallet !== null && accountAddress !== linkedWallet) {
//         signOutofSupabase({ supabase });
//       }

//       return;
//     }
//     const kitSigners = useMemo(() => {
//       if (!wallet || !account || !cluster || !client) return null;
//       const rpcUrl = client.getRpcUrl();
//       const connection = rpcUrl ? new Connection(rpcUrl) : null;
//       return createKitSignersFromWallet(wallet, account, connection, undefined);
//     }, [wallet, account, cluster, client]);
//     // Use account as the publicKey for signInWithWeb3, if available, to avoid defaulting to Phantom
//     const { error } = await supabase.auth.signInWithWeb3({
//       chain: "solana",
//       statement: "I accept the Terms of Service at https://example.com/tos",
//       wallet: {
//         publicKey: {
//           toBase58: () => accountAddress,
//         },
//         signMessage: async (message: Uint8Array) => {
//           if (!kitSigners || !kitSigners.messageSigner) {
//             throw new Error("Wallet not ready for signing");
//           }
//           const signableMessage = createSignableMessage(message);
//           const signedMessages =
//             await kitSigners.messageSigner.modifyAndSignMessages([
//               signableMessage,
//             ]);
//           // Supabase expects a raw Uint8Array signature, not a signature map.
//           // Assume this wallet produces a single signature for the public key.
//           // signedMessages[0].signatures is an object mapping publicKey -> Uint8Array
//           // Let's return the first signature.
//           const signatureMap = signedMessages[0].signatures;
//           // const values = Object.values(signatureMap);
//           // if (!values.length) {
//           //   throw new Error("No signature returned from wallet");
//           // }
//           return signatureMap[accountAddress];
//         },
//       },
//     });
//     if (error) {
//       throw new Error(error.message);
//     }
//   } catch (error) {
//     console.error(error);
//   }
// }

export async function signIntoSupabaseWithPrivy({
  user,
  wallet,
  supabase,
}: {
  user: any;
  wallet: ConnectedStandardSolanaWallet;
  supabase: SupabaseClient<any, "public", "public", any, any>;
}) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    console.log("HERE WE ARE CALLING SIGN INTO SUPABASE WHY ? WHY PIG");
    console.log(session);
    if (!user) {
      signOutofSupabase({ supabase });
      console.log("SOB");
      return;
    }
    if (session) {
      const supabase_address = session.user.user_metadata?.custom_claims
        ?.address as string | undefined;
      if (supabase_address !== null && wallet.address !== supabase_address) {
        signOutofSupabase({ supabase });
        console.log("SOB");
      }

      return;
    }

    // Custom wallet interface for Supabase signInWithWeb3 (Solana) auth-js v2.99+
    const { error } = await supabase.auth.signInWithWeb3({
      chain: "solana",
      statement: "I accept the Terms of Service at https://example.com/tos",
      wallet: {
        publicKey: {
          toBase58: () => user?.wallet?.address || "",
        },
        signMessage: async (message: Uint8Array) => {
          const { signature } = await wallet.signMessage({ message });
          return signature;
        },
      },
    });
    if (error) {
      throw new Error(error.message);
    } else {
      createUserAccountIfNotExist({
        walletAddress: address(wallet.address),
        supabase,
      });
    }
  } catch (error) {
    console.error(error);
  }
}

type CreateUserAccountIfNotExistProps = {
  walletAddress: Address<string>;
  supabase: SupabaseClient<any, "public", "public", any, any>;
};

export async function createUserAccountIfNotExist({
  walletAddress,
  supabase,
}: CreateUserAccountIfNotExistProps): Promise<{
  name: string;
  avatar: string;
}> {
  // Check if user with this wallet address exists in 'users' table
  const { data: existingUser, error: userFetchError } = await supabase
    .from("users")
    .select("name, avatar, wallet_address")
    .eq("wallet_address", walletAddress)
    .limit(1)
    .maybeSingle();

  if (userFetchError) {
    console.error("Error fetching user:", userFetchError);
    throw new Error("Error fetching user profile");
  }

  if (!existingUser) {
    // Generate random name and avatar
    // Dinosaur avatar ids (5 chars each)
    const dinoAvatars = [
      "trexo",
      "rapto",
      "ankylo",
      "spino",
      "stego",
      "ptera",
      "pachy",
      "dilop",
      "iguan",
    ];
    // Dino-themed random name combinations
    const adjectives = [
      "Bored",
      "Happy",
      "Sneaky",
      "Silly",
      "Lazy",
      "Spooky",
      "Tiny",
      "Wild",
      "Brave",
    ];
    const dinoTypes = [
      "Trexo",
      "Rapto",
      "Ankylo",
      "Spino",
      "Stego",
      "Ptera",
      "Pachy",
      "Dilop",
      "Iguan",
    ];

    function getRandomItem(arr: string[]) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    const randomName =
      getRandomItem(adjectives) + " " + getRandomItem(dinoTypes);
    const randomAvatar = getRandomItem(dinoAvatars);

    const { error: insertError } = await supabase.from("users").insert([
      {
        wallet_address: walletAddress,
        name: randomName,
        avatar: randomAvatar,
      },
    ]);

    if (insertError) {
      console.error("Error creating user:", insertError);
      throw new Error("Error creating user profile");
    }

    return { name: randomName, avatar: randomAvatar };
  } else {
    return { name: existingUser.name, avatar: existingUser.avatar };
  }
}

export async function signOutofSupabase({
  supabase,
}: {
  supabase: SupabaseClient<any, "public", "public", any, any>;
}) {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.log(error, "ERROR while signing out");
  }
}
