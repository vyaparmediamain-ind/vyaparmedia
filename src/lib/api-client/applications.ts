/**
 * apiClient.applications — Campaign application API calls.
 */
import { get, post } from "./http";
import type { HttpOptions } from "./http";

export interface ApplyPayload {
  campaignId: string;
  proposal: string;
  proposedRate: number;
}

export interface ApplicationListParams {
  campaignId?: string;
  page?: number;
  limit?: number;
  status?: string;
  [key: string]: string | number | undefined;
}

/** GET /api/applications — list applications with optional filters */
export function list(
  params: ApplicationListParams = {},
  options?: HttpOptions,
) {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return get(`/api/applications${qs ? `?${qs}` : ""}`, options);
}

/** POST /api/applications — submit a new campaign application */
export function apply(payload: ApplyPayload, options?: HttpOptions) {
  return post("/api/applications", payload, options);
}

/** POST /api/applications/:id/accept | reject */
export function action(
  applicationId: string,
  act: "accept" | "reject",
  extraBody?: Record<string, unknown>,
  options?: HttpOptions,
) {
  return act === "accept"
    ? accept(applicationId, extraBody, options)
    : reject(applicationId, extraBody, options);
}

/** POST /api/applications/:id/accept */
export function accept(
  applicationId: string,
  extraBody?: Record<string, unknown>,
  options?: HttpOptions,
) {
  return post(
    `/api/applications/${encodeURIComponent(applicationId)}/accept`,
    extraBody,
    options,
  );
}

/** POST /api/applications/:id/reject */
export function reject(
  applicationId: string,
  extraBody?: Record<string, unknown>,
  options?: HttpOptions,
) {
  return post(
    `/api/applications/${encodeURIComponent(applicationId)}/reject`,
    extraBody,
    options,
  );
}
