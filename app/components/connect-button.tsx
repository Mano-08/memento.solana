"use client";

import {
  useCluster,
  useConnector,
  useConnectorClient,
} from "@solana/connector/react";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/app/components/ui/avatar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { WalletModal } from "./wallet-modal";
import { WalletDropdownContent } from "./wallet-dropdown-content";
import { Wallet, ChevronDown } from "lucide-react";
import { Spinner } from "@/app/components/ui/spinner";
import { cn, truncate } from "@/app/lib/utils";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { createClient } from "../lib/supabase/client";
import {
  createUserAccountIfNotExist,
  signIntoSupabaseWithPrivy,
  signOutofSupabase,
} from "../lib/supabase/auth";
import { Connection } from "@solana/web3.js";
import {
  createKitSignersFromWallet,
  createSignableMessage,
} from "@solana/connector/headless";

interface ConnectButtonProps {
  className?: string;
  text?: string;
  disabled?: boolean;
}

/**
 * Supabase login/wallet sync logic:
 *
 * 1. If there's a Supabase session:
 *    - If a wallet is connected, check the wallet matches the Supabase session's address.
 *      - If not, sign out of Supabase.
 *    - If no wallet, nothing more needed.
 *    => No prompt for login.
 *
 * 2. If there's NO Supabase session:
 *    - If wallet is NOT connected, do nothing (user's not ready to login). No prompt.
 *    - If wallet IS connected, prompt user to login with wallet (show modal).
 *
 * This prevents forcing the user to re-auth if they're already logged in.
 */
