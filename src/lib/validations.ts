/**
* Zod Validation Schemas - All input validation
*/

import { z } from "zod";

/**
* Database primary ID checker.
* Prisma defaults to CUIDs, but legacy imports and seeded records can use
* URL-safe string IDs. Ownership checks still happen at the service layer.
*/
export const dbIdSchema = z
.string()
.trim()
.min(1, "Invalid reference ID")
.max(128, "Invalid reference ID")
.regex(/^[A-Za-z0-9_-]+$/, "Invalid reference ID");

/**
* Route parameter schema for [id] routes.
* Used for validating dynamic route parameters like /api/resource/[id]
*/
export const routeParamsSchema = z.object({ id: dbIdSchema });

/**
* Pagination schema for query parameters.
* Used for validating page and limit parameters across all paginated endpoints.
*/
export const paginationSchema = z.object({
page: z.preprocess(
(val) => (val === undefined ? undefined : Number(val)),
z.number().int().min(1).default(1)
),
limit: z.preprocess(
(val) => (val === undefined ? undefined : Number(val)),
z.number().int().min(1).max(100).default(20)
),
});

/**
* Indian Phone Number Schema (10 digits starting with 6-9).
*/
export const phoneSchema = z
.string({ message: "Phone number is required" })
.regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian phone number");

/**
* Standard Email Schema with transform.
*/
export const emailSchema = z
.string({ message: "Email is required" })
.email("Please provide a valid email address")
.transform((v) => v.toLowerCase().trim());

/**
* Strong password enforcement logic.
*/
export const passwordSchema = z
.string({ message: "Password is required" })
.min(8, "Password must be at least 8 characters long")
.max(100, "Password length exceeds maximum allowed")
.regex(/[A-Z]/, "Password must contain at least one uppercase letter (A-Z)")
.regex(/[a-z]/, "Password must contain at least one lowercase letter (a-z)")
.regex(/\d/, "Password must contain at least one number (0-9)")
.regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");


// ==================== AUTH SCHEMAS ====================

export const registerSchema = z.object({
name: z
.string({ message: "Name is required" })
.trim()
.min(2, "Name must be at least 2 characters long")
.max(80, "Name cannot exceed 80 characters"),
email: emailSchema,
phone: phoneSchema,
password: passwordSchema,
userType: z.enum(["INFLUENCER", "BRAND"]),
referralCode: z
.string()
.trim()
.regex(/^[A-Z0-9]+$/, "Referral code can only contain uppercase letters and numbers")
.optional(),
emailOtpVerified: z.boolean().default(false),
phoneOtpVerified: z.boolean().default(false),
});

export const loginSchema = z.object({
email: emailSchema,
password: z.string().min(1, "Password is required to login"),
twoFactorCode: z
.string()
.transform((val) => (val === "" ? undefined : val)) // Convert empty string to undefined
.refine((val) => val === undefined || (val.length === 6 && /^\d+$/.test(val)), {
message: "2FA Code must be exactly 6 digits",
})
.optional(),
});
// ==================== CAMPAIGN SCHEMAS ====================

export const createCampaignSchema = z
.object({
title: z.string().min(3),
description: z.string().min(10),
requirements: z.string().min(10),
guidelines: z.string().max(3000).optional(),

totalBudget: z.number().int().min(0, "Minimum campaign budget is 0"),
perInfluencerBudget: z.number().int().min(0, "Minimum per-influencer budget is 0").optional(),
maxInfluencers: z.number().int().min(1).max(100).nullable().optional(),

targetCategories: z.array(z.string().min(1)).min(1),
targetCities: z.array(z.string().min(1)).optional().default([]),
targetLanguages: z.array(z.string().min(1)).optional().default([]),
targetGender: z.enum(["ANY", "MALE", "FEMALE"]).optional(),
targetAgeMin: z.number().int().min(13).max(100).nullable().optional(),
targetAgeMax: z.number().int().min(13).max(100).nullable().optional(),
minFollowers: z.number().int().min(0).optional().default(0),
maxFollowers: z.number().int().min(0).optional().default(0),
minEngagementRate: z.number().int().min(0).optional(),

applicationDeadline: z.string().datetime().optional(),
contentDeadline: z.string().datetime(),
postingDeadline: z.string().datetime(),

deliverables: z
.array(
z.object({
type: z.string().min(1),
count: z.number().int().min(1).max(50),
rate: z.number().int().min(0).optional(),
specs: z.string().max(500).optional(),
}),
)
.min(1),

requiresProduct: z.boolean().optional().default(false),
productName: z.string().max(200).optional(),
productValue: z.number().int().min(0).optional(),
productDescription: z.string().max(5000).optional(),

invitedInfluencerId: dbIdSchema.optional(),
status: z.enum(["DRAFT", "ACTIVE"]).optional(),
})
.superRefine((value, ctx) => {
  validateBudgetSettings(value, ctx);
  validateProductSettings(value, ctx);
  validateBudgetLimitsAndAges(value, ctx);
})
interface CampaignValidationValue {
  requiresProduct?: boolean | undefined;
  totalBudget: number;
  perInfluencerBudget?: number | undefined;
  productValue?: number | undefined;
  minFollowers?: number | undefined;
  targetAgeMin?: number | null | undefined;
  targetAgeMax?: number | null | undefined;
}

