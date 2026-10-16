/**
 * Realtime & State Synchronization Architecture (Option A: Polling & SWR)
 * 
 * ARCHITECTURE DECISION (TP-01 & TP-09):
 * Direct Supabase client-side postgres_changes subscriptions using an unauthenticated
 * anon key are intentionally disabled. Because VyaparMedia authenticates users via NextAuth
 * sessions (PostgreSQL-backed cookies), Supabase Realtime connections have `auth.uid() = NULL`,
 * which correctly triggers RLS blocking (defense-in-depth).
 *
 * Instead of exposing the Supabase anon key or adding complex JWT minting layers,
 * all dashboard interfaces (Deals, Wallet, Messages, Notifications) use secure,
 * visibility-aware SWR polling and reconciliation hooks.
 * 
 * This file maintains backward-compatible typed signatures for any legacy consumers.
 */

export interface DealRealtimePayload {
  id: string;
  status: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface WalletRealtimePayload {
  id?: string;
  userId?: string;
  balance?: number;
  pendingBalance?: number;
  totalEarned?: number;
  totalWithdrawn?: number;
  totalSpent?: number;
  totalDeposited?: number;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface NotificationRealtimePayload {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface NotificationRealtimeEvent {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new?: NotificationRealtimePayload | undefined;
  old?: { id: string; [key: string]: unknown } | undefined;
}

/**
 * Client stub for backwards compatibility. Always returns null under Option A.
 */
export function getSupabaseRealtimeClient(): null {
  return null;
}

/**
 * Deal updates are handled via visibility-aware polling in `useDealRealtime.ts` (2s interval).
 */
export function subscribeToDealUpdates(
  _dealId: string,
  _onUpdate: (payload: DealRealtimePayload) => void
): () => void {
  return () => {};
}

/**
 * Wallet updates are handled via SWR cache revalidation on focus in `useWallet.ts`.
 */
export function subscribeToWalletUpdates(
  _userId: string,
  _onUpdate: (payload: WalletRealtimePayload) => void
): () => void {
  return () => {};
}

/**
 * Notifications are synchronized via online/visibilitychange listeners and SWR in `useNotificationCenter.ts`.
 */
export function subscribeToNotificationUpdates(
  _userId: string,
  _onEvent: (event: NotificationRealtimeEvent) => void
): () => void {
  return () => {};
}
