import { apiWrapper } from "@/lib/api-wrapper";
import { AppError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { checkMessageForContacts } from "@/lib/contact-filter";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { z } from "zod";
import { Prisma, InfluencerProfile, BrandProfile } from "@prisma/client";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseNotificationPreferences, notificationPreferencesSchema } from "@/lib/utils";
import { isBrand, isInfluencer, hasPermission, hasAnyPermission, getPermissions } from "@/lib/rbac";

const updateProfileSchema = z.object({
  displayName: z.string().optional().nullish(),
  bio: z.string().max(2000).optional().nullish(),
  city: z.string().optional().nullish(),
  state: z.string().optional().nullish(),
  address: z.string().optional().nullish(),
  pinCode: z.string().optional().nullish(),
  gender: z.string().optional().nullish(),
  age: z.preprocess(
    (val) => (val === "" || val === null || val === undefined || Number(val) === 0 ? null : Number(val)),
    z.number().min(13, "Age must be at least 13").max(100, "Age must be under 100").nullable().optional()
  ),
  categories: z.array(z.string()).optional().nullish(),
  languages: z.array(z.string()).optional().nullish(),
  instagramHandle: z
    .string()
    .max(100, "Instagram handle is too long")
    .regex(/^[a-zA-Z0-9._@-]+$/, "Instagram handle contains invalid characters")
    .optional()
    .nullish(),
  youtubeHandle: z
    .string()
    .max(100, "YouTube handle is too long")
    .regex(/^[a-zA-Z0-9._@-]+$/, "YouTube handle contains invalid characters")
    .optional()
    .nullish(),
  minRate: z.preprocess((val) => (val === "" || val === null || val === undefined ? 0 : Number(val)), z.number().min(0).optional().nullish().catch(0)),
  maxRate: z.preprocess((val) => (val === "" || val === null || val === undefined ? 0 : Number(val)), z.number().min(0).optional().nullish().catch(0)),
  minInstagramRate: z.preprocess((val) => (val === "" || val === null || val === undefined ? 0 : Number(val)), z.number().min(0).optional().nullish().catch(0)),
  maxInstagramRate: z.preprocess((val) => (val === "" || val === null || val === undefined ? 0 : Number(val)), z.number().min(0).optional().nullish().catch(0)),
  minYoutubeRate: z.preprocess((val) => (val === "" || val === null || val === undefined ? 0 : Number(val)), z.number().min(0).optional().nullish().catch(0)),
  maxYoutubeRate: z.preprocess((val) => (val === "" || val === null || val === undefined ? 0 : Number(val)), z.number().min(0).optional().nullish().catch(0)),

  // Brand & Individual
  companyName: z.string().optional().nullish(),
  description: z.string().max(2000).optional().nullish(),
  website: z.preprocess(
    (val) => {
      if (typeof val !== "string" || val.trim() === "") return null;
      let trimmed = val.trim();
      if (!/^https?:\/\//i.test(trimmed)) {
        trimmed = `https://${trimmed}`;
      }
      return trimmed;
    },
    z.string().url("Website must be a valid URL").optional().nullable().nullish()
  ),
  industry: z.string().optional().nullish(),
  profileImage: z.string().optional().nullish(),
});

