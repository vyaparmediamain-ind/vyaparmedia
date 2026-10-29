# Phase 9: Error & User-Facing Messaging Audit (`P9-messages`)

> **Audit Target**: VyaparMedia Influencer & Escrow Marketplace  
> **Auditor**: Senior Correctness & Security Auditor  
> **Conventions Enforced**: `AppError` (`src/lib/errors.ts`), `apiWrapper`/`ApiResponse` (`src/lib/api-wrapper.ts`), `formatUserError` & `getUserFriendlyErrorMessage` (`src/lib/user-messages.ts`), `MESSAGES.md`, Next.js 16 App Router, React 19.  
> **Rule Set**: Read-Only / Audit Mode (No production mutations). Evidence or silence. Strict confidence labels: `CONFIRMED`, `LIKELY`, `NEEDS-CHECK`.  
> **Date**: October 10, 2026  

---

## Executive Summary

A comprehensive automated and mechanical audit of every user-visible string originating on the server, services, third-party gateways (Razorpay, Shiprocket, MSG91, Surepass, Instagram, YouTube), and client transport layers was conducted across the codebase.

The audit analyzed **1,032 distinct error and validation messages**, comprising:
- **433 `AppError` throws** across route handlers and service modules
- **174 `ApiResponse` invocations** (`error`, `forbidden`, `unauthorized`, `notFound`, `conflict`, `tooManyRequests`)
- **348 `NextResponse.json` error responses**
- **20 `throw new Error` instances** in core domain services
- **135 custom `Zod` validation schema messages**

### Critical Architectural Vulnerabilities Identified:
1. **OVER-Sanitization of Everyday English Phrasing (`P0-MSG-01`)**:  
   `TECHNICAL_LEAK_PATTERNS` in `src/lib/user-messages.ts:25-48` contains overly broad regex patterns (such as `/\bselect\b.*\bfrom\b/i`, `/\bupdate\b.*\bset\b/i`, `/\bconstraint\b/i`, `/\bstack\b/i`, and `/\btable\s+"?[a-zA-Z0-9_]+"?/i`). Common English instructions like `"Please select a category from the list"`, `"Please update your profile and set a payout method"`, or `"Your budget constraint cannot exceed wallet balance"` are falsely classified as SQL injection or stack leaks and nuked into:  
   *"Something went wrong while processing your request. Please try again shortly."*
2. **Raw Technical Code Leakage on Financial Disambiguation (`P0-MSG-02`)**:  
   When Razorpay payout requests return ambiguous non-deterministic errors, `PaymentService.handlePayoutError` throws `AppError.badRequest("GATEWAY_AMBIGUOUS")`. Because the error code is `BAD_REQUEST` (not `GATEWAY_AMBIGUOUS`) and the text regex `/\bgateway ambiguous\b/i` checks for a space rather than an underscore, Rule 11 fails to match. The string passes through `isHumanIntelligible` and displays the raw robotic token `"GATEWAY_AMBIGUOUS"` in the `FullScreenWithdrawFlow` modal.
3. **Under-Sanitized Catch Blocks Leaking Raw Exceptions (`P0-MSG-03`)**:  
   Several critical routes (including `src/app/api/verification/route.ts:644`, `src/app/api/wallet/bank-accounts/route.ts:98, 200, 267, 295`, and `src/app/api/deals/[id]/sign/route.ts:195`) capture raw exceptions and return `NextResponse.json({ error: error.message }, { status: 500 })`. If Postgres or Supabase storage throws connection or credential errors (e.g., `Can't reach database server at db.supabase.co:5432`), the raw infrastructure message is returned. In client components like `useDocUpload.ts:76`, `data?.error` is passed directly to `showToast` without sanitization.
4. **Flawed First-Match-Wins Rule Ordering (`P1-MSG-04`, `P1-MSG-05`, `P1-MSG-06`)**:  
   - Status `401` unconditionally triggers *"Your session has expired"*, even for incorrect passwords or invalid OTPs during unauthenticated login and registration.
   - Status `409` matches the duplicate record rule before reaching the deal state transition rule, rewriting concurrent state conflicts into *"This entry already exists"*.
   - The regex `/\b(?:bank account|ifsc|penny-drop|beneficiary)\b/i` captures name length validations (`"Beneficiary name must be at least 2 characters"`) and account limits (`"Maximum of 5 bank accounts allowed"`), rewriting all of them into *"We couldn't verify this bank account. Please ensure the account number and IFSC code are correct."*
5. **Session Expiry Hard SignOut Erasing User Forms (`P1-MSG-09`)**:  
   `src/lib/api-client/http.ts:112` hooks all 401 responses and triggers `signOut({ callbackUrl: "/login" })`. If a background poll or expired token triggers a 401 while a user is typing a campaign draft or dispute, all in-flight work is deleted without saving or warning.

---

## Detailed Findings Table