function validateBudgetSettings(value: CampaignValidationValue, ctx: z.RefinementCtx) {
  const isProductOnly = value.requiresProduct && value.totalBudget === 0;
  if (!isProductOnly) {
    if (value.totalBudget < 1000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["totalBudget"],
        message: "Minimum campaign budget is 1,000",
      });
    }
    if (value.perInfluencerBudget !== undefined && value.perInfluencerBudget < 500) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["perInfluencerBudget"],
        message: "Minimum per-influencer budget is 500",
      });
    }
  }
}

function validateProductSettings(value: CampaignValidationValue, ctx: z.RefinementCtx) {
  if (value.requiresProduct && value.totalBudget === 0) {
    if (value.productValue === undefined || value.productValue < 500) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["productValue"],
        message: "Product-only campaigns must specify a product value of at least 500",
      });
    }
    if (value.minFollowers !== undefined && value.minFollowers > 10000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minFollowers"],
        message: "Product-only campaigns must target influencers with up to 10,000 followers",
      });
    }
  }
}

function validateBudgetLimitsAndAges(value: CampaignValidationValue, ctx: z.RefinementCtx) {
  if (
    value.perInfluencerBudget !== undefined &&
    value.perInfluencerBudget > value.totalBudget
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["perInfluencerBudget"],
      message: "Per influencer budget cannot exceed total budget",
    });
  }

  if (
    value.targetAgeMin !== null &&
    value.targetAgeMin !== undefined &&
    value.targetAgeMax !== null &&
    value.targetAgeMax !== undefined &&
    value.targetAgeMin > value.targetAgeMax
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetAgeMax"],
      message: "Maximum age must be greater than or equal to minimum age",
    });
  }
}



// ==================== APPLICATION SCHEMAS ====================

export const createApplicationSchema = z.object({
  campaignId: dbIdSchema,
  proposal: z.string().min(10, "Proposal must be at least 10 characters"),
  // M22 FIX: Must be a positive integer (paise); floats and overflow values rejected.
  // Max 1,00,00,000 paise = ₹1,00,000 (1 lakh) to prevent integer overflow and unrealistic rates.
  proposedRate: z.number().int("Proposed rate must be a whole number").positive("Proposed rate must be positive").max(10_000_000, "Proposed rate exceeds maximum allowed value"),
  estimatedDeliveryDays: z.number().int().positive().max(90).optional(),
});

const contentSubmissionItemSchema = z.object({
type: z.string().trim(),
url: z
.string()
.trim()
.max(500, "Submitted URL is too long")
.refine(
(val) => {
if (val.includes("<") || val.includes(">")) return false;
if (val.startsWith("/")) return true;
try {
const u = new URL(val);
return u.protocol === "https:";
} catch {
return false;
}
},
"Only secure (HTTPS) URLs or valid local paths are allowed",
),
});

export const contentSubmissionSchema = z.object({
dealId: dbIdSchema,
contentUrl: z
.string()
.trim()
.max(500, "Submitted URL is too long")
.refine(
(val) => {
if (val.includes("<") || val.includes(">")) return false;
if (val.startsWith("/")) return true;
try {
const u = new URL(val);
return u.protocol === "https:";
} catch {
return false;
}
},
"Only secure (HTTPS) URLs or valid local paths are allowed",
)
.optional(),
contentUrls: z.array(contentSubmissionItemSchema).optional(),
notes: z.string().trim().max(500, "Notes attached are exceeding limit").optional(),
});

const deliverableReviewSchema = z.object({
type: z.string().trim(),
status: z.enum(["APPROVED", "REVISION_REQUESTED"]),
feedback: z.string().trim().optional(),
});

