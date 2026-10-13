import { z } from "zod";

/**
 * Standardized Wallet Summary schema.
 * All monetary amounts are integers in paise.
 */
export const walletSummarySchema = z.object({
  id: z.string().optional(),
  balance: z.number().int().default(0),
  pendingBalance: z.number().int().default(0),
  totalEarned: z.number().int().default(0),
  totalWithdrawn: z.number().int().default(0),
  totalHeld: z.number().int().default(0),
  totalSpent: z.number().int().default(0),
  totalDeposited: z.number().int().default(0),
  isFrozen: z.boolean().default(false),
});

export type WalletSummary = z.infer<typeof walletSummarySchema>;

/**
 * GET /api/wallet response envelope schema.
 */
export const walletResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  userType: z.string().optional(),
  wallet: walletSummarySchema.optional(),
  data: walletSummarySchema.optional(),
});

export type WalletResponse = z.infer<typeof walletResponseSchema>;

/**
 * Standardized Wallet Transaction Item schema.
 * Amount is in integer paise.
 */
export const walletTransactionItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  amount: z.number().int(), // in paise
  status: z.string(),
  description: z.string().nullable().optional(),
  createdAt: z.union([z.string(), z.date()]).transform((val) =>
    typeof val === "string" ? val : val.toISOString()
  ),
  razorpayPaymentId: z.string().nullable().optional(),
  dealId: z.string().nullable().optional(),
  withdrawalId: z.string().nullable().optional(),
});

export type WalletTransactionItem = z.infer<typeof walletTransactionItemSchema>;

/**
 * Standardized Transactions Response schema for GET /api/wallet/transactions.
 */
export const walletTransactionsResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  transactions: z.array(walletTransactionItemSchema).default([]),
  pagination: z
    .object({
      totalTransactions: z.number().int().optional(),
      totalPages: z.number().int().optional(),
      page: z.number().int().optional(),
      limit: z.number().int().optional(),
    })
    .optional(),
  data: z
    .object({
      transactions: z.array(walletTransactionItemSchema).optional(),
      totalTransactions: z.number().int().optional(),
      totalPages: z.number().int().optional(),
    })
    .optional(),
});

export type WalletTransactionsResponse = z.infer<typeof walletTransactionsResponseSchema>;

/**
 * Bank Account creation/update input schema.
 */
export const bankAccountInputSchema = z
  .object({
    payoutType: z.enum(["bank", "upi"]).optional().default("bank"),
    accountName: z.string().min(2, "Beneficiary name must be at least 2 characters").max(100),
    accountNumber: z.string().optional().or(z.literal("")),
    ifscCode: z.string().optional().or(z.literal("")),
    bankName: z.string().optional().or(z.literal("")),
    upiId: z.string().max(100).optional().or(z.literal("")),
    isDefault: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    const isUpi = data.payoutType === "upi" || (!!data.upiId && !data.accountNumber);
    if (isUpi) {
      if (!data.upiId || !/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test(data.upiId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["upiId"],
          message: "Please enter a valid UPI ID (e.g. name@okhdfcbank)",
        });
      }
    } else {
      if (!data.accountNumber || !/^\d{9,18}$/.test(data.accountNumber.replaceAll(/\s/g, ""))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["accountNumber"],
          message: "Please enter a valid 9 to 18 digit account number",
        });
      }
      if (!data.ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(data.ifscCode.toUpperCase())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ifscCode"],
          message: "Please enter a valid 11-digit IFSC code (e.g. SBIN0001234)",
        });
      }
      if (!data.bankName || data.bankName.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bankName"],
          message: "Please enter a valid bank name",
        });
      }
    }
  });

export type BankAccountInput = z.infer<typeof bankAccountInputSchema>;

/**
 * Single bank account item representation returned by the backend.
 */
export const bankAccountItemSchema = z.object({
  id: z.string(),
  accountName: z.string(),
  accountNumber: z.string(),
  ifscCode: z.string(),
  bankName: z.string(),
  isDefault: z.boolean().default(false),
  upiId: z.string().nullable().optional(),
  isVerified: z.boolean().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
});

export type BankAccountItem = z.infer<typeof bankAccountItemSchema>;

/**
 * GET /api/wallet/bank-accounts response schema.
 */
export const bankAccountsResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  accounts: z.array(bankAccountItemSchema).default([]),
});

export type BankAccountsResponse = z.infer<typeof bankAccountsResponseSchema>;

/**
 * POST /api/payments/withdraw input payload schema.
 * All amounts are integers in paise.
 */
export const withdrawInputSchema = z.object({
  bankAccountId: z.string().min(1, "Bank account ID is required"),
  amount: z.number().int().positive("Withdrawal amount must be a positive integer in paise"),
});

export type WithdrawInput = z.infer<typeof withdrawInputSchema>;

/**
 * POST /api/payments/withdraw response schema.
 */
export const withdrawResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z
    .object({
      id: z.string().optional(),
      withdrawalId: z.string().optional(),
      amount: z.number().optional(),
      status: z.string().optional(),
      alreadyProcessed: z.boolean().optional(),
    })
    .catchall(z.unknown())
    .optional(),
});

export type WithdrawResponse = z.infer<typeof withdrawResponseSchema>;

/**
 * Razorpay verification input schema.
 */
export const addFundsVerifyInputSchema = z.object({
  razorpay_payment_id: z.string().optional(),
  razorpay_order_id: z.string().optional(),
  razorpay_signature: z.string().optional(),
});

export type AddFundsVerifyInput = z.infer<typeof addFundsVerifyInputSchema>;

/**
 * Admin withdrawal item schema.
 */
export const adminWithdrawalItemSchema = z
  .object({
    id: z.string(),
    amount: z.number().int(),
    status: z.string(),
    bankAccountName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    accountNumber: z.string().optional(),
    ifscCode: z.string().optional(),
    bankName: z.string().optional(),
    upiId: z.string().nullable().optional(),
    riskScore: z.number().optional(),
    isManualReview: z.boolean().default(false),

    createdAt: z.union([z.string(), z.date()]).transform((val) =>
      typeof val === "string" ? val : val.toISOString()
    ),
    wallet: z.object({
      user: z.object({
        id: z.string(),
        email: z.string(),
        userType: z.string(),
        influencerProfile: z.object({ displayName: z.string() }).nullable(),
        brandProfile: z.object({ companyName: z.string() }).nullable(),
        taxCompliance: z
          .object({
            panLast4: z.string().nullable().optional(),
            status: z.string().nullable().optional(),
            itrAcknowledgementLast4: z.string().nullable().optional(),
          })
          .nullable()
          .optional(),
      }),
    }),
  })
  .catchall(z.unknown());

export type AdminWithdrawalItem = z.infer<typeof adminWithdrawalItemSchema>;

/**
 * GET /api/admin/payouts response schema.
 */
export const adminPayoutsResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  withdrawals: z.array(adminWithdrawalItemSchema).optional(),
  data: z
    .object({
      withdrawals: z.array(adminWithdrawalItemSchema).optional(),
      total: z.number().optional(),
    })
    .optional(),
  total: z.number().optional(),
});

export type AdminPayoutsResponse = z.infer<typeof adminPayoutsResponseSchema>;