async function _handler_GET(_req: NextRequest) {
try {
const session = await auth();
if (!session?.user || !hasAnyPermission(session.user.userType, ["VIEW_SETTINGS", "MANAGE_SETTINGS"])) {
return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
}

const user = await prisma.user.findUnique({
where: { id: session.user.id },
include: {
influencerProfile: true,
brandProfile: true,
badges: {
include: { badge: true },
orderBy: { earnedAt: "desc" },
},
oauthAccounts: true,
},
});

if (!user) {
return NextResponse.json({ error: "User not found" }, { status: 404 });
}

// Determine profile based on user type
let profileData: Partial<InfluencerProfile & BrandProfile> = {};
const userType = session.user.userType;

if (isInfluencer(userType)) {
profileData = user.influencerProfile || {};
} else if (isBrand(userType)) {
profileData = user.brandProfile || {};
}

const instagramOAuth = user.oauthAccounts?.find((a) => a.provider === "instagram");
const youtubeOAuth = user.oauthAccounts?.find((a) => a.provider === "youtube");

return NextResponse.json({
user: {
email: user.email,
phone: user.phone || null,
emailVerified: !!user.emailVerified,
phoneVerified: !!user.phoneVerified,
isTwoFactorEnabled: !!user.isTwoFactorEnabled,
userType: userType, // Added userType
permissions: getPermissions(userType), // Central RBAC integration
referralCode: user.referralCode,
trustScore: user.trustScore,
level: user.level,
verificationLevel: user.verificationLevel,
notificationPreferences: parseNotificationPreferences(user.notificationPreferences),
lastLogin: user.lastLoginAt,
},
profile: {
// Common fields
displayName:
profileData.displayName ||
profileData.companyName ||
user.email.split("@")[0] ||
"",
bio: profileData.bio || profileData.description || "",
city: profileData.city || "",
state: profileData.state || "",
address: profileData.address || "",
pinCode: profileData.pinCode || "",
gender: profileData.gender || "",
age: profileData.age || null,

// Influencer specific
categories: profileData.categories
? profileData.categories.split(",")
: [],
languages: profileData.languages
? profileData.languages.split(",")
: [],
instagramHandle: profileData.instagramHandle || "",
instagramFollowers: profileData.instagramFollowers || 0,
instagramEngagementRate: profileData.instagramEngagementRate || 0,
youtubeHandle: profileData.youtubeHandle || "",
youtubeSubscribers: profileData.youtubeSubscribers || 0,
youtubeEngagementRate: profileData.youtubeEngagementRate || 0,
minRate: profileData.minRate || 0,
maxRate: profileData.maxRate || 0,
minInstagramRate: profileData.minInstagramRate || 0,
maxInstagramRate: profileData.maxInstagramRate || 0,
minYoutubeRate: profileData.minYoutubeRate || 0,
maxYoutubeRate: profileData.maxYoutubeRate || 0,

// Brand specific
companyName: profileData.companyName || "",
website: profileData.website || "",
industry: profileData.industry || "",

// Individual specific
// (Mostly covers common fields)

profileImage: profileData.avatar || profileData.logo || "",
},
badges: user.badges.map((ub) => ({
...ub.badge,
earnedAt: ub.earnedAt,
})),
socialConnections: {
instagram: {
connected: !!instagramOAuth,
accessTokenPresent: !!instagramOAuth?.accessToken,
},
youtube: {
connected: !!youtubeOAuth,
accessTokenPresent: !!youtubeOAuth?.accessToken,
},
},
});
} catch (error: unknown) {
logger.error("Settings fetch error", error);
return NextResponse.json(
{ error: "Failed to load settings. Please try again." },
{ status: 500 },
);
}
}

interface UpdateProfileInput {
displayName?: string | null | undefined;
bio?: string | null | undefined;
city?: string | null | undefined;
state?: string | null | undefined;
address?: string | null | undefined;
pinCode?: string | null | undefined;
gender?: string | null | undefined;
age?: number | null | undefined;
instagramHandle?: string | null | undefined;
youtubeHandle?: string | null | undefined;
minRate?: number | null | undefined;
maxRate?: number | null | undefined;
minInstagramRate?: number | null | undefined;
maxInstagramRate?: number | null | undefined;
minYoutubeRate?: number | null | undefined;
maxYoutubeRate?: number | null | undefined;
categories?: string[] | null | undefined;
languages?: string[] | null | undefined;
profileImage?: string | null | undefined;
website?: string | null | undefined;
industry?: string | null | undefined;
companyName?: string | null | undefined;
[key: string]: unknown;
}

async function handleNotificationPreferences(userId: string, body: Record<string, unknown>) {
if (!body.notificationPreferences) return null;
const parsedPrefs = notificationPreferencesSchema.safeParse(body.notificationPreferences);
if (!parsedPrefs.success) {
throw AppError.badRequest("Invalid notification preferences structure");
}
await prisma.user.update({
where: { id: userId },
data: { notificationPreferences: parsedPrefs.data },
});
return true;
}

async function updateInfluencerProfile(userId: string, email: string, data: UpdateProfileInput) {
  const existingProfile = await prisma.influencerProfile.findUnique({
    where: { userId },
    select: { instagramHandle: true, youtubeHandle: true },
  });

  const updateData: Prisma.InfluencerProfileUpdateInput = {};

  const fields: (keyof Prisma.InfluencerProfileUpdateInput)[] = [
    "displayName", "bio", "city", "state", "address", "pinCode", "gender", "age",
    "instagramHandle", "youtubeHandle", "minRate", "maxRate",
    "minInstagramRate", "maxInstagramRate", "minYoutubeRate", "maxYoutubeRate"
  ];

  fields.forEach((field) => {
    const val = data[field];
    if (val !== undefined && val !== null) {
      (updateData as Record<string, unknown>)[field] = val;
    }
  });

  // If social handles changed, invalidate verified metrics until re-verified via OAuth flow
  if (
    data.instagramHandle !== undefined &&
    data.instagramHandle !== null &&
    existingProfile &&
    data.instagramHandle !== existingProfile.instagramHandle
  ) {
    updateData.instagramFollowers = 0;
    updateData.instagramEngagementRate = 0;
  }

  if (
    data.youtubeHandle !== undefined &&
    data.youtubeHandle !== null &&
    existingProfile &&
    data.youtubeHandle !== existingProfile.youtubeHandle
  ) {
    updateData.youtubeSubscribers = 0;
    updateData.youtubeEngagementRate = 0;
  }

  if (data.categories != null) {
    updateData.categories = data.categories.join(",");
  }
  if (data.languages != null) {
    updateData.languages = data.languages.join(",");
  }
  if (data.profileImage !== undefined && data.profileImage !== "") {
    updateData.avatar = data.profileImage;
  }

await prisma.influencerProfile.upsert({
where: { userId },
create: {
userId,
displayName:
data.displayName ||
(email ? email.split("@")[0] : "") ||
"",
categories: data.categories ? data.categories.join(",") : "General",
languages: data.languages ? data.languages.join(",") : "English",
bio: data.bio || null,
avatar: data.profileImage || null,
city: data.city || null,
state: data.state || null,
address: data.address || null,
pinCode: data.pinCode || null,
gender: data.gender || null,
age: data.age || null,
instagramHandle: data.instagramHandle || null,
youtubeHandle: data.youtubeHandle || null,
minRate: data.minRate || null,
maxRate: data.maxRate || null,
minInstagramRate: data.minInstagramRate || null,
maxInstagramRate: data.maxInstagramRate || null,
minYoutubeRate: data.minYoutubeRate || null,
maxYoutubeRate: data.maxYoutubeRate || null,
},
update: updateData,
});
}

