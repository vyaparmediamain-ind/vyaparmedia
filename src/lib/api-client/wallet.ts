/**
 * apiClient.wallet — All wallet & payment API calls.
 */
import { get, post, put, del } from "./http";
import type { HttpOptions } from "./http";
import {
  walletResponseSchema,
  walletTransactionsResponseSchema,
  bankAccountsResponseSchema,
  withdrawResponseSchema,
  type WalletResponse,
  type WalletTransactionsResponse,
  type BankAccountsResponse,
  type WithdrawResponse,
  type WithdrawInput,
  type BankAccountInput,
  type AddFundsVerifyInput,
} from "@/lib/schemas";

export type AddFundsVerifyPayload = AddFundsVerifyInput;
export type WithdrawPayload = WithdrawInput;
export type BankAccountPayload = BankAccountInput;

export interface TransactionListParams {
  limit?: number;
  page?: number;
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  [key: string]: string | number | undefined;
}

/** GET /api/wallet — wallet balance summary (validated against walletResponseSchema) */
export function getSummary(options?: HttpOptions): Promise<WalletResponse> {
  return get<WalletResponse>("/api/wallet", { schema: walletResponseSchema, ...options });
}

/** GET /api/wallet/transactions (validated against walletTransactionsResponseSchema) */
export function getTransactions(
  params: TransactionListParams = {},
  options?: HttpOptions,
): Promise<WalletTransactionsResponse> {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return get<WalletTransactionsResponse>(
    `/api/wallet/transactions${qs ? `?${qs}` : ""}`,
    { schema: walletTransactionsResponseSchema, ...options },
  );
}

/** GET /api/wallet/transactions?format=csv — download CSV statement as Blob */
export function exportTransactionsCsv(
  params: { startDate?: string; endDate?: string; type?: string } = {},
  options?: HttpOptions,
): Promise<Blob> {
  const qs = new URLSearchParams({ format: "csv" });
  if (params.startDate) qs.set("startDate", params.startDate);
  if (params.endDate) qs.set("endDate", params.endDate);
  if (params.type && params.type !== "ALL") qs.set("type", params.type);
  return get<Blob>(`/api/wallet/transactions?${qs.toString()}`, {
    responseType: "blob",
    ...options,
  });
}

/** POST /api/wallet/add-funds — create Razorpay order.
 *  @param amountPaise  Amount in paise (e.g. 10000 for ₹100).
 *  @param idempotencyKey  Caller-supplied key; must be 16-128 chars matching [A-Za-z0-9:_-].
 */
export function addFunds(amountPaise: number, idempotencyKey: string, options?: HttpOptions) {
  return post(
    "/api/wallet/add-funds",
    { amount: amountPaise, amountPaise },
    {
      ...options,
      headers: {
        ...(options?.headers as Record<string, string> | undefined),
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

/** POST /api/wallet/add-funds/verify — verify Razorpay payment */
export function verifyPayment(
  payload: AddFundsVerifyPayload,
  options?: HttpOptions,
) {
  return post("/api/wallet/add-funds/verify", payload, options);
}

/** POST /api/payments/withdraw (validated against withdrawResponseSchema) */
export function withdraw(payload: WithdrawPayload, options?: HttpOptions): Promise<WithdrawResponse> {
  return post<WithdrawResponse>("/api/payments/withdraw", payload, { schema: withdrawResponseSchema, ...options });
}

/** GET /api/wallet/bank-accounts (validated against bankAccountsResponseSchema) */
export function listBankAccounts(options?: HttpOptions): Promise<BankAccountsResponse> {
  return get<BankAccountsResponse>("/api/wallet/bank-accounts", { schema: bankAccountsResponseSchema, ...options });
}

/** POST /api/wallet/bank-accounts — add a new bank account / UPI */
export function addBankAccount(
  payload: BankAccountPayload,
  options?: HttpOptions,
) {
  return post("/api/wallet/bank-accounts", payload, options);
}

/** PUT /api/wallet/bank-accounts?id=:id — set as default */
export function setDefaultAccount(id: string, options?: HttpOptions) {
  return put(
    `/api/wallet/bank-accounts?id=${encodeURIComponent(id)}`,
    undefined,
    options,
  );
}

/** DELETE /api/wallet/bank-accounts?id=:id */
export function deleteBankAccount(id: string, options?: HttpOptions) {
  return del(
    `/api/wallet/bank-accounts?id=${encodeURIComponent(id)}`,
    options,
  );
}

/** POST /api/wallet/bank-accounts/verify — initiate penny-drop verification */
export function verifyBankAccount(
  bankAccountId: string,
  options?: HttpOptions,
) {
  return post("/api/wallet/bank-accounts/verify", { bankAccountId }, options);
}