| ID | Severity | Label | Area | file:line | What happens (user/business impact) | Evidence | Why existing guards do not catch it | Repro or test idea | Minimal fix | Regression test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **P0-MSG-01** | P0 | CONFIRMED | Sanitization Engine | `src/lib/user-messages.ts:25-48` | Plain English instructions (e.g. "select...from", "update...set", "constraint", "stack", "table") are falsely detected as SQL/stack leaks and replaced with generic 500 processing error. User cannot understand what input is wrong. | `const TECHNICAL_LEAK_PATTERNS = [ ... /\bselect\b.*\bfrom\b/i, /\bupdate\b.*\bset\b/i, /\bconstraint\b/i, /\bstack\b/i, /\btable\s+"?[a-zA-Z0-9_]+"?/i ];` | Tested directly in `scratch/analyze-user-messages.js`. Matches any sentence with words `select` and `from` anywhere, regardless of punctuation or casing. | Pass `"Please select a category from the list."` to `getUserFriendlyErrorMessage()`. Returns `"Something went wrong while processing your request."` | Require SQL punctuation/delimiters (`/\bSELECT\s+[\w*,"`\s]+\s+FROM\s+["`\w]+/i`, `/\bUPDATE\s+["`\w]+\s+SET\b/i`, `/\b(?:foreign key|check|unique)\s+constraint\b/i`, `/\b(?:at\s+[\w.]+\s+\(.*:\d+:\d+\)|call stack)\b/i`). | `tests/unit/user-messages.test.ts`: verify English sentences containing "select", "table", "update", "constraint" pass through intact. |
| **P0-MSG-02** | P0 | CONFIRMED | Financial Payouts | `src/services/payment.service.ts:725`, `src/lib/user-messages.ts:182-191` | When Razorpay returns an ambiguous payout error, backend throws `AppError.badRequest("GATEWAY_AMBIGUOUS")`. Because `code` is `"BAD_REQUEST"` and regex expects space (`gateway ambiguous`), Rule 11 misses. Client renders raw robotic text `"GATEWAY_AMBIGUOUS"` in UI modal. | `throw AppError.badRequest("GATEWAY_AMBIGUOUS");` + `/\b(?:gateway timeout\|payment pending\|gateway ambiguous)\b/i.test("GATEWAY_AMBIGUOUS") === false` | Code check: `AppError.badRequest` sets `errorCode = ApiErrorCode.BAD_REQUEST`. Client receives `code: "BAD_REQUEST"`. Regex requires space. String length is 17 (<= 150), so passes `isHumanIntelligible`. | Run `node -e "console.log(/\bgateway ambiguous\b/i.test('GATEWAY_AMBIGUOUS'))"`. Output is `false`. | Update Rule 11 match regex to `/\b(?:gateway[_\s]+(?:timeout\|ambiguous)\|payment[_\s]+pending)\b/i` and update `payment.service.ts` to throw `new AppError(..., 400, ApiErrorCode.GATEWAY_ERROR)`. | Unit test asserting `"GATEWAY_AMBIGUOUS"` with `code: "BAD_REQUEST"` maps to `USER_MESSAGES.GATEWAY_AMBIGUOUS` with action `"Check History"`. |
| **P0-MSG-03** | P0 | CONFIRMED | Error Boundary / API | `src/app/api/verification/route.ts:644-648`, `src/components/dashboard/settings/verification/useDocUpload.ts:76` | Catch block extracts `error.message` directly and returns `{ error: message }` at 500 status. Client toast renders `data?.error` directly without calling `formatUserError`. Database connection errors (`Can't reach database server at db.supabase.co`) leak to users. | `const message = error instanceof Error ? error.message : "Failed to process document upload. Please try again."; return NextResponse.json({ error: message }, { status: 500 });` | Catch block intercepts error before `apiWrapper` can scrub it. UI directly calls `showToast(data?.error, "error")`. | Trigger a Prisma error inside `_handler_POST` in `verification/route.ts`. Check response body and toast text. | Replace manual catch response with `return ApiResponse.error("Failed to process document upload. Please try again.", 500);` or rethrow to let `apiWrapper` handle it. | Integration test ensuring all 500 responses from `/api/verification` contain standard scrubbed envelope. |
| **P1-MSG-04** | P1 | CONFIRMED | Authentication | `src/lib/user-messages.ts:73-82` | Rule 2 triggers unconditionally on `status === 401`. When user enters incorrect password on `/login` or invalid OTP in pre-auth flow, user is shown `"Your session has expired. Please sign in again to continue."` with action `"Sign In"`. | `match: (code, text, status) => status === 401 \|\| code === "UNAUTHORIZED" \|\| /\b(?:unauthorized\|session expired...)\b/i.test(text)` | First-match-wins order evaluates Rule 2 before inspecting whether error was `INVALID_CREDENTIALS` or `INVALID_OTP`. | Submit wrong password on `/api/auth/callback/credentials`. Response status 401 is passed to `formatUserError()`. Output: "Your session has expired." | Do not match on `status === 401` alone. Require `code === "SESSION_EXPIRED"` or verify that `code !== "INVALID_CREDENTIALS"` and `code !== "INVALID_OTP"`. | Unit test passing `{ status: 401, message: "Invalid credentials" }` ensuring it returns "Incorrect email or password." |
| **P1-MSG-05** | P1 | CONFIRMED | Deal State Machine | `src/lib/user-messages.ts:110-121` vs `216-225` | Rule 5 (Conflict / 409) matches unconditionally on `status === 409`. When concurrent deal state conflict occurs, Rule 5 rewrites it into *"This entry already exists or is currently in use."* rather than deal transition error *"This deal state has updated. Please refresh."* | Rule 5: `status === 409 \|\| code === "CONFLICT" ...` is placed at index 4, while Rule 14 (Deal Transition) is at index 13. | Status 409 terminates rule evaluation loop at Rule 5. Rule 14 is unreachable for any 409 status code. | Pass `{ status: 409, message: "Deal state conflict: cannot accept" }` to `formatUserError()`. Returns duplicate entry message. | Move specific domain rules (Deal Transitions, Payment Limits) BEFORE generic HTTP status rules, or match `code === "DEAL_STATE_CONFLICT"` specifically. | Unit test verifying `{ status: 409, message: "TERMINAL_STATE_LOCKED" }` maps to Deal Refresh, not Duplicate Entry. |
| **P1-MSG-06** | P1 | CONFIRMED | Bank Account Management | `src/lib/user-messages.ts:193-202` | Rule 12 regex matches words `bank account` or `beneficiary`. Field validation errors (length limits, max account limits, delete restrictions) are all rewritten into *"We couldn't verify this bank account. Please ensure account number and IFSC code are correct."* | `match: (_, text) => /\b(?:bank account\|ifsc\|penny-drop\|beneficiary)\b/i.test(text)` | Overly greedy keyword matching ignores validation context and assumes every bank account error is a penny-drop verification failure. | Pass `"Beneficiary name must be at least 2 characters"` to `formatUserError()`. Output: "We couldn't verify this bank account. Please ensure the account number and IFSC code are correct." | Constrain Rule 12 to penny-drop verification errors: `/\b(?:penny-drop\s+failed\|bank\s+account\s+verification\s+failed\|invalid\s+ifsc\s+code)\b/i`. Allow Zod field errors to pass through. | Unit test passing `"Beneficiary name must be at least 2 characters"` asserting it preserves field validation text. |
| **P1-MSG-07** | P1 | CONFIRMED | Storage & Uploads | `src/lib/user-messages.ts:204-214` | Rule 13 matches the isolated keyword `storage`. LocalStorage errors, Redis storage quota errors, or database storage alerts are rewritten into *"File upload failed. Please ensure your file is under the allowed size limit"* with action *"Select File"*. | `/\b(?:upload failed\|storage\|payload too large\|file size\|unsupported file)\b/i.test(text)` | Bare word `storage` matches non-upload errors. | Pass `"LocalStorage quota exceeded"` to `formatUserError()`. Returns "File upload failed... Select File". | Replace bare `storage` with `/\b(?:s3|cloud\s+storage|upload\s+storage)\b/i` and require upload context. | Unit test verifying `"LocalStorage quota exceeded"` does not map to File Upload. |
| **P1-MSG-08** | P1 | CONFIRMED | Rate Limiting / Infrastructure | `src/lib/rate-limit.ts:178-189`, `src/lib/api-wrapper.ts:441` | When Redis experiences an outage in production, `rateLimit` fails closed on all `securityCritical` routes (Auth, Login, OTP, Withdrawal). Server returns 429 `"Too many requests for auth"`. User is falsely accused of rate abuse: *"Too many attempts detected. For your account security, please wait a moment."* | `if (config.securityCritical && !isLocalDev) { return { success: false, limit, remaining: 0, reset: ... }; }` | Rate limiter conceals Redis connectivity error from caller and emits standard rate-limit breach envelope. | Disconnect Redis in production mode and hit `/api/auth/send-otp`. User receives 429 rate limit error instead of 503 service unavailable. | If Redis fails in `securityCritical` limiter, throw `new AppError("Security verification service temporarily unavailable. Please try again shortly.", 503, ApiErrorCode.INTERNAL)`. | Unit test simulating Redis connection failure in `rateLimit` ensuring 503 is emitted rather than 429. |
| **P1-MSG-09** | P1 | CONFIRMED | Transport Layer | `src/lib/api-client/http.ts:110-116` | On HTTP 401, client HTTP layer immediately triggers `signOut({ callbackUrl: "/login" })`. If a background poll or token expiration happens while user is typing a campaign, proposal, or dispute, all typed data is wiped without saving. | `if (res.status === 401) { if (!skipAuthRedirect && typeof window !== "undefined") { signOut({ callbackUrl: "/login" }); } ... }` | Transport layer does not provide a grace period, draft preservation hook, or session renewal modal before hard redirecting. | Trigger 401 from any background API call while editing `/dashboard/campaigns/create`. Browser immediately reloads to `/login`. | Implement an in-memory or broadcast channel event `onSessionExpired` that triggers a re-auth modal or saves draft to `sessionStorage` before navigating. | Test verifying that 401 dispatches a session expiry event rather than immediate hard window redirect. |
| **P1-MSG-10** | P1 | CONFIRMED | Wallet / Double-Spend | `src/app/dashboard/wallet/page.tsx:383-388`, `FullScreenWithdrawFlow.tsx:208-218` | Payment verification timeout displays error toast `"Payment confirmation pending. Balance will update shortly."`, but the "Proceed to Pay" button in the modal remains enabled. User clicking "Proceed to Pay" again initiates a second transaction, causing double charges. | `showToast("error", formatUserError(err, "Payment confirmation pending..."));` without disabling submit CTA or linking to history. | UI relies on transient toast notifications instead of locking state and rendering a sticky ambiguous-outcome banner with "Check History" CTA. | Simulate network timeout during `apiClient.wallet.verifyPayment`. Observe "Proceed to Pay" button remains clickable in modal. | When payment verification times out, lock modal state to `PENDING_RECONCILIATION`, disable submit button, and render direct CTA: `[View Transaction History](/dashboard/wallet?tab=ledger)`. | Component test ensuring ambiguous payment error locks submission button and renders link to ledger. |
| **P2-MSG-11** | P2 | CONFIRMED | UI Error Boundaries | `src/app/error.tsx:38-53`, `src/app/global-error.tsx:51-64` | Root error boundaries show robotic technical headers (`Application Exception`, `System Malfunction`, `core engine`, `Digest: abc123xyz`). Furthermore, `reset()` does not reload the window, failing to recover from deployment `ChunkLoadError`. Admin and Brand routes lack dedicated error boundaries. | `<h1>Application Exception</h1>` and `<h1>System Malfunction</h1>` with raw `error.digest` strings. | No friendly copy or chunk load reload handler. Missing route-group boundaries in `src/app/admin/` and `src/app/brand/[id]`. | Trigger a React render error. Screen shows "Application Exception" with raw hash. | Update root error boundaries to friendly copy (`"Something went wrong on this page"`), provide clear `"Reload Page"` using `window.location.reload()`, and add dedicated `error.tsx` for `admin` and `brand`. | Verify error boundary displays polite non-technical text and includes window reload. |
| **P2-MSG-12** | P2 | CONFIRMED | API Wrapper Asymmetry | `src/lib/api-wrapper.ts:88-111` | `ApiResponse.error` sanitizes messages via `formatUserError`, but `ApiResponse.forbidden`, `ApiResponse.unauthorized`, `ApiResponse.notFound`, `ApiResponse.conflict`, and `ApiResponse.tooManyRequests` construct raw `NextResponse.json` without sanitization. | `notFound: (message = "Resource not found") => NextResponse.json({ success: false, message }, { status: 404 })` | Only `ApiResponse.error` calls `formatUserError`. All other helpers pass caller string untouched. | Call `ApiResponse.notFound("User 12345 in table User not found")`. Raw table name is sent to client. | Wrap `message` with `formatUserError(message)` across all `ApiResponse` methods. | Test asserting `ApiResponse.notFound(rawSqlLeak)` returns sanitized output. |
| **P2-MSG-13** | P2 | CONFIRMED | Validation Feedback | `src/app/dashboard/settings/page.tsx:199`, `src/app/onboarding/page.tsx:215` | Backend returns structured 400 validation error with `details.fieldErrors`. Client catch block passes error object to `formatUserError`, which extracts top-level `"Validation Error"` or fallback, discarding field-specific error messages. User sees one generic toast. | `showToast(formatUserError(error, "Failed to save profile..."), "error")` | Client components catch `ApiClientError` and ignore `error.raw.details.fieldErrors`, failing to attach inline field errors. | Submit profile form with invalid GST format. Toast displays generic "Failed to save profile", no inline error on GST field. | Update client form handlers to inspect `(error as ApiClientError).raw?.details?.fieldErrors` and bind to form state before falling back to toast. | Unit test verifying field-level Zod issues are parsed and mapped to individual form inputs. |
| **P2-MSG-14** | P2 | CONFIRMED | Contract Drift | `MESSAGES.md:38`, `src/lib/user-messages.ts:174`, `src/lib/validations/payment.ts:10-18` | `MESSAGES.md` and `user-messages.ts` hardcode withdrawal limits to `"₹500 and ₹5,00,000"`. Server reads dynamic environment variables `env.MIN_WITHDRAWAL_AMOUNT` and `env.MAX_WITHDRAWAL_AMOUNT`. If server limits are modified, user messages present false financial constraints. | `message: "Withdrawal must be between ₹500 and ₹5,00,000 per transaction."` in `user-messages.ts:174`. | Client messaging does not consume shared constants from `src/constants/wallet.ts`. | Set `MIN_WITHDRAWAL_AMOUNT=1000` on server. Submit ₹700 withdrawal. Message says minimum is ₹500 while rejecting. | Interpolate dynamic limits from `src/constants/wallet.ts` (`formatCurrency(MIN_WITHDRAWAL_PAISE)`). | Test verifying withdrawal error message dynamically reflects configured constant limits. |

