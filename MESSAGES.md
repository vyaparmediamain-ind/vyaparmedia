# VyaparMedia User Messaging & Error Handling Guidelines (`MESSAGES.md`)

> **Last Updated**: October 10, 2026  
> **Status**: Synchronized with Phase 9 Audit (`audit/P9-messages.md`)  
> **Architecture Standard**: Structured Error Code First → Strict Infrastructure Leak Guard → HTTP Status & Actionable Clean Fallback.

---

## 1. Core Principles

1. **Zero Technical Leaks**:
   - Stack traces, database column names, table names, SQL keywords, and internal microservice names must **never** be exposed in the UI.
   - Raw technical exceptions belong solely in structured server logs (`logger.error` / `logger.warn`).
2. **Consistent, Polite & Professional Tone**:
   - Tone is polite, clear, respectful, and reassuring.
   - Avoid robotic phrasing (e.g. `ERR_500: Internal server failure occurred`), accusatory tones (e.g. `You entered invalid data`), or overly informal slang.
3. **Actionability Over Ambiguity**:
   - Every error state should explain **what happened** and suggest **what to do next** (e.g., "Try again", "Refresh page", "Check bank details", or "Contact support").
4. **Informative & Specific Success States**:
   - Success messages must never be generic "Success!". They should provide concrete details (e.g., settlement timeframes, background verification steps, next milestone).
5. **Structured Error Codes Over Keyword Guessing**:
   - UI components and error mappers must branch on explicit machine-readable error codes (`err.code`) rather than guessing error intent by matching substrings in human sentences.

---

## 2. Standardized Message & Error Code Catalog

### A. Authentication & Account Security
| Scenario | Error Code | HTTP Status | User-Facing Message | Suggested Action | Target CTA |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Session Expired** | `SESSION_EXPIRED` | 401 | "Your session has expired. Please sign in again to continue." | Sign In | `/login` |
| **Invalid Credentials** | `INVALID_CREDENTIALS` | 401 | "Incorrect email or password. Please verify your credentials and try again." | Try Again | — |
| **Account Suspended / Banned** | `ACCOUNT_INACTIVE` | 403 | "Your account is currently suspended or inactive. Please contact support for assistance." | Contact Support | `/dashboard/support` |
| **Permission Denied** | `FORBIDDEN` | 403 | "You don't have permission to perform this action. If you believe this is an error, please reach out to support." | Contact Support | `/dashboard/support` |
| **Rate Limit Exceeded** | `RATE_LIMIT_EXCEEDED` | 429 | "Too many attempts detected. For your account security, please wait a moment before trying again." | Wait & Retry | — |
| **Invalid / Expired OTP** | `INVALID_OTP` | 400 | "The OTP entered is incorrect or has expired. Please request a new code and try again." | Resend Code | — |
| **Expired Reset Link** | `RESET_LINK_EXPIRED` | 400 | "This password reset link has expired or has already been used. Please request a fresh link." | Request Link | `/forgot-password` |
| **Password Changed** | — | 200 | "Password updated successfully. For your security, other active sessions have been signed out." | None | — |

