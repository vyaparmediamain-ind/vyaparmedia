/**
* Zod Validation Schemas - All input validation
*/

import { z } from "zod";
import { MIN_WITHDRAWAL_AMOUNT_PAISE, MAX_WITHDRAWAL_AMOUNT_PAISE } from "@/constants/wallet";

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
isAdult: z
  .boolean({ message: "Age declaration is required" })
  .refine((val) => val === true, {
    message: "You must be at least 18 years of age to register on VyaparMedia (DPDPA 2023 & Indian Contract Act compliance).",
  })
  .default(true),
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
targetAgeMin: z.number().int().min(18, "Target age must be at least 18 (DPDPA 2023 & Indian Contract Act compliance)").max(100).nullable().optional(),
targetAgeMax: z.number().int().min(18, "Target age must be at least 18").max(100).nullable().optional(),
minFollowers: z.number().int().min(0).optional().default(0),
maxFollowers: z.number().int().min(1, "Max followers is required"),
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
matchingPriority: z.enum(["BALANCED", "REACH_FOCUSED", "TRUST_FOCUSED", "ROI_FOCUSED", "CUSTOM"]).optional().default("BALANCED"),
customWeights: z.object({
  category: z.number().min(0).max(1),
  engagement: z.number().min(0).max(1),
  authenticity: z.number().min(0).max(1),
  quality: z.number().min(0).max(1),
  roi: z.number().min(0).max(1),
}).optional(),
})
.superRefine((value, ctx) => {
  validateBudgetSettings(value, ctx);
  validateProductSettings(value, ctx);
  validateBudgetLimitsAndAges(value, ctx);
  validateDeadlineSettings(value, ctx);
})
interface CampaignValidationValue {
  requiresProduct?: boolean | undefined;
  totalBudget: number;
  perInfluencerBudget?: number | undefined;
  productValue?: number | undefined;
  minFollowers?: number | undefined;
  targetAgeMin?: number | null | undefined;
  targetAgeMax?: number | null | undefined;
  applicationDeadline?: string | undefined;
  contentDeadline?: string | undefined;
  postingDeadline?: string | undefined;
}

function validateDeadlineSettings(value: CampaignValidationValue, ctx: z.RefinementCtx) {
  if (value.contentDeadline && value.postingDeadline) {
    const contentDate = new Date(value.contentDeadline);
    const postingDate = new Date(value.postingDeadline);
    if (!Number.isNaN(contentDate.getTime()) && !Number.isNaN(postingDate.getTime())) {
      if (postingDate < contentDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["postingDeadline"],
          message: "Posting deadline must be after content deadline",
        });
      }
      if (value.applicationDeadline) {
        const appDate = new Date(value.applicationDeadline);
        if (!Number.isNaN(appDate.getTime()) && appDate > contentDate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["applicationDeadline"],
            message: "Application deadline must be before or on content deadline",
          });
        }
      }
    }
  }
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
action: z.literal("create_shiprocket_shipment"),
pickupLocation: z.string().trim().max(100).optional(),
length: z.number().min(1).max(200).optional(),
breadth: z.number().min(1).max(200).optional(),
height: z.number().min(1).max(200).optional(),
weight: z.number().min(0.01).max(50).optional(),
}),
z.object({
action: z.literal("confirm_received"),
}),
]);



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

export const reviewSchema = z.object({
dealId: dbIdSchema,
receiverId: dbIdSchema.optional(),
rating: z.number().int("Standard reviews are integer amounts").min(1).max(5),
comment: z.string().trim().max(500).optional(),
communicationRating: z.number().int().min(1).max(5).optional(),
qualityRating: z.number().int().min(1).max(5).optional(),
timelinessRating: z.number().int().min(1).max(5).optional(),
});

export const clientSendableMessageTypes = [
  "TEXT",
  "IMAGE",
  "VIDEO",
  "DOCUMENT",
  "FILE",
  "PROPOSAL",
  "CONTRACT_ACCEPTANCE",
  "DEAL_TERMS",
  "PAYMENT_REQUEST",
  "APPROVAL",
  "OFFER",
] as const;

export type ClientSendableMessageType = (typeof clientSendableMessageTypes)[number];

export const messageSchema = z.object({
  dealId: dbIdSchema.optional(),
  receiverId: dbIdSchema,
  content: z
    .string()
    .trim()
    .max(2000, "Message truncated. Avoid lengthy chats over 2000chars limit.")
    .optional()
    .default(""),
  messageType: z.enum(clientSendableMessageTypes).optional().default("TEXT"),
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
  // Restrict metadata to a safe, typed shape
  metadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
});

export const sendMessageSchema = messageSchema;

export type RegisterInput = z.infer<typeof registerSchema>;
export interface ApplicationInput {
  campaignId: string;
  proposal: string;
  proposedRate: number;
  estimatedDelivery?: string | undefined;
  estimatedDeliveryDays?: number | undefined;
}

export const shiprocketWebhookScanSchema = z
  .object({
    date: z.string().max(100).optional(),
    time: z.string().max(100).optional(),
    status: z.string().max(100).optional(),
    activity: z.string().max(255).optional(),
    location: z.string().max(255).optional(),
    city: z.string().max(255).optional(),
    "sr-status-label": z.string().max(255).optional(),
  })
  .passthrough();