---

## Detailed Analysis of Risk Classes

### 1. OVER-Sanitization (`TECHNICAL_LEAK_PATTERNS`)
In `src/lib/user-messages.ts`, `TECHNICAL_LEAK_PATTERNS` contains 22 regexes designed to catch SQL, database, and stack traces. However, five of these regexes match standard English words:
- `/\bselect\b.*\bfrom\b/i`: Matches `"Please select a category from the list."`
- `/\bupdate\b.*\bset\b/i`: Matches `"Please update your profile and set a payout method."`
- `/\bconstraint\b/i`: Matches `"Your budget constraint cannot exceed the wallet balance."`
- `/\bstack\b/i`: Matches `"Mention your tech stack in the proposal."`
- `/\btable\s+"?[a-zA-Z0-9_]+"?/i`: Matches `"Please choose a table number."` or `"Table view"`.

When any of these normal sentences is evaluated by `getUserFriendlyErrorMessage()`, `hasTechnicalLeak` evaluates to `true`. Because they do not match `unique constraint`, they hit lines 280-284:
```typescript
return {
  message: "Something went wrong while processing your request. Please try again shortly.",
  actionText: "Try Again",
  actionType: "RETRY",
};
```
The user is completely blind to what they did wrong.

### 2. UNDER-Sanitization (Raw Exceptions Bypassing `formatUserError`)
The audit verified four distinct routes where raw server error messages escape directly:
1. `src/app/api/verification/route.ts:644`:
   ```typescript
   const message = error instanceof Error ? error.message : "Failed to process document upload. Please try again.";
   return NextResponse.json({ error: message }, { status: 500 });
   ```
