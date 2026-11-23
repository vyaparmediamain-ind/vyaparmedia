import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  exchangeInstagramCode,
  getInstagramProfile,
  fetchInstagramPermissions,
  getRecentPosts,
  getMediaInsights,
} from "@/lib/instagram";
import { logger } from "@/lib/logger";
import { encrypt } from "@/lib/encryption";
import { appUrl } from "@/lib/app-url";
import { isInfluencer } from "@/lib/rbac";
import { oauthRedirect, validateAndConsumeOAuthState } from "@/lib/oauth-callback-helper";
import { CreatorAuditService } from "@/services/creator-audit.service";

const ERROR_BASE = "/dashboard/settings?error=";

async function _handler_GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error") || searchParams.get("error_reason");

  try {
    const { storedState, errorRedirect } = await validateAndConsumeOAuthState(
      req, code, state, error,
      "instagram", ERROR_BASE, "instagram_connect_cancelled",
    );
    if (errorRedirect || !storedState || !code) {
      return errorRedirect || oauthRedirect(req, `${ERROR_BASE}invalid_state`);
    }
    const userId = storedState.userId;

    const redirectUri = appUrl("/api/auth/instagram/callback");
    const tokens = await exchangeInstagramCode(code, redirectUri);

    if (!tokens) {
      return oauthRedirect(req, `${ERROR_BASE}token_exchange_failed`);
    }

    const profile = await getInstagramProfile(tokens.accessToken);
    if (!profile) {
      // Rejected non-business/creator account or profile fetch failed
      return oauthRedirect(req, `${ERROR_BASE}instagram_not_professional_account`);
    }

    const expiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : new Date(Date.now() + 60 * 86400 * 1000);

    // Determine actually granted scopes (handle user-denied insights gracefully)
    let grantedScopes: string[] = ["instagram_business_basic"];
  let capability: "ACTIVE" | "BASIC_ONLY" | "UNKNOWN" = "BASIC_ONLY";

  if (tokens.permissions && tokens.permissions.length > 0) {
    const candidateScopes = tokens.permissions.filter((p) =>
      ["instagram_business_basic", "instagram_business_manage_insights"].includes(p)
    );
    if (candidateScopes.length > 0) {
      grantedScopes = Array.from(new Set([...grantedScopes, ...candidateScopes]));
      if (grantedScopes.includes("instagram_business_manage_insights")) {
        capability = "ACTIVE";
      }
    }
  } else {
    // Verify via /me/permissions or test insights call
    const verifiedPermissions = await fetchInstagramPermissions(tokens.accessToken);
    if (verifiedPermissions.includes("instagram_business_manage_insights")) {
      grantedScopes = ["instagram_business_basic", "instagram_business_manage_insights"];
      capability = "ACTIVE";
    } else {
      try {
        const recent = await getRecentPosts(tokens.accessToken, 1);
        if (recent.length === 0 || !recent[0]) {
          // No recent posts exist to probe -> mark capability UNKNOWN
          grantedScopes = ["instagram_business_basic"];
          capability = "UNKNOWN";
        } else {
          const samplePost = recent[0];
          const testInsights = await getMediaInsights(tokens.accessToken, samplePost.id, samplePost.mediaProductType);
          if (
            testInsights?.status === "OK" ||
            testInsights?.status === "EMPTY" ||
            testInsights?.status === "NOT_ENOUGH_VIEWERS"
          ) {
            grantedScopes = ["instagram_business_basic", "instagram_business_manage_insights"];
            capability = "ACTIVE";
          } else {
            grantedScopes = ["instagram_business_basic"];
            capability = "BASIC_ONLY";
          }
        }
      } catch {
        // Fall back gracefully to basic scope if user denied insights or call failed
        grantedScopes = ["instagram_business_basic"];
        capability = "BASIC_ONLY";
      }
    }
  }

  const storedScope = capability === "UNKNOWN" ? "UNKNOWN" : "instagram_business_basic";

    // Clean up any legacy Facebook-user-id rows for this user now that we have the canonical Instagram ID
    await prisma.oAuthAccount.deleteMany({
      where: {
        userId,
        provider: "instagram",
        providerAccountId: { not: tokens.userId },
      },
    }).catch((pruneErr) => {
      logger.warn("Non-blocking cleanup of legacy Instagram OAuth rows failed", { error: pruneErr });
    });

    // Ownership-safe link
    // Check whether this Instagram account is already linked to *any* VyaparMedia
    // user before touching anything.
    const existingLink = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "instagram",
          providerAccountId: tokens.userId,
        },
      },
      select: { userId: true },
    });

    if (existingLink && existingLink.userId !== userId) {
      // Ownership conflict
      // The Instagram account is currently linked to a *different* VyaparMedia
      // user (previousOwner). Atomically remove previous link and create fresh link.
      const previousOwnerId = existingLink.userId;

      logger.warn("Instagram account ownership conflict re-linking to new owner", {
        instagramUserId: tokens.userId,
        instagramHandle: profile.username,
        previousOwnerId,
        newOwnerId: userId,
      });

      await prisma.$transaction([
        // 1. Remove old link
        prisma.oAuthAccount.delete({
          where: {
            provider_providerAccountId: {
              provider: "instagram",
              providerAccountId: tokens.userId,
            },
          },
        }),
        // 2. Clear the previous owner's handle so they are not left showing a
        // handle they no longer have authorised access to.
        prisma.influencerProfile.updateMany({
          where: {
            userId: previousOwnerId,
            instagramHandle: profile.username,
          },
          data: { instagramHandle: null },
        }),
        // 3. Create a fresh link for the new owner
        prisma.oAuthAccount.create({
          data: {
            userId,
            provider: "instagram",
            providerAccountId: tokens.userId,
            accessToken: encrypt(tokens.accessToken),
            expiresAt,
            scope: storedScope,
            grantedScopes,
          },
        }),
      ]);
    } else if (existingLink) {
      // Same user re-linking (token refresh)
      await prisma.oAuthAccount.update({
        where: {
          provider_providerAccountId: {
            provider: "instagram",
            providerAccountId: tokens.userId,
          },
        },
        data: {
          accessToken: encrypt(tokens.accessToken),
          expiresAt,
          scope: storedScope,
          grantedScopes,
        },
      });
    } else {
      // Fresh link no prior row
      await prisma.oAuthAccount.create({
        data: {
          userId,
          provider: "instagram",
          providerAccountId: tokens.userId,
          accessToken: encrypt(tokens.accessToken),
          expiresAt,
          scope: storedScope,
          grantedScopes,
        },
      });
    }

    // If the connecting user is an influencer, sync their handle + follower count.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { userType: true, email: true },
    });

    if (user && isInfluencer(user.userType)) {
      await prisma.influencerProfile.upsert({
        where: { userId },
        create: {
          userId,
          displayName: user.email?.split("@")[0] || profile.username || "Creator",
          categories: "General",
          languages: "English",
          instagramHandle: profile.username,
          instagramFollowers: profile.followersCount,
          instagramEngagementRate: 0,
        },
        update: {
          instagramHandle: profile.username,
          instagramFollowers: profile.followersCount,
        },
      });

      // Automated In-House Social Audit:
      // Fetch historical media & comments to calculate authenticity & quality scores.
      // Run asynchronously without blocking OAuth redirect.
      CreatorAuditService.auditHistoricalInstagramData(userId, tokens.accessToken).catch((auditErr) => {
        logger.warn("Asynchronous creator historical audit encountered error", { userId, auditErr });
      });
    }

    return oauthRedirect(req, "/dashboard/settings?success=instagram_connected");
  } catch (error: unknown) {
    logger.error("Instagram callback error", error);
    return oauthRedirect(req, `${ERROR_BASE}instagram_connect_failed`);
  }
}

// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
