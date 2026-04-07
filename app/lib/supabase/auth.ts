import { SupabaseClient } from "@supabase/supabase-js";
import { Address } from "@solana/kit";
import { ConnectedWallet } from "@privy-io/react-auth";
import { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";

type signIntoSupabaseProps = {
  account: null | Address<string>;
  supabase: SupabaseClient<any, "public", "public", any, any>;
};

export async function signIntoSupabase({
  account,
  supabase,
}: signIntoSupabaseProps) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!account) {
      signOutofSupabase({ supabase });
      return;
    }
    if (session) {
      const linkedWallet = session.user.user_metadata?.custom_claims
        ?.address as string | undefined;
      if (linkedWallet !== null && account !== linkedWallet) {
        signOutofSupabase({ supabase });
      }

      return;
    }
    const { error } = await supabase.auth.signInWithWeb3({
      chain: "solana",
      statement: "I accept the Terms of Service at https://example.com/tos",
    });
    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error(error);
  }
}

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

    if (!user) {
      signOutofSupabase({ supabase });
      return;
    }
    if (session) {
      const supabase_address = session.user.user_metadata?.custom_claims
        ?.address as string | undefined;
      if (supabase_address !== null && wallet.address !== supabase_address) {
        signOutofSupabase({ supabase });
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
    }
  } catch (error) {
    console.error(error);
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