export const contentApprovalSchema = z.object({
dealId: dbIdSchema,
approved: z.boolean(),
feedback: z.string().trim().max(500).optional(),
reviews: z.array(deliverableReviewSchema).optional(),
}).refine(data => data.approved || data.reviews?.some(r => r.status === "REVISION_REQUESTED") || (!!data.feedback && data.feedback.length > 0), {
message: "You must provide feedback if you are requesting revisions",
path: ["feedback"]
});

export const postVerificationSchema = z.object({
dealId: dbIdSchema,
postUrl: z.preprocess(
(val) => {
if (typeof val !== "string") return val;
const trimmed = val.trim();
if (!trimmed) return trimmed;
if (!/^https?:\/\//i.test(trimmed)) {
return `https://${trimmed}`;
}
return trimmed;
},
z
.string()
.trim()
.url("Please provide a valid post URL")
.regex(
/^(https?:\/\/)?(www\.)?(instagram\.com\/(p|reel)\/.+|youtu\.be\/.+|youtube\.com\/(watch\?v=|shorts\/).+)/,
"Currently only YouTube and Instagram are structurally supported for automated verifications",
)
.max(500, "URL too long")
),
});

const shippingAddressSchema = z.object({
fullName: z.string().trim().min(2).max(100),
phone: phoneSchema,
line1: z.string().trim().min(5).max(200),
line2: z.string().trim().max(200).optional(),
city: z.string().trim().min(2).max(80),
state: z.string().trim().min(2).max(80),
pinCode: z.string().trim().regex(/^\d{6}$/, "Must be a valid 6-digit PIN code"),
country: z.string().trim().max(80).optional().default("India"),
});

export const productFulfillmentSchema = z.discriminatedUnion("action", [
z.object({
action: z.literal("submit_address"),
address: shippingAddressSchema,
}),
z.object({
action: z.literal("confirm_dispatch"),
trackingNumber: z.string().trim().min(1).max(120),
carrier: z.string().trim().max(80).optional(),
}),
z.object({
action: z.literal("confirm_received"),
}),
]);


// ==================== DISPUTE SCHEMAS ====================

export const disputeSchema = z.object({
dealId: dbIdSchema,
type: z.enum([
"QUALITY",
"TIMELINE",
"PAYMENT",
"CONTENT_DELETED",
"TERMS_VIOLATION",
"OTHER",
]),
description: z
.string()
.trim()
.min(50, "You must describe the context sufficiently (50 chars min)")
.max(2000, "Dispute bounds are 2000 characters to process concisely"),
});

export const disputeEvidenceSchema = z.object({
  disputeId: dbIdSchema.optional(),
  type: z.enum(["CONTRACT", "DELIVERABLE", "CHAT_LOG", "PAYMENT_PROOF", "OTHER"]),
  url: z
    .string()
    .trim()
    .refine((val) => {
      if (!val) return true;
      if (val.startsWith("/")) return true;
      try {
        const u = new URL(val);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    }, "Evidence link must be a valid URL or local path"),
  description: z.string().trim().min(5, "Description must be at least 5 characters").max(500),
});

// ==================== REVIEW SCHEMAS ====================

export const reviewSchema = z.object({
dealId: dbIdSchema,
receiverId: dbIdSchema.optional(),
rating: z.number().int("Standard reviews are integer amounts").min(1).max(5),
comment: z.string().trim().max(500).optional(),
communicationRating: z.number().int().min(1).max(5).optional(),
qualityRating: z.number().int().min(1).max(5).optional(),
timelinessRating: z.number().int().min(1).max(5).optional(),
});

// ==================== MESSAGE SCHEMAS ====================

export const messageSchema = z.object({
dealId: dbIdSchema.optional(),
receiverId: dbIdSchema,
content: z.string().trim().max(2000, "Message truncated. Avoid lengthy chats over 2000chars limit.").optional().default(""),
messageType: z
.enum(["TEXT", "FILE", "OFFER"])
.optional(),
fileUrl: z
.string()
.trim()
.refine((val) => {
if (!val) return true;
if (val.startsWith("/")) return true;
try {
const u = new URL(val);
return u.protocol === "http:" || u.protocol === "https:";
} catch {
return false;
}
}, "Must be a valid remote asset URL or local path")
.optional(),
// Restrict metadata to a safe, typed shape no arbitrary nested prototype overrides
metadata: z
.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
.optional(),
});

// ==================== TYPE EXPORTS ====================

export type RegisterInput = z.infer<typeof registerSchema>;
export interface ApplicationInput {
  campaignId: string;
  proposal: string;
  proposedRate: number;
  estimatedDelivery?: string | undefined;
  estimatedDeliveryDays?: number | undefined;
}
