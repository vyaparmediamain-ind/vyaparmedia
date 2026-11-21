import { EventEmitter } from "node:events";
import { logger } from "./logger";
import { redis } from "./redis";

export interface RealtimeMessageEvent {
  type: "message";
  recipientId: string;
  senderId: string;
  message: {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    messageType?: string | undefined;
    fileUrl?: string | null | undefined;
    dealId?: string | null | undefined;
    metadata?: unknown;
    createdAt: string;
    isBlocked?: boolean | undefined;
    hasWarning?: boolean | undefined;
    sender?: {
      id: string;
      email?: string;
      name?: string | null;
      userType?: string;
      image?: string | null;
    } | undefined;
  };
}

export interface RealtimeTypingEvent {
  type: "typing";
  recipientId: string;
  senderId: string;
  dealId?: string | null;
  isTyping: boolean;
}

export type MessagingStreamEvent = RealtimeMessageEvent | RealtimeTypingEvent;

class MessagingEventBus extends EventEmitter {
  constructor() {
    super();
    // Allow many concurrent active stream connections without Node memory leak warning
    this.setMaxListeners(1000);
  }
}

const globalForMessaging = globalThis as unknown as { messagingBus?: MessagingEventBus };
export const messagingBus = globalForMessaging.messagingBus || new MessagingEventBus();
if (!globalForMessaging.messagingBus) {
  globalForMessaging.messagingBus = messagingBus;
}

const REDIS_MESSAGING_CHANNEL = "vyapar:messages:stream";

interface RedisWithPublish {
  publish?(channel: string, message: string): Promise<number>;
}

/**
 * Publish a new message event to the recipient's SSE stream.
 */
export async function publishMessageToRecipient(
  recipientId: string,
  senderId: string,
  message: RealtimeMessageEvent["message"]
): Promise<void> {
  const event: RealtimeMessageEvent = {
    type: "message",
    recipientId,
    senderId,
    message,
  };

  // Local dispatch
  messagingBus.emit(`user:${recipientId}`, event);

  // Cross-worker Redis publish (fails gracefully if Redis offline)
  try {
    const publisher = redis as unknown as RedisWithPublish;
    if (typeof publisher.publish === "function") {
      await publisher.publish(REDIS_MESSAGING_CHANNEL, JSON.stringify(event));
    }
  } catch (err) {
    logger.debug("Redis publish for realtime message stream failed", { error: err });
  }
}

/**
 * Publish a typing presence update to the recipient's SSE stream.
 */
export async function publishTypingToRecipient(
  recipientId: string,
  senderId: string,
  isTyping: boolean,
  dealId?: string | null
): Promise<void> {
  const event: RealtimeTypingEvent = {
    type: "typing",
    recipientId,
    senderId,
    isTyping,
    ...(dealId ? { dealId } : {}),
  };

  // Local dispatch
  messagingBus.emit(`user:${recipientId}`, event);

  // Cross-worker Redis publish
  try {
    const publisher = redis as unknown as RedisWithPublish;
    if (typeof publisher.publish === "function") {
      await publisher.publish(REDIS_MESSAGING_CHANNEL, JSON.stringify(event));
    }
  } catch (err) {
    logger.debug("Redis publish for realtime typing presence failed", { error: err });
  }
}
