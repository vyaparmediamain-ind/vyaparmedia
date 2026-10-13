import { createClient, RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseRealtimeClient(): SupabaseClient | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return supabaseClient;
  } catch (err) {
    console.warn("[Realtime] Failed to initialize Supabase Realtime client:", err);
    return null;
  }
}

export interface DealRealtimePayload {
  id: string;
  status: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * Subscribes to postgres_changes on the Deal row.
 * Returns an unsubscribe teardown function.
 */
export function subscribeToDealUpdates(
  dealId: string,
  onUpdate: (payload: DealRealtimePayload) => void
): () => void {
  const client = getSupabaseRealtimeClient();
  if (!client) {
    return () => {};
  }

  const channelName = `deal-channel-${dealId}`;
  let channel: RealtimeChannel | null = null;

  try {
    channel = client
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "Deal",
          filter: `id=eq.${dealId}`,
        },
        (payload) => {
          if (payload?.new && typeof payload.new === "object") {
            onUpdate(payload.new as DealRealtimePayload);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Connected successfully
        }
      });
  } catch (err) {
    console.warn("[Realtime] Error subscribing to deal channel:", err);
  }

    return () => {
      if (channel && client) {
        client.removeChannel(channel);
      }
    };
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

  /**
   * Subscribes to postgres_changes on the Wallet row for a specific user.
   * Returns an unsubscribe teardown function.
   */
  export function subscribeToWalletUpdates(
    userId: string,
    onUpdate: (payload: WalletRealtimePayload) => void,
  ): () => void {
    const client = getSupabaseRealtimeClient();
    if (!client) {
      return () => {};
    }

    const channelName = `wallet-channel-${userId}`;
    let channel: RealtimeChannel | null = null;

    try {
      channel = client
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "Wallet",
            filter: `userId=eq.${userId}`,
          },
          (payload) => {
            if (payload?.new && typeof payload.new === "object") {
              onUpdate(payload.new as WalletRealtimePayload);
            }
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            // Connected successfully
          }
        });
    } catch (err) {
      console.warn("[Realtime] Error subscribing to wallet channel:", err);
    }

    return () => {
      if (channel && client) {
        client.removeChannel(channel);
      }
    };
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
 * Subscribes to postgres_changes on the Notification table for a specific user.
 * Catches INSERT, UPDATE, and DELETE.
 * Returns an unsubscribe teardown function.
 */
export function subscribeToNotificationUpdates(
  userId: string,
  onEvent: (event: NotificationRealtimeEvent) => void
): () => void {
  const client = getSupabaseRealtimeClient();
  if (!client) {
    return () => {};
  }

  const channelName = `notification-channel-${userId}`;
  let channel: RealtimeChannel | null = null;

  try {
    channel = client
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "Notification",
          filter: `userId=eq.${userId}`,
        },
        (payload) => {
          if (!payload) return;
          const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
          onEvent({
            eventType,
            new: payload.new ? (payload.new as NotificationRealtimePayload) : undefined,
            old: payload.old ? (payload.old as { id: string }) : undefined,
          });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Connected successfully
        }
      });
  } catch (err) {
    console.warn("[Realtime] Error subscribing to notification channel:", err);
  }

  return () => {
    if (channel && client) {
      client.removeChannel(channel);
    }
  };
}