### B. Wallet, Payments & Escrow
| Scenario | Error Code | HTTP Status | User-Facing Message | Suggested Action | Target CTA |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Insufficient Balance** | `INSUFFICIENT_BALANCE` | 400 | "Your available balance is insufficient for this request. Please deposit funds or adjust the amount." | Add Funds | `/dashboard/wallet` |
| **Withdrawal Limits** | `WITHDRAWAL_LIMIT_EXCEEDED` | 400 | "Withdrawal must be between ₹500 and ₹5,00,000 per transaction." | Adjust Amount | — |
| **Gateway Timeout / Ambiguous** | `GATEWAY_AMBIGUOUS` | 400 | "The payment gateway is taking longer than expected to confirm. Please check your transaction history before initiating a new request." | Check History | `/dashboard/wallet?tab=ledger` |
| **Penny-Drop Verification Failed** | `BANK_VERIFY_FAILED` | 400 | "We couldn't verify this bank account with your bank. Please ensure the account number and IFSC code are correct." | Verify Details | `/dashboard/wallet?tab=accounts` |
| **Max Bank Accounts Reached** | `BANK_LIMIT_REACHED` | 400 | "You have reached the maximum limit of 5 linked bank accounts. Please remove an unused account to add a new one." | Manage Accounts | `/dashboard/wallet?tab=accounts` |
| **Account Delete Pending Payout** | `BANK_LOCKED_PENDING_PAYOUT` | 400 | "This bank account cannot be removed while a withdrawal is currently processing." | View Payouts | `/dashboard/wallet?tab=ledger` |
| **Withdrawal Submitted** | — | 200 | "Withdrawal request submitted successfully. Funds will reflect in your bank account via instant IMPS within 2–4 hours." | View History | `/dashboard/wallet?tab=ledger` |
| **Bank Account Saved** | — | 200 | "Bank account saved. Verification penny-drop initiated and will confirm shortly." | Done | — |

### C. Deals & Deliverables
| Scenario | Error Code | HTTP Status | User-Facing Message | Suggested Action | Target CTA |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Deal State Conflict** | `DEAL_STATE_CONFLICT` | 409 | "This deal state has updated or this action is no longer permitted. Please refresh the deal details." | Refresh Deal | `/dashboard/deals/[id]` |
| **Terminal State Locked** | `TERMINAL_STATE_LOCKED` | 400 | "This deal has already concluded and its status cannot be modified." | View Deal | `/dashboard/deals/[id]` |
| **Missing Shipping Address** | `SHIPPING_ADDRESS_REQUIRED` | 400 | "Creator shipping address must be submitted before product sample dispatch." | Add Address | `/dashboard/deals/[id]` |
| **Non-Serviceable Pincode** | `SHIPPING_NON_SERVICEABLE` | 400 | "The selected courier cannot service this destination pincode. Please update the delivery address." | Edit Address | `/dashboard/deals/[id]` |
| **Deliverables Submitted** | — | 200 | "Deliverables submitted successfully! The brand will review your content." | View Deal | `/dashboard/deals/[id]` |
| **Contract Signed** | — | 200 | "Contract signed successfully. The deal is now active." | View Deal | `/dashboard/deals/[id]` |
| **Dispute Lodged** | — | 200 | "Dispute opened. Our moderation team will review evidence within 24–48 hours." | Track Dispute | `/dashboard/disputes/[id]` |

### D. System & Network
| Scenario | Error Code | HTTP Status | User-Facing Message | Suggested Action | Target CTA |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Offline / Network Drop** | `NETWORK_ERROR` | 0 | "Unable to connect right now. Please check your internet connection and try again." | Try Again | — |
| **Internal Server Error** | `INTERNAL` | 500 | "We encountered a temporary processing issue. Our team has been notified. Please try again shortly." | Try Again | — |
| **File Upload Too Large** | `FILE_TOO_LARGE` | 413 | "File upload failed. Please ensure your file is under the allowed size limit and in a supported format." | Select File | — |

---

## 3. Developer Implementation Standards

### Using `formatUserError` in UI Components:
```typescript
import { formatUserError } from "@/lib/user-messages";

try {
  await apiClient.wallet.withdraw(...);
} catch (err: unknown) {
  const userMessage = formatUserError(err, "Failed to submit withdrawal request.");
  showToast("error", userMessage);
}
```

### Using Structured Errors with `getUserFriendlyErrorMessage`:
```typescript
import { getUserFriendlyErrorMessage } from "@/lib/user-messages";

try {
  await executeAction();
} catch (err: unknown) {
  const { message, actionText, actionType } = getUserFriendlyErrorMessage(err);
  setErrorDisplay({ message, actionText, actionType });
}
```