async function updateBrandProfile(userId: string, email: string, data: UpdateProfileInput) {
const updateData: Prisma.BrandProfileUpdateInput = {};
if (data.displayName !== undefined && data.displayName !== null) {
updateData.companyName = data.displayName;
} else if (data.companyName !== undefined && data.companyName !== null) {
updateData.companyName = data.companyName;
}
if (data.bio !== undefined) updateData.description = data.bio;
if (data.website !== undefined) updateData.website = data.website;
if (data.industry !== undefined) updateData.industry = data.industry;
if (data.city !== undefined) updateData.city = data.city;
if (data.state !== undefined) updateData.state = data.state;
if (data.address !== undefined) updateData.address = data.address;
if (data.pinCode !== undefined) updateData.pinCode = data.pinCode;
if (data.profileImage !== undefined && data.profileImage !== "") {
updateData.logo = data.profileImage;
}

await prisma.brandProfile.upsert({
where: { userId },
create: {
userId,
companyName:
data.displayName ||
data.companyName ||
(email ? email.split("@")[0] : "") ||
"",
description: data.bio || null,
website: data.website || null,
industry: data.industry || null,
city: data.city || null,
state: data.state || null,
address: data.address || null,
pinCode: data.pinCode || null,
logo: data.profileImage || null,
},
update: updateData,
});
}

function validateContactFreeText(text: unknown, fieldName: string) {
  if (typeof text !== "string" || !text.trim()) return;
  const check = checkMessageForContacts(text);
  if (check.hasContactInfo && check.findings.some((f: string) => f.toLowerCase().includes("phone") || f.toLowerCase().includes("email") || f.toLowerCase().includes("upi"))) {
    throw AppError.badRequest(`Personal contact details (phone numbers, email addresses, or UPI handles) are not allowed in your ${fieldName}.`);
  }
}

function parseAndValidateProfileBody(body: unknown) {
  const result = updateProfileSchema.safeParse(body);
  if (!result.success) {
    logger.warn("Settings validation error", {
      details: result.error.format(),
    });
    const firstIssue = result.error.issues[0]?.message || "Invalid input data provided";
    throw AppError.badRequest(firstIssue);
  }
  const data = result.data;
  validateContactFreeText(data.bio, "bio");
  validateContactFreeText(data.description, "description");
  return data;
}

async function updateUserRoleProfile(userType: string, userId: string, email: string, data: z.infer<typeof updateProfileSchema>) {
  if (isInfluencer(userType)) {
    await updateInfluencerProfile(userId, email, data);
  } else if (isBrand(userType)) {
    await updateBrandProfile(userId, email, data);
  }
}

async function _handler_PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !hasPermission(session.user.userType, "MANAGE_SETTINGS")) {
      throw AppError.forbidden("Forbidden: insufficient permissions");
    }

    const limit = await checkRateLimit(session.user.id, "PROFILE_UPDATE");
    if (!limit.success) {
      throw AppError.tooManyRequests("Too many settings updates");
    }

    const body = await req.json();

    const updatedPrefs = await handleNotificationPreferences(session.user.id, body);
    if (updatedPrefs && Object.keys(body).length === 1) {
      return NextResponse.json({
        success: true,
        message: "Notification preferences updated",
      });
    }

    const data = parseAndValidateProfileBody(body);
    await updateUserRoleProfile(session.user.userType, session.user.id, session.user.email || "", data);

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("Settings update error", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}


// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
export const PUT = apiWrapper(_handler_PUT);
