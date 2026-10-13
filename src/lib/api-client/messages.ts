/**
 * apiClient.messages — Messaging API calls.
 */
import { get, post, patch } from "./http";
import type { HttpOptions } from "./http";

export interface SendMessagePayload {
  receiverId?: string | undefined;
  dealId?: string | undefined;
  content: string;
  contentType?: string | undefined;
  messageType?: string | undefined;
  fileUrl?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  attachments?: string[] | undefined;
  replyToMessageId?: string | undefined;
  [key: string]: unknown;
}

export interface MessageListParams {
  dealId?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
  with?: string | undefined;
  [key: string]: string | number | undefined;
}

/** GET /api/messages — list messages with optional filters */
export function list(params: MessageListParams = {}, options?: HttpOptions) {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return get(`/api/messages${qs ? `?${qs}` : ""}`, options);
}

/** POST /api/messages — send a new message */
export function send(payload: SendMessagePayload, options?: HttpOptions) {
  return post("/api/messages", payload, options);
}

/** PATCH /api/messages — update typing presence */
export function setTyping(
  data: { dealId?: string; with?: string; isTyping: boolean },
  options?: HttpOptions,
) {
  return patch("/api/messages", data, options);
}