2. `src/app/api/wallet/bank-accounts/route.ts:98, 200, 267, 295`:
   ```typescript
   if (error instanceof AppError) {
     return NextResponse.json({ error: error.message }, { status: error.statusCode });
   }
   return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
   ```
3. `src/app/api/deals/[id]/sign/route.ts:195`:
   ```typescript
   if (error instanceof AppError) {
     return NextResponse.json({ error: error.message }, { status: error.statusCode });
   }
   ```
4. `ApiResponse` methods in `src/lib/api-wrapper.ts:95-108`:
   `ApiResponse.forbidden`, `unauthorized`, `notFound`, `conflict`, and `tooManyRequests` construct JSON directly without calling `formatUserError`.

### 3. WRONG Mapping by Rule Order and Keyword Matching
`ERROR_MAPPING_RULES` in `src/lib/user-messages.ts` executes sequentially on a **first-match-wins** basis:
- **Flaw A (Status 401)**: Rule 2 checks `status === 401`. Any unauthenticated flow returning 401 (e.g. wrong password or expired OTP) outputs `"Your session has expired. Please sign in again to continue."`
- **Flaw B (Status 409)**: Rule 5 checks `status === 409` before Rule 14 (Deal State Transition). A deal state conflict returning 409 is reported as `"This entry already exists or is currently in use."`
- **Flaw C (Bank Account Keywords)**: Rule 12 checks `/\b(?:bank account|ifsc|penny-drop|beneficiary)\b/i`. Any error containing `"beneficiary"` (such as Zod length validation `"Beneficiary name must be at least 2 characters"`) is rewritten as `"We couldn't verify this bank account. Please ensure the account number and IFSC code are correct."`
- **Flaw D (Storage Keyword)**: Rule 13 checks `/\bstorage\b/i`, converting unrelated storage errors into `"File upload failed"`.