export const shiprocketWebhookPayloadSchema = z
  .object({
    awb: z.union([z.string(), z.number()]).transform((v) => String(v).trim()).optional(),
    awb_code: z.union([z.string(), z.number()]).transform((v) => String(v).trim()).optional(),
    tracking_number: z.union([z.string(), z.number()]).transform((v) => String(v).trim()).optional(),
    order_id: z.union([z.string(), z.number()]).transform((v) => String(v).trim()).optional(),
    current_status: z.string().max(100).optional(),
    status: z.string().max(100).optional(),
    courier_name: z.string().max(100).optional(),
    scans: z.array(z.union([z.string(), z.record(z.string(), z.unknown())])).optional(),
    shipment_track_activities: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough()
  .refine(
    (data) =>
      Boolean(
        (data.awb && data.awb.length > 0) ||
          (data.awb_code && data.awb_code.length > 0) ||
          (data.tracking_number && data.tracking_number.length > 0) ||
          (data.order_id && data.order_id.length > 0),
      ),
    {
      message: "Webhook payload must contain at least one of awb, awb_code, tracking_number, or order_id",
    },
  );

export type ShiprocketWebhookPayload = z.infer<typeof shiprocketWebhookPayloadSchema>;

/* ==========================================================================
   Auth & Account Management Schemas
   ========================================================================== */

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "New passwords do not match",
    path: ["confirmNewPassword"],
  });

export const taxComplianceSchema = z.object({
  pan: z
    .string()
    .regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN format (e.g. ABCDE1234F)")
    .or(z.literal("")),
  gstin: z
    .string()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Invalid GSTIN format (15 characters)")
    .or(z.literal("")),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const bankAccountSchema = z
  .object({
    payoutType: z.enum(["bank", "upi"]),
    accountName: z
      .string()
      .min(2, "Beneficiary name must be at least 2 characters")
      .max(100, "Beneficiary name cannot exceed 100 characters"),
    accountNumber: z.string().optional().or(z.literal("")),
    ifscCode: z.string().optional().or(z.literal("")),
    bankName: z.string().optional().or(z.literal("")),
    upiId: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.payoutType === "bank") {
      if (
        !data.accountNumber ||
        data.accountNumber.length < 9 ||
        data.accountNumber.length > 18 ||
        !/^\d+$/.test(data.accountNumber)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter a valid 9 to 18 digit account number",
          path: ["accountNumber"],
        });
      }
      if (!data.ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(data.ifscCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter a valid 11-digit IFSC code (e.g. SBIN0001234)",
          path: ["ifscCode"],
        });
      }
      if (!data.bankName || data.bankName.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter a valid bank name",
          path: ["bankName"],
        });
      }
    } else if (data.payoutType === "upi") {
      if (!data.upiId || !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(data.upiId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter a valid UPI ID (e.g. user@okaxis)",
          path: ["upiId"],
        });
      }
    }
  });

export const deleteAccountSchema = z.object({
  confirmText: z.literal("DELETE", {
    message: "Please type DELETE to confirm",
  }),
  password: z.string().min(1, "Password is required to delete your account"),
  reason: z.string().max(500, "Reason cannot exceed 500 characters").optional(),
});

/* ==========================================================================
   Campaign UI Form, Dispute & Support Schemas
   ========================================================================== */

export const campaignFormSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(100, "Title cannot exceed 100 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description cannot exceed 2000 characters"),
  requirements: z
    .string()
    .min(10, "Requirements must be at least 10 characters")
    .max(2000, "Requirements cannot exceed 2000 characters"),
  perInfluencerBudget: z
    .number({ message: "Budget per influencer must be a number" })
    .min(0, "Budget per influencer cannot be negative")
    .max(1000000, "Maximum budget per influencer is 10,00,000"),
  maxInfluencers: z
    .number({ message: "Influencer count must be a number" })
    .min(1, "Campaign must accept at least 1 influencer")
    .max(100, "Maximum 100 influencers per campaign"),
  minFollowers: z
    .number()
    .min(0, "Minimum followers cannot be negative"),
  targetCategories: z
    .array(z.string())
    .min(1, "Please select at least one target category"),
  applicationDeadline: z.string().optional(),
  postingDeadline: z.string().min(1, "Posting deadline date is required"),
  matchingPriority: z.enum(["BALANCED", "REACH_FOCUSED", "TRUST_FOCUSED", "ROI_FOCUSED", "CUSTOM"]).optional().default("BALANCED"),
  customWeights: z.object({
    category: z.number().min(0).max(1),
    engagement: z.number().min(0).max(1),
    authenticity: z.number().min(0).max(1),
    quality: z.number().min(0).max(1),
    roi: z.number().min(0).max(1),
  }).optional(),
});

export const createDisputeSchema = z.object({
  type: z.enum(["QUALITY", "TIMELINE", "PAYMENT", "CONTENT_DELETED", "TERMS_VIOLATION", "OTHER"]),
  description: z.string().min(50, "Please describe the issue in at least 50 characters.").max(2000, "Description cannot exceed 2000 characters"),
});

export const createSupportSchema = z.object({
  type: z.enum(["BUG", "FEEDBACK"]),
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(100, "Title cannot exceed 100 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(1000, "Description cannot exceed 1000 characters"),
  screenshotUrl: z
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
    }, "Please provide a valid URL or local path")
    .or(z.literal(""))
    .optional(),
});

/* ==========================================================================
   Wallet & Payout Schemas
   ========================================================================== */

export const withdrawalSchema = z.object({
  amount: z.preprocess(
    Number,
    z
      .number()
      .int()
      .positive()
      .min(
        MIN_WITHDRAWAL_AMOUNT_PAISE,
        `Minimum withdrawal is INR ${MIN_WITHDRAWAL_AMOUNT_PAISE / 100}`,
      )
      .max(
        MAX_WITHDRAWAL_AMOUNT_PAISE,
        `Maximum single withdrawal is INR ${MAX_WITHDRAWAL_AMOUNT_PAISE / 100}`,
      ),
  ),
  bankAccountId: z.string().min(1, "bankAccountId is required — use a verified saved bank account"),
});