export function ConnectButton({
  className,
  text,
  disabled,
}: ConnectButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { ready, user, authenticated } = usePrivy();
  const {
    isConnected,
    isConnecting,
    account,
    connector,
    walletConnectUri,
    clearWalletConnectUri,
  } = useConnector();
  const { walletStatus, connectorId } = useConnector();
  const { cluster } = useCluster();
  const client = useConnectorClient();
  const supabase = createClient();
  const { wallets } = useWallets();

  const [loginPrompted, setLoginPrompted] = useState(false);

  useEffect(() => {
    if (!ready || isConnecting) return;
    let ignore = false;
    if (
      !isConnecting &&
      account &&
      walletStatus.status === "connected" &&
      connectorId &&
      client?.getConnector(connectorId) &&
      cluster
    ) {
      async function handleAuthWalletSync() {
        if (ignore) return;

        const {
          data: { session },
        } = await supabase.auth.getSession();

        // 1. If user is logged into supabase:
        if (session) {
          if (account) {
            const linkedWallet = session.user.user_metadata?.custom_claims
              ?.address as string | undefined;
            if (linkedWallet && account !== linkedWallet) {
              await signOutofSupabase({ supabase });
              console.log("SOB");
            }
          } else {
            await signOutofSupabase({ supabase });
          }
        } else {
          // 2. If user is not logged into supabase:
          if (account) {
            // Only prompt for login with wallet once unless user changes wallet
            if (!loginPrompted) {
              if (connectorId && walletStatus.status === "connected") {
                const wallet = client?.getConnector(connectorId);
                const walletAccount =
                  walletStatus.status === "connected"
                    ? walletStatus.session.selectedAccount.account
                    : null;

                if (wallet && walletAccount && cluster && client) {
                  const rpcUrl = client.getRpcUrl();
                  const connection = rpcUrl ? new Connection(rpcUrl) : null;
                  const kitSigners = createKitSignersFromWallet(
                    wallet,
                    walletAccount,
                    connection,
                    undefined
                  );

                  while (true) {
                    const {
                      data: { session: currentSession },
                    } = await supabase.auth.getSession();

                    if (currentSession) {
                      break;
                    }

                    try {
                      const { error } = await supabase.auth.signInWithWeb3({
                        chain: "solana",
                        statement:
                          "I accept the terms and conditions at memento.vercel.app/terms",
                        wallet: {
                          publicKey: {
                            toBase58: () => account,
                          },
                          signMessage: async (message: Uint8Array) => {
                            if (!kitSigners || !kitSigners.messageSigner) {
                              throw new Error("Wallet not ready for signing");
                            }
                            const signableMessage =
                              createSignableMessage(message);
                            const signedMessages =
                              await kitSigners.messageSigner.modifyAndSignMessages(
                                [signableMessage]
                              );
                            const signatureMap = signedMessages[0].signatures;
                            return signatureMap[account];
                          },
                        },
                      });
                      const {
                        data: { session: newSession },
                      } = await supabase.auth.getSession();

                      if (newSession) {
                        break;
                      }

                      if (error) {
                        await new Promise((resolve) =>
                          setTimeout(resolve, 3000)
                        );
                      }
                    } catch (error) {
                      // If wallet is disconnected or a different wallet is connected, exit the loop
                      if (!account || account !== kitSigners.address) {
                        break;
                      }

                      await new Promise((resolve) => setTimeout(resolve, 3000));
                    }
                  }
                  setLoginPrompted(true);
                  await createUserAccountIfNotExist({
                    walletAddress: account,
                    supabase,
                  });
                }
              }
            }
          } else {
            // If no wallet is connected, don't prompt for login nor try to log the user in.
            setLoginPrompted(false); // allow future prompt once wallet connects
          }
        }
      }

      handleAuthWalletSync();
    } else if (ready && user && wallets.length) {
      async function handleAuthWalletSync() {
        if (ignore) return;

        const {
          data: { session },
        } = await supabase.auth.getSession();

        // 1. If user is logged into supabase:
        if (session) {
          if (user) {
            const linkedWallet = session.user.user_metadata?.custom_claims
              ?.address as string | undefined;
            if (linkedWallet && user?.wallet?.address !== linkedWallet) {
              await signOutofSupabase({ supabase });
              console.log("SOB");
            }
          } else {
            await signOutofSupabase({ supabase });
            console.log("SOB");
          }
        } else {
          // 2. If user is not logged into supabase:
          if (user && wallets.length) {
            // No need for useMemo here; this runs once per effect execution after wallets/user change.
            const privyWallet = wallets.find(
              (w) => w.standardWallet?.name === "Privy"
            );

            if (privyWallet) {
              // Repeatedly prompt until user signs in or operation succeeds,
              // keeps checking auth status
              while (true) {
                const {
                  data: { session: currentSession },
                } = await supabase.auth.getSession();

                if (currentSession) {
                  break;
                }

                try {
                  await signIntoSupabaseWithPrivy({
                    supabase,
                    wallet: privyWallet,
                    user,
                  });
                  const {
                    data: { session: newSession },
                  } = await supabase.auth.getSession();
                  if (newSession) break;
                } catch (e) {
                  await new Promise((resolve) => setTimeout(resolve, 3000));
                }
              }
              setLoginPrompted(true);
              return;
            }
          } else {
            // If no wallet is connected, don't prompt for login nor try to log the user in.
            setLoginPrompted(false); // allow future prompt once wallet connects
          }
        }
      }

      handleAuthWalletSync();
    }
    // Reset loginPrompted if wallet/account changes
    return () => {
      ignore = true;
    };
  }, [
    account,
    user, // privy
    wallets, // privy
    walletStatus, // ext wallet
    connectorId, // ext wallet
    client, // ext wallet
    cluster, // ext wallet
    isConnecting, // ext wallet
    ready, // privy
  ]);

  // Reset loginPrompted if wallet/account changes (new wallet connection/new session)
  useEffect(() => {
    setLoginPrompted(false);
  }, [account, user]);

  const connectedToExternalWallet = useMemo(
    () => !isConnecting && isConnected && account && connector,
    [isConnecting, isConnected, account, connector]
  );
  const connectedToEmbeddedWallet = useMemo(
    () => ready && user && authenticated,
    [ready, user, authenticated]
  );
  const [protectedRoute, setProtectedRoute] = useState(false);
  const handleOnOpenChangeWallet = useCallback(
    (open: boolean) => {
      // if (
      //   !connectedToExternalWallet &&
      //   !connectedToEmbeddedWallet &&
      //   isModalOpen &&
      //   protectedRoute
      // ) {
      //   setIsModalOpen(true);
      //   return;
      // }

      setIsModalOpen(open);
      if (!open) {
        clearWalletConnectUri();
      }
    },
    [
      // connectedToExternalWallet,
      // connectedToEmbeddedWallet,
      // isModalOpen,
      // protectedRoute,
      clearWalletConnectUri,
      // setIsModalOpen,
    ]
  );
  useEffect(() => {
    // Only run on client after mount, so window is defined
    if (typeof window !== "undefined") {
      setProtectedRoute(
        ["/dashboard", "/create"].includes(window.location.pathname)
      );
    }
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (
        (path === "/dashboard" || path === "/create") &&
        !connectedToExternalWallet &&
        !connectedToEmbeddedWallet
      ) {
        setIsModalOpen(true);
      } else {
        setIsModalOpen(false);
      }
    }
  }, [connectedToEmbeddedWallet, connectedToExternalWallet]);

  if (connectedToExternalWallet || connectedToEmbeddedWallet) {
    const shortAddress = account
      ? truncate(account)
      : truncate(user?.wallet?.address || "");
    const walletIcon = connector?.icon || undefined;

    return (
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={cn("gap-2")}>
            <Avatar className="h-5 w-5">
              {walletIcon && (
                <AvatarImage
                  src={walletIcon}
                  alt={connector?.name || "privy icon"}
                />
              )}
              <AvatarFallback>
                <Wallet className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <span className="text-xs lg:block hidden">{shortAddress}</span>
            <motion.div
              animate={{ rotate: isDropdownOpen ? -180 : 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <ChevronDown className="h-4 w-4 opacity-50" />
            </motion.div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="bottom"
          className="p-0 rounded-[20px]"
        >
          <WalletDropdownContent
            selectedAccount={account || user?.wallet?.address || "Privy"}
            walletIcon={walletIcon}
            walletName={connector?.name || "Privy"}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  } else {
    // Show loading button when connecting (but modal stays rendered)
    const buttonContent = isConnecting ? (
      <>
        <Spinner className="h-4 w-4" />
        <span className="text-xs">Connecting...</span>
      </>
    ) : text ? (
      text
    ) : (
      "Connect Wallet"
    );

    return (
      <>
        <button
          onClick={() => setIsModalOpen(true)}
          className={cn(
            disabled ? "cursor-not-allowed" : "cursor-pointer",
            className
          )}
          disabled={disabled}
        >
          {buttonContent}
        </button>
        <WalletModal
          open={isModalOpen}
          onOpenChange={handleOnOpenChangeWallet}
          walletConnectUri={walletConnectUri}
          onClearWalletConnectUri={clearWalletConnectUri}
        />
      </>
    );
  }
}
