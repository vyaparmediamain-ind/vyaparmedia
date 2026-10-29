/**
 * apiClient.deals — All deal-related API calls.
 */
import { post, get } from "./http";
import type { HttpOptions } from "./http";
import {
  dealsListResponseSchema,
  singleDealResponseSchema,
  type DealsListResponse,
  type SingleDealResponse,
} from "@/lib/schemas";

export interface DealActionPayload {
  action: string;
  dealId: string;
  [key: string]: unknown;
}

export interface SubmitContentPayload {
  contentUrl?: string;
  notes?: string;
  postUrl?: string;
  itemizedUrls?: Record<string, string>;
  reviews?: Array<{ type: string; status: string; feedback: string }>;
  approved?: boolean;
  feedback?: string;
}

/** GET /api/deals — list deals with optional status/page filters (validated against dealsListResponseSchema) */
export function list(
  params: Record<string, string | number> = {},
  options?: HttpOptions,
): Promise<DealsListResponse> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  return get<DealsListResponse>(`/api/deals${qs ? `?${qs}` : ""}`, {
    schema: dealsListResponseSchema,
    ...options,
  });
}

/** GET /api/deals/:id (validated against singleDealResponseSchema) */
export function getById<T = SingleDealResponse>(id: string, options?: HttpOptions): Promise<T> {
  return get<T>(`/api/deals/${encodeURIComponent(id)}`, {
    schema: singleDealResponseSchema,
    ...options,
  });
}


/** POST /api/deals — generic action dispatch (submit_content, release_payment, etc.) */
export function action(
  payload: DealActionPayload,
  options?: HttpOptions,
) {
  return post("/api/deals", payload, options);
}

/** POST /api/deals/:id/sign */
export function sign(id: string, options?: HttpOptions) {
  return post(`/api/deals/${encodeURIComponent(id)}/sign`, undefined, options);
}

/** POST /api/deals/:id/reject */
export function reject(
  id: string,
  reason: string,
  options?: HttpOptions,
) {
  return post(
    `/api/deals/${encodeURIComponent(id)}/reject`,
    { reason },
    options,
  );
}

/** POST /api/deals/:id/cancel */
export function cancel(id: string, options?: HttpOptions) {
  return post(`/api/deals/${encodeURIComponent(id)}/cancel`, undefined, options);
}

/** POST /api/deals/:id/product */
export function updateProduct(
  id: string,
  payload: Record<string, unknown>,
  options?: HttpOptions,
) {
  return post(`/api/deals/${encodeURIComponent(id)}/product`, payload, options);
}

/** GET /api/deals/:id/engagement */
export function getEngagement(id: string, options?: HttpOptions) {
  return get(`/api/deals/${encodeURIComponent(id)}/engagement`, options);
}

/** POST /api/deals/:id/fund — initialize Razorpay Route escrow payment */
export function fund(id: string, options?: HttpOptions): Promise<{
  success: boolean;
  orderId: string;
  amount: number;
  currency: string;
  key: string;
  creatorAccountId?: string;
}> {
  return post(`/api/deals/${encodeURIComponent(id)}/fund`, {}, options);
}