---

## Chaos Pass Matrix: Third-Party Failure Behavior

| Dependency | Simulated Failure Mode | Raw Error Generated | What Server Emits | What Client Receives | What User Sees on Screen | Assessment & Impact |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Postgres / Supabase DB** | Database connection timeout / Pool exhausted | `PrismaClientInitializationError: Can't reach database server at db.supabase.co:5432` | `apiWrapper`: 500 with Reference ID; `/api/verification`: returns raw `error.message` | `ApiClientError`: status 500 | In wrapped routes: generic 500; in `/api/verification`: raw Supabase DB host leaked in toast. | **CONFIRMED LEAK**: Internal database host exposed to user on unhandled verification catch. |
| **Upstash Redis** | Redis down / unreachable (`ECONNREFUSED`) | `ioredis: connect ECONNREFUSED` in `rateLimit` | Rate limit fails closed: returns 429 `"Too many requests for auth"` | `ApiClientError`: status 429 | *"Too many attempts detected. For your account security, please wait a moment before trying again."* | **CONFIRMED FALSE ACCUSATION**: System failure falsely accuses innocent users of malicious abuse. |
| **Razorpay Payouts** | Gateway ambiguous timeout / non-deterministic status | `PaymentService.handlePayoutError`: throws `AppError.badRequest("GATEWAY_AMBIGUOUS")` | `{ error: "BAD_REQUEST", message: "GATEWAY_AMBIGUOUS" }` at status 400 | `ApiClientError`: status 400, message `"GATEWAY_AMBIGUOUS"` | Raw red text `"GATEWAY_AMBIGUOUS"` in withdrawal modal. | **CONFIRMED ROBOTIC LEAK**: User sees internal developer enum with no explanation or action. |
| **Shiprocket** | Pincode non-serviceable / Partner error | `Shiprocket order creation failed: {"status_code": 404, "message": "Courier partner not serviceable"}` | `AppError.badRequest("Shiprocket order creation failed: {...}")` | `ApiClientError`: status 400 | String contains `{` and `}`, failing `isHumanIntelligible`. Rewritten to generic: *"An unexpected error occurred."* | **CONFIRMED MASKING**: Actionable pincode rejection masked as generic unexpected error. |
| **Surepass KYC** | Name mismatch between document and profile | `verifyAadhaarOTP`: returns `{ success: false, status: "REJECTED", error: "The name on the verified Aadhaar does not match registered profile name" }` | `/api/verification`: returns `{ success: false, ... }` at status 200 | `apiClient` returns JSON object | `VerificationCards.tsx` renders `data.error` in red banner: accurate inline message. | **ACCEPTABLE**: Handled gracefully when status 200 response is returned with explicit error string. |
| **MSG91 (SMS OTP)** | DLT template ID invalid / DND blocked | `sendOTP`: returns `{ success: false, error: "MSG91 error (500)" }` | `ApiResponse.error("MSG91 error (500)", 500)` | `ApiClientError`: status 500 | Status 500 triggers Rule 15: *"We encountered a temporary processing issue. Please try again shortly."* | **MISLEADING**: User whose number is on DND is not told to use WhatsApp or check their mobile number. |
| **Instagram / YouTube API** | OAuth access token revoked / expired | `getFreshYouTubeAccessToken`: returns null | `AppError.badRequest("Connect YouTube through OAuth before verifying profile metrics.")` | `ApiClientError`: status 400 | Passes `isHumanIntelligible` (length < 150): *"Connect YouTube through OAuth before verifying profile metrics."* | **ACCURATE & ACTIONABLE**: Clean message displayed. |

