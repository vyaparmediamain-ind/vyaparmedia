import { z } from "zod";

export const UserTypeEnum = z.enum(["INFLUENCER", "BRAND", "SCOUT", "ADMIN"]);
export type GuideUserType = z.infer<typeof UserTypeEnum>;

export const GuideAreaEnum = z.enum([
  "deals",
  "wallet",
  "campaigns",
  "disputes",
  "kyc",
  "scout",
  "analytics",
  "security",
  "compliance",
  "messages",
  "profile",
  "admin",
  "system",
  "general",
]);
export type GuideArea = z.infer<typeof GuideAreaEnum>;

export const BilingualTextSchema = z.object({
  en: z.string().min(1, "English text required"),
  hinglish: z.string().min(1, "Hinglish text required"),
});
export type BilingualText = z.infer<typeof BilingualTextSchema>;

export const GuideStepSchema = z.object({
  title: BilingualTextSchema,
  body: BilingualTextSchema,
  uiRef: z.string().optional(),
});
export type GuideStep = z.infer<typeof GuideStepSchema>;

export const GuideNumberExplainedSchema = z.object({
  label: BilingualTextSchema,
  description: BilingualTextSchema,
});
export type GuideNumberExplained = z.infer<typeof GuideNumberExplainedSchema>;

export const GuideCommonErrorSchema = z.object({
  symptom: BilingualTextSchema,
  cause: BilingualTextSchema,
  fix: BilingualTextSchema,
});
export type GuideCommonError = z.infer<typeof GuideCommonErrorSchema>;

export const GuideFaqSchema = z.object({
  question: BilingualTextSchema,
  answer: BilingualTextSchema,
});
export type GuideFaq = z.infer<typeof GuideFaqSchema>;

export const GuideSupportCtaSchema = z.object({
  label: BilingualTextSchema,
  href: z.string().min(1),
});
export type GuideSupportCta = z.infer<typeof GuideSupportCtaSchema>;

export const GuideSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "ID must be lowercase kebab-case slug"),
  roles: z.array(UserTypeEnum).min(1, "At least one role required"),
  area: GuideAreaEnum,
  featureKey: z.string().optional(),
  routes: z.array(z.string().min(1)).min(1, "At least one route pattern required"),
  title: BilingualTextSchema,
  summary: BilingualTextSchema,
  whenToUse: BilingualTextSchema,
  steps: z.array(GuideStepSchema).min(1, "At least one step required"),
  rules: z.array(BilingualTextSchema).default([]),
  numbersExplained: z.array(GuideNumberExplainedSchema).default([]),
  commonErrors: z.array(GuideCommonErrorSchema).default([]),
  faqs: z.array(GuideFaqSchema).default([]),
  related: z.array(z.string()).default([]),
  supportCta: GuideSupportCtaSchema.optional(),
  lastReviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Semantic version: X.Y.Z"),
});

export type Guide = z.infer<typeof GuideSchema>;

export const GlossaryTermCategoryEnum = z.enum([
  "FINANCE",
  "TAX",
  "DEALS",
  "REPUTATION",
  "SECURITY",
  "TECHNICAL",
  "METRICS",
  "COMPLIANCE",
]);
export type GlossaryTermCategory = z.infer<typeof GlossaryTermCategoryEnum>;

export const GlossaryTermSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "ID must be lowercase kebab-case slug"),
  term: BilingualTextSchema,
  definition: BilingualTextSchema,
  category: GlossaryTermCategoryEnum,
  relatedTerms: z.array(z.string()).default([]),
  example: BilingualTextSchema.optional(),
});
export type GlossaryTerm = z.infer<typeof GlossaryTermSchema>;

