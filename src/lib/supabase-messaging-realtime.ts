import { getSupabaseRealtimeClient } from "./supabase-realtime";
import { RealtimeChannel } from "@supabase/supabase-js";

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
 * Subscribes to new incoming messages for the logged-in user in real-time.
 */
export function subscribeToIncomingMessages(
  userId: string,
  onMessage: (message: RealtimeMessagePayload) => void
): () => void {
  const client = getSupabaseRealtimeClient();
  if (!client) {
    return () => {};
  }

  const channelName = `user-messages-${userId}`;
  let channel: RealtimeChannel | null = null;

  try {
    channel = client
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Message",
          filter: `receiverId=eq.${userId}`,
        },
        (payload) => {
          if (payload?.new && typeof payload.new === "object") {
            onMessage(payload.new as RealtimeMessagePayload);
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.warn("[RealtimeMessages] Subscription error:", err);
  }

  return () => {
    if (channel && client) {
      client.removeChannel(channel);
    }
  };
}

/**
 * Subscribes to typing broadcast presence between two users.
 */
export function subscribeToTypingPresence(
  conversationKey: string,
  onTyping: (isTyping: boolean) => void
): {
  broadcastTyping: (isTyping: boolean) => void;
  unsubscribe: () => void;
} {
  const client = getSupabaseRealtimeClient();
  if (!client) {
    return {
      broadcastTyping: () => {},
      unsubscribe: () => {},
    };
  }

  const channelName = `typing-${conversationKey}`;
  let channel: RealtimeChannel | null = null;

  try {
    channel = client
      .channel(channelName)
      .on("broadcast", { event: "typing" }, (event) => {
        if (event?.payload && typeof event.payload.isTyping === "boolean") {
          onTyping(event.payload.isTyping);
        }
      })
      .subscribe();
  } catch (err) {
    console.warn("[RealtimeTyping] Subscription error:", err);
  }

  const broadcastTyping = (isTyping: boolean) => {
    if (channel) {
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: { isTyping },
      });
    }
  };

  const unsubscribe = () => {
    if (channel && client) {
      client.removeChannel(channel);
    }
  };

  return { broadcastTyping, unsubscribe };
}
