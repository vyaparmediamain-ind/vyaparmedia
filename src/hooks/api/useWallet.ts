"use client";

/**
 * useWallet — SWR hook for wallet balance summary + realtime updates.
 *
 * Wraps GET /api/wallet with:
 * - Schema validation via walletResponseSchema
 * - Realtime update subscription (Supabase)
 * - Stable mutate ref for use in effects
 */
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useCallback, useEffect } from "react";
import { createSchemaFetcher } from "@/lib/fetcher";
import { walletResponseSchema, type WalletResponse, type WalletSummary } from "@/lib/schemas";
import { subscribeToWalletUpdates } from "@/lib/supabase-realtime";

const walletFetcher = createSchemaFetcher(walletResponseSchema);

export interface UseWalletResult {
  walletData: WalletSummary | null;
  userType: string | null;
  isLoading: boolean;
  error: Error | undefined;
  refresh: () => Promise<WalletResponse | undefined>;
  isReady: boolean;
}

export function useWallet(enableRealtime = false): UseWalletResult {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;

  const { data: walletResponse, isLoading, error, mutate } = useSWR<WalletResponse>(
    userId ? "/api/wallet" : null,
    walletFetcher,
    { revalidateOnFocus: true, revalidateIfStale: false },
  );

  // Realtime subscription — opt-in per usage site
  useEffect(() => {
    if (!enableRealtime || !userId) return;
    const unsub = subscribeToWalletUpdates(userId, () => {
      mutate();
    });
    return () => unsub();
  }, [enableRealtime, userId, mutate]);

  const walletData: WalletSummary | null = walletResponse
    ? (() => {
        const raw = walletResponse.wallet ?? walletResponse.data;
        if (!raw) return null;
        return {
          id: raw.id,
          balance: Number(raw.balance ?? 0),
          pendingBalance: Number(raw.pendingBalance ?? 0),
          totalEarned: Number(raw.totalEarned ?? 0),
          totalWithdrawn: Number(raw.totalWithdrawn ?? 0),
          totalHeld: Number(raw.totalHeld ?? 0),
          totalSpent: Number(raw.totalSpent ?? 0),
          totalDeposited: Number(raw.totalDeposited ?? 0),
          isFrozen: Boolean(raw.isFrozen),
        };
      })()
    : null;

  const userType =
    walletResponse?.userType ?? session?.user?.userType ?? null;

  const refresh = useCallback(() => mutate(), [mutate]);

  return {
    walletData,
    userType,
    isLoading,
    error,
    refresh,
    isReady: !isLoading && walletResponse !== undefined,
  };
}
