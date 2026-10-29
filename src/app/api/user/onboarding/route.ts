import { apiWrapper, ApiResponse, ValidatedNextRequest } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";
import { z } from "zod";

const onboardingSchema = z.object({
  userType: z.enum(["INFLUENCER", "BRAND"]).optional(),
  // Creator / Influencer Fields
  displayName: z.string().trim().min(2, "Name must be at least 2 characters").max(50).optional(),
  bio: z.string().trim().max(500, "Bio cannot exceed 500 characters").optional(),
  city: z.string().trim().max(50).optional(),
  state: z.string().trim().max(50).optional(),
  categories: z.array(z.string().trim()).min(1, "Please select at least 1 category").optional(),
  languages: z.array(z.string().trim()).min(1, "Please select at least 1 language").optional(),
  instagramHandle: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._]*$/, "Invalid Instagram handle")
    .max(50)
    .optional()
    .nullable(),
  youtubeHandle: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._@\-]*$/, "Invalid YouTube handle")
    .max(50)
    .optional()
    .nullable(),
  minRateInr: z.number().nonnegative().optional(),

  // Brand Fields
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters").max(80).optional(),
  industry: z.string().trim().max(60).optional(),
  website: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(500).optional(),
});

/**
 * GET /api/user/onboarding
 * Fetches current onboarding progress and existing details
 */
export const GET = apiWrapper(
  async (req: ValidatedNextRequest) => {
    const userId = req.session?.user?.id;
    if (!userId) {
      throw AppError.unauthorized("Authentication required");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        userType: true,
        verificationLevel: true,
        influencerProfile: {
          select: {
            displayName: true,
            bio: true,
            city: true,
            state: true,
            categories: true,
            languages: true,
            instagramHandle: true,
            youtubeHandle: true,
            minRate: true,
          },
        },
        brandProfile: {
          select: {
            companyName: true,
            description: true,
            website: true,
            city: true,
            state: true,
          },
        },
      },
    });

    if (!user) {
      throw AppError.notFound("User not found");
    }

    const isInfluencer = user.userType === "INFLUENCER";
    const profile = isInfluencer ? user.influencerProfile : user.brandProfile;
    
    // Check if onboarding is already completed
    let isCompleted = false;
    if (isInfluencer && user.influencerProfile) {
      isCompleted = Boolean(
        user.influencerProfile.city &&
        user.influencerProfile.categories &&
        user.influencerProfile.categories !== "General"
      );
    } else if (!isInfluencer && user.brandProfile) {
      isCompleted = Boolean(
        user.brandProfile.companyName &&
        user.brandProfile.city
      );
    }

    return ApiResponse.success({
      userType: user.userType,
      email: user.email,
      isCompleted,
      profile,
    });
  },
  { requireAuth: true }
);

/**
 * POST /api/user/onboarding
 * Completes or updates onboarding details
 */
export const POST = apiWrapper(
  async (req: ValidatedNextRequest) => {
    const userId = req.session?.user?.id;
    if (!userId) {
      throw AppError.unauthorized("Authentication required");
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = onboardingSchema.safeParse(body);

    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw AppError.badRequest(firstIssue?.message || "Invalid onboarding submission data");
    }

    const data = parseResult.data;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, userType: true },
    });

    if (!user) {
      throw AppError.notFound("User not found");
    }

    // Allow user to confirm / change userType if not locked
    const effectiveUserType = data.userType || user.userType;
    if (data.userType && data.userType !== user.userType) {
      await prisma.user.update({
        where: { id: userId },
        data: { userType: data.userType },
      });
    }

    if (effectiveUserType === "INFLUENCER") {
      const cleanInsta = data.instagramHandle ? data.instagramHandle.replace(/^@/, "").trim() : undefined;
      const cleanYt = data.youtubeHandle ? data.youtubeHandle.replace(/^@/, "").trim() : undefined;
      const minRatePaise = data.minRateInr ? Math.round(data.minRateInr * 100) : undefined;

      await prisma.influencerProfile.upsert({
        where: { userId },
        create: {
          userId,
          displayName: data.displayName || "Creator",
          bio: data.bio || null,
          city: data.city || null,
          state: data.state || null,
          categories: data.categories?.join(", ") || "Lifestyle",
          languages: data.languages?.join(", ") || "English, Hindi",
          instagramHandle: cleanInsta || null,
          youtubeHandle: cleanYt || null,
          minRate: minRatePaise || null,
          minInstagramRate: minRatePaise || null,
        },
        update: {
          ...(data.displayName ? { displayName: data.displayName } : {}),
          ...(data.bio !== undefined ? { bio: data.bio } : {}),
          ...(data.city ? { city: data.city } : {}),
          ...(data.state ? { state: data.state } : {}),
          ...(data.categories ? { categories: data.categories.join(", ") } : {}),
          ...(data.languages ? { languages: data.languages.join(", ") } : {}),
          ...(cleanInsta !== undefined ? { instagramHandle: cleanInsta } : {}),
          ...(cleanYt !== undefined ? { youtubeHandle: cleanYt } : {}),
          ...(minRatePaise !== undefined ? { minRate: minRatePaise, minInstagramRate: minRatePaise } : {}),
        },
      });
    } else {
      await prisma.brandProfile.upsert({
        where: { userId },
        create: {
          userId,
          companyName: data.companyName || "Brand Partner",
          description: data.description || null,
          city: data.city || null,
          state: data.state || null,
          website: data.website || null,
        },
        update: {
          ...(data.companyName ? { companyName: data.companyName } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.city ? { city: data.city } : {}),
          ...(data.state ? { state: data.state } : {}),
          ...(data.website !== undefined ? { website: data.website } : {}),
        },
      });
    }

    return ApiResponse.success(
      {
        completed: true,
        redirectUrl: effectiveUserType === "BRAND" ? "/dashboard/campaigns/create" : "/dashboard",
      },
      "Onboarding completed successfully! Welcome to VyaparMedia."
    );
  },
  { requireAuth: true }
);
