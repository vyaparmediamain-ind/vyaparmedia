/**
 * apiClient — Centralized, typed HTTP client for all frontend API calls.
 *
 * Import and use as:
 *   import { apiClient } from "@/lib/api-client";
 *   const deal = await apiClient.deals.getById(id);
 *
 * Or import domain namespaces individually:
 *   import * as dealsApi from "@/lib/api-client/deals";
 *
 * All functions throw ApiClientError on non-ok responses.
 * 401 responses globally trigger signOut + redirect to /login.
 */

export { ApiClientError } from "./errors";
export type { HttpOptions, RetryConfig } from "./http";

import * as deals from "./deals";
import * as campaigns from "./campaigns";
import * as wallet from "./wallet";
import * as applications from "./applications";
import * as users from "./users";
import * as messages from "./messages";
import * as settings from "./settings";
import * as upload from "./upload";
import * as auth from "./auth";

export const apiClient = {
  deals,
  campaigns,
  wallet,
  applications,
  users,
  messages,
  settings,
  upload,
  auth,
} as const;

