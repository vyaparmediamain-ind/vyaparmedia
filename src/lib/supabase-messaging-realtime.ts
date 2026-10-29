/**
 * Realtime Messaging Layer (Option A: Polling & SWR Architecture)
 * 
 * ARCHITECTURE NOTE:
 * Direct Supabase Realtime message subscriptions are disabled in favor of:
 * 1. 2.5s Adaptive visibility-aware polling in `useMessages.ts` for chat delivery.
 * 2. Dedicated Redis ephemeral typing indicators via `/api/messages/typing`.
 *
 * This eliminates anon-key exposure, unauthenticated websocket attempts, and RLS blocking.
 */

export interface RealtimeMessagePayload {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  messageType?: string;
  fileUrl?: string | null;
  dealId?: string | null;
  metadata?: Record<string, unknown> | null;
  isRead?: boolean;
}

/**
 * Incoming messages are synchronized via visibility-aware polling in `useMessages.ts`.
 */
export function subscribeToIncomingMessages(
  _userId: string,
  _onMessage: (message: RealtimeMessagePayload) => void
): () => void {
  return () => {};
}

/**
 * Typing presence interface stub maintaining API compatibility.
 */
export function subscribeToTypingPresence(
  _conversationKey: string,
  _onTyping: (isTyping: boolean) => void
): {
  broadcastTyping: (isTyping: boolean) => void;
  unsubscribe: () => void;
} {
  return {
    broadcastTyping: () => {},
    unsubscribe: () => {},
  };
}
