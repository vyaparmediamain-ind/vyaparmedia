/**
 * Deal Lifecycle, Smart Contract Terms & Dispute Constants
 */

// Deal Deadlines & Periods
export const DEFAULT_BRAND_REVIEW_PERIOD_HOURS = 48; // 48-hour brand content review window
export const MAX_BRAND_REVIEW_PERIOD_HOURS = 168; // Maximum 7 days allowable for custom review window
export const DEAL_SIGNING_WINDOW_HOURS = 72; // 72 hours window for digital contract signing
export const POST_MONITORING_WINDOW_DAYS = 30; // 30 days mandatory post monitoring for deletion/clawback

// Revisions & Re-shoots
export const DEFAULT_INCLUDED_REVISIONS = 2;
export const DEFAULT_COST_PER_EXTRA_REVISION_PAISE = 50_000; // ₹500 per extra content revision

// Contract Terms & Cancellation Fee Schedule (Default Percentages)
export const DEFAULT_CANCELLATION_FEE_AFTER_APPROVAL_PERCENT = 30; // 30% fee if cancelled after initial concept approved
export const DEFAULT_CANCELLATION_FEE_AFTER_SUBMISSION_PERCENT = 70; // 70% fee if cancelled after deliverables submitted
export const DEFAULT_CANCELLATION_FEE_AFTER_POSTING_PERCENT = 100; // 100% full payment due once published
export const DEFAULT_BRAND_LATE_APPROVAL_FEE_PERCENT = 10; // 10% penalty for brand review delay
export const DEFAULT_BRAND_PLATFORM_FEE_PERCENT = 10; // 10% standard platform fee
export const DEFAULT_GATEWAY_FEE_PERCENT = 2; // 2% payment gateway processing fee
export const DEFAULT_PRODUCT_HANDLING_FEE_PERCENT = 2; // 2% product handling fee for seeded campaigns

// Deal Query Limits
export const DEFAULT_DEAL_LIST_LIMIT = 10;
export const MAX_DEAL_LIST_LIMIT = 50;