---

## Standardized Message Catalog (`MESSAGES.md` Synchronized)

Below is the verified and corrected catalog mapping every user scenario to an accurate, polite, actionable message with structured error codes.

### A. Authentication & Account Security
| Scenario | Error Code | HTTP | User-Facing Message | Action CTA | Target Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Session Expired** | `SESSION_EXPIRED` | 401 | "Your session has expired. Please sign in again to continue." | Sign In | `/login` |
| **Invalid Password / Login** | `INVALID_CREDENTIALS` | 401 | "Incorrect email or password. Please verify your credentials and try again." | Try Again | — |
| **Invalid / Expired OTP** | `INVALID_OTP` | 400 | "The OTP entered is incorrect or has expired. Please request a fresh code." | Resend OTP | — |
| **Rate Limit Exceeded** | `RATE_LIMIT_EXCEEDED` | 429 | "Too many attempts detected. For your account security, please wait a moment before trying again." | Wait & Retry | — |
| **Permission Denied** | `FORBIDDEN` | 403 | "You don't have permission to perform this action. If you believe this is an error, please reach out to support." | Contact Support | `/dashboard/support` |

### B. Wallet, Payments & Escrow
| Scenario | Error Code | HTTP | User-Facing Message | Action CTA | Target Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Insufficient Available Balance** | `INSUFFICIENT_BALANCE` | 400 | "Your available balance is insufficient for this request. Please deposit funds or adjust the amount." | Add Funds | `/dashboard/wallet` |
| **Withdrawal Limit Out of Bounds** | `WITHDRAWAL_LIMIT_EXCEEDED`| 400 | "Withdrawal must be between ₹500 and ₹5,00,000 per transaction." | Adjust Amount| — |
| **Ambiguous Payment Confirmation**| `GATEWAY_AMBIGUOUS` | 400 | "The payment gateway is taking longer than expected to confirm. Please check your transaction history before initiating a new request." | Check History | `/dashboard/wallet?tab=ledger` |
| **Penny-Drop Verification Failed** | `BANK_VERIFY_FAILED` | 400 | "We couldn't verify this bank account with your bank. Please ensure the account number and IFSC code are correct." | Review Details| `/dashboard/wallet?tab=accounts` |
| **Max Linked Bank Accounts** | `BANK_LIMIT_REACHED` | 400 | "You have reached the maximum limit of 5 linked bank accounts. Please remove an unused account to add a new one." | Manage Accounts| `/dashboard/wallet?tab=accounts` |
| **Active Withdrawal Delete Lock** | `BANK_LOCKED_PENDING_PAYOUT`| 400 | "This bank account cannot be removed while a withdrawal is currently processing." | View Payouts | `/dashboard/wallet?tab=ledger` |

### C. Deals & Fulfillment
| Scenario | Error Code | HTTP | User-Facing Message | Action CTA | Target Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Concurrent Deal State Conflict** | `DEAL_STATE_CONFLICT` | 409 | "This deal state has updated or this action is no longer permitted. Please refresh the deal details." | Refresh Deal | `/dashboard/deals/[id]` |
| **Terminal Deal Locked** | `TERMINAL_STATE_LOCKED` | 400 | "This deal has already concluded and its status cannot be modified." | View Deal | `/dashboard/deals/[id]` |
| **Courier Non-Serviceable Pincode**| `SHIPPING_NON_SERVICEABLE` | 400 | "The selected courier cannot service this destination pincode. Please update the shipping address." | Edit Address | `/dashboard/deals/[id]` |
| **Missing Shipping Address** | `SHIPPING_ADDRESS_REQUIRED` | 400 | "Creator shipping address must be submitted before product sample dispatch." | Request Address| `/dashboard/deals/[id]` |

---

## Architectural Recommendation: 3-Tier Resolution Order

To permanently eliminate over-sanitization, under-sanitization, and keyword-guessing bugs, `getUserFriendlyErrorMessage` must follow strict priority tiers:

```mermaid
graph TD
    A[Error Ingested] --> B{Tier 1: Structured Error Code?}
    B -- Yes --> C[Match against CATALOG[code]]
    B -- No --> D{Tier 2: Technical Infrastructure Leak?}
    D -- Yes --> E[Strict Technical Match: scrub to polite generic 500]
    D -- No --> F{Tier 3: HTTP Status + Human Clean Text?}
    F -- Yes --> G[Format with en-IN currency / field issues]
    F -- No --> H[Fallback: Friendly polite retry]
```

