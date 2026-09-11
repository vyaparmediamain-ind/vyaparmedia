import { z } from "zod";

export const createCampaignSchema = z.object({
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