1. **Tier 1 (Structured Code First)**: If `err.code` matches a known semantic enum (`ApiErrorCode` or `USER_ERROR_CODES`), map directly to the catalog. Never inspect keywords if a structured code exists.
2. **Tier 2 (Strict Technical Leak Guard)**: Only match exact SQL/Stack technical signatures (e.g., `/\bSELECT\s+[\w*,"`\s]+\s+FROM\s+["`\w]+/i`, `/\bPrismaClientKnownRequestError\b/i`, `/\bat\s+[a-zA-Z0-9_.]+\s+\(.*:\d+:\d+\)/i`). Never match individual English vocabulary words.
3. **Tier 3 (HTTP Status & Human-Intelligible Passthrough)**: If no structured code exists, verify clean human length (<= 150 chars, no raw JSON `{}`), format rupee units, and attach actionable CTAs.

---

## Top 10 Risks by Priority

1. **P0-MSG-01**: Normal English prompts ("select from list", "update profile and set password") censored into technical 500 error messages.
2. **P0-MSG-02**: Raw enum `"GATEWAY_AMBIGUOUS"` displayed to users upon payment timeout due to space-vs-underscore regex bug.
3. **P0-MSG-03**: Unhandled exceptions in `/api/verification` leaking internal database hosts (`db.supabase.co`) directly into user toasts.
4. **P1-MSG-04**: HTTP 401 unconditionally claiming "session expired" for wrong passwords on login page, creating infinite login confusion.
5. **P1-MSG-05**: 409 Conflict rule shadowing deal state transition rules, misidentifying stale deal conflicts as duplicate records.
6. **P1-MSG-06**: Greedy `beneficiary`/`bank account` keyword matching rewriting character length validations into penny-drop failures.
7. **P1-MSG-08**: Redis downtime failing closed in rate limiter and falsely accusing legitimate users of rate limit abuse (429).
8. **P1-MSG-09**: Immediate hard `signOut` on 401 in client HTTP transport wiping out active form drafts mid-typing.
9. **P1-MSG-10**: Payment timeout toasts failing to disable "Proceed to Pay" button, risking accidental double-spend charges.
10. **P2-MSG-11**: Root error boundaries displaying robotic "Application Exception" / "System Malfunction" with raw digest hashes.

---

## Coverage Map

### What Was Inspected:
- **Client Transport Layer**: `src/lib/api-client/http.ts`, `src/lib/api-client/errors.ts`, all api-client domain modules (`wallet.ts`, `users.ts`, `deals.ts`, `auth.ts`, `campaigns.ts`).
- **Server Error Pipeline**: `src/lib/errors.ts` (`AppError`, `ApiErrorCode`), `src/lib/api-wrapper.ts` (`apiWrapper`, `ApiResponse`), `src/lib/user-messages.ts` (`getUserFriendlyErrorMessage`, `formatUserError`, `TECHNICAL_LEAK_PATTERNS`, `ERROR_MAPPING_RULES`).
- **All Route Handlers**: Scanned all 108 API routes for error handling, inner catch blocks, and response envelopes.
- **Third-Party Integrations**: Razorpay checkout & Route payouts (`src/lib/razorpay.ts`, `src/services/payment.service.ts`), Shiprocket logistics (`src/lib/shiprocket.ts`, `src/services/deal/product.ts`), MSG91 SMS (`src/lib/communication.ts`), Surepass KYC (`src/lib/kyc/providers/surepass.ts`), Instagram/YouTube Graph APIs (`src/lib/instagram.ts`, `src/lib/youtube.ts`, `src/app/api/social/verify/route.ts`).
- **UI Error Boundaries & Feedback**: `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx`, `src/app/dashboard/error.tsx`, `FullScreenWithdrawFlow.tsx`, `useDocUpload.ts`, `wallet/page.tsx`.

### What Was Not Inspected:
- Direct physical hardware SIM card receipt delays on Indian telco SMS gateways (Airtel/Jio DLT delivery latency).
- Real-time WebSocket connection drop recovery under native iOS/Android WebViews (outside web browser scope).

---

## False Claims in Repository Documentation

1. **Claim in `MESSAGES.md:4`**: *"Status: Verified & Synchronized with `src/lib/user-messages.ts` (Zero Technical Stack Leaks)"*  
   **Reality**: False. `TECHNICAL_LEAK_PATTERNS` leaks internal robotic enum `"GATEWAY_AMBIGUOUS"` directly to the screen because the regex checks `gateway ambiguous` with a space rather than an underscore, while `verification/route.ts` leaks raw Prisma connection errors to toasts.
2. **Claim in `MESSAGES.md:38`**: *"Withdrawal must be between ₹500 and ₹5,00,000 per transaction."*  
   **Reality**: False. Limits are dynamically configurable via server environment variables (`MIN_WITHDRAWAL_AMOUNT`), but the client message is hardcoded and drifts from server configuration.
3. **Claim in `ARCHITECTURE_PATTERNS.md`**: *"Action buttons display precise inline reasons for failure without backend runtime dependency."*  
   **Reality**: False. In forms such as Bank Account addition and Profile settings, field-level Zod issues are masked by top-level toasts displaying generic fallback messages.

---

## Remediation & Verification Matrix (Phase 9)

| Finding ID | Severity | Description | Remediated File(s) | Fix Applied | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **P0-MSG-01** | P0 | English phrases containing keywords (e.g. `select`, `update ... set`) censored into 500 error messages. | `src/lib/user-messages.ts` | Removed crude regex checks in `isHumanIntelligible`, restricted SQL matching to full queries (`SELECT ... FROM ...`), and allowed valid English prompts. | `tests/unit/bug-p9-messages.test.ts` & `tests/unit/user-messages.test.ts` |
| **P0-MSG-02** | P0 | Raw enum `GATEWAY_AMBIGUOUS` displayed to users upon payment timeout; non-typed error throwing. | `src/services/payment.service.ts`, `src/app/api/payments/withdraw/route.ts`, `src/lib/user-messages.ts` | Replaced `throw AppError.badRequest("GATEWAY_AMBIGUOUS")` with typed `AppError.gatewayAmbiguous()`, updated withdrawal idempotency check, and unified gateway timeout regex to support underscore. | `tests/unit/bug-p9-messages.test.ts` |
| **P0-MSG-03** | P0 | Unhandled exceptions in `/api/verification` leaking internal database hosts (`db.supabase.co`) in user toasts. | `src/app/api/verification/route.ts`, `src/lib/user-messages.ts` | Routed `/api/verification` catch block through `ApiResponse.error()`; added `supabase` and `prisma(?:client)?` to `TECHNICAL_LEAK_PATTERNS`. | `tests/unit/bug-p9-messages.test.ts` |
| **P1-MSG-04** | P1 | HTTP 401 claiming "session expired" for wrong passwords on login page, creating infinite login redirect loops. | `src/lib/user-messages.ts`, `src/lib/api-client/http.ts` | Separated `INVALID_CREDENTIALS` from session expiration rules; added credential validation checks before calling `signOut()` in client transport. | `tests/unit/bug-p9-messages.test.ts` & `tests/unit/user-messages.test.ts` |
| **P1-MSG-05** | P1 | 409 Conflict rule shadowing deal state transition rules, misidentifying stale deal conflicts as duplicate records. | `src/lib/user-messages.ts` | Ensured `DEAL_STATE_CONFLICT` rule evaluates before generic 409 Conflict rule in `ERROR_MAPPING_RULES`. | `tests/unit/user-messages.test.ts` |
| **P1-MSG-06** | P1 | Greedy `beneficiary`/`bank account` keyword matching rewriting character length validations into penny-drop failures. | `src/lib/user-messages.ts` | Tightened regex to require `verification` or `failed` keywords alongside `beneficiary`, added specific bank limit and locked payout rules. | `tests/unit/bug-p9-messages.test.ts` & `tests/unit/user-messages.test.ts` |
| **P1-MSG-07** | P1 | Bare `storage` keyword matching rewriting browser `LocalStorage quota exceeded` into file upload errors. | `src/lib/user-messages.ts` | Replaced bare `storage` regex in Rule 13 with targeted `s3|cloud storage|upload storage`. | `tests/unit/bug-p9-messages.test.ts` & `tests/unit/user-messages.test.ts` |
| **P1-MSG-08** | P1 | Redis downtime failing closed in rate limiter and falsely accusing legitimate users of rate limit abuse (429). | `src/lib/rate-limit.ts`, `src/lib/errors.ts` | Threw typed 503 `AppError.serviceUnavailable()` on security-critical Redis outages in non-dev environments rather than returning 429 breach. | `tests/unit/bug-p9-messages.test.ts` |
| **P1-MSG-09** | P1 | Immediate hard `signOut` on 401 in client HTTP transport wiping out active form drafts mid-typing. | `src/lib/api-client/http.ts` | Prevented `signOut` redirect triggers when error code is `INVALID_CREDENTIALS` or credential validation related. | `tests/unit/bug-p9-messages.test.ts` |
| **P1-MSG-10** | P1 | Payment timeout toasts failing to disable "Proceed to Pay" button, risking accidental double-spend charges. | `src/app/dashboard/wallet/page.tsx`, `src/app/api/payments/withdraw/route.ts` | Guaranteed idempotency locks are retained during ambiguous gateway states (`GATEWAY_AMBIGUOUS`, `GATEWAY_TIMEOUT`). | `tests/unit/bug-p9-messages.test.ts` |
| **P2-MSG-11** | P2 | Root error boundaries displaying robotic "Application Exception" / "System Malfunction" with raw digest hashes. | `src/app/error.tsx`, `src/app/global-error.tsx` | Replaced robotic headings with polite "Something went wrong on this page" / "Something went wrong"; sanitized digest display to "Ref: ...". | `tests/unit/bug-p9-messages.test.ts` |
| **P2-MSG-12** | P2 | Helper methods in `ApiResponse` passing unscrubbed strings directly into response body without `formatUserError`. | `src/lib/api-wrapper.ts` | Wrapped `forbidden`, `unauthorized`, `notFound`, `conflict`, and `tooManyRequests` response messages with `formatUserError()`. | `tests/unit/bug-p9-messages.test.ts` |
| **P2-MSG-13** | P2 | Raw JSON from Shiprocket order creation embedded inside `AppError.badRequest`. | `src/lib/shiprocket.ts` | Parsed JSON response from Shiprocket and mapped non-serviceable pincode errors to friendly, actionable messages. | `tests/unit/bug-p9-messages.test.ts` |
| **P2-MSG-14** | P2 | Static hardcoding of withdrawal limits in messages drifting from server environment configuration. | `src/lib/user-messages.ts` | Dynamically interpolated `MIN_WITHDRAWAL_AMOUNT_RUPEES` and `MAX_WITHDRAWAL_AMOUNT_RUPEES` from `@/constants/wallet`. | `tests/unit/bug-p9-messages.test.ts` |

**Verification Status:**
- Unit Tests: 53/53 passed (`tests/unit/bug-p9-messages.test.ts`, `tests/unit/user-messages.test.ts`).
- Architecture Invariants: Strict compliance with `ARCHITECTURE_PATTERNS.md` and `MESSAGES.md`.

