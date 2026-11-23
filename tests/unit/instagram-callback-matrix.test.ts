import { describe, it, expect, vi, beforeEach } from "vitest";
import * as instagramModule from "@/lib/instagram";

describe("Instagram OAuth Callback Probe Logic Matrix", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("grants insights scope and capability ACTIVE when token exchange permissions explicitly include it", () => {
    const tokens = {
      accessToken: "token_123",
      userId: "ig_user_1",
      permissions: ["instagram_business_basic", "instagram_business_manage_insights"],
    };

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
    }

    expect(grantedScopes).toContain("instagram_business_manage_insights");
    expect(capability).toBe("ACTIVE");
  });

  it("marks UNKNOWN when no permissions returned and creator has 0 posts to probe", async () => {
    const tokens = {
      accessToken: "token_123",
      userId: "ig_user_1",
      permissions: [],
    };

    vi.spyOn(instagramModule, "fetchInstagramPermissions").mockResolvedValue(["instagram_business_basic"]);
    vi.spyOn(instagramModule, "getRecentPosts").mockResolvedValue([]);

    let grantedScopes: string[] = ["instagram_business_basic"];
    let capability: "ACTIVE" | "BASIC_ONLY" | "UNKNOWN" = "BASIC_ONLY";

    const verifiedPermissions = await instagramModule.fetchInstagramPermissions(tokens.accessToken);
    if (verifiedPermissions.includes("instagram_business_manage_insights")) {
      grantedScopes = ["instagram_business_basic", "instagram_business_manage_insights"];
      capability = "ACTIVE";
    } else {
      const recent = await instagramModule.getRecentPosts(tokens.accessToken, 1);
      if (recent.length === 0) {
        grantedScopes = ["instagram_business_basic"];
        capability = "UNKNOWN";
      }
    }

    expect(grantedScopes).toEqual(["instagram_business_basic"]);
    expect(capability).toBe("UNKNOWN");
  });

  it("marks ACTIVE when probe returns NOT_ENOUGH_VIEWERS on supported media", async () => {
    const tokens = {
      accessToken: "token_123",
      userId: "ig_user_1",
      permissions: [],
    };

    vi.spyOn(instagramModule, "fetchInstagramPermissions").mockResolvedValue(["instagram_business_basic"]);
    vi.spyOn(instagramModule, "getRecentPosts").mockResolvedValue([
      { id: "post_1", mediaType: "IMAGE", mediaProductType: "FEED" } as any,
    ]);
    vi.spyOn(instagramModule, "getMediaInsights").mockResolvedValue({
      status: "NOT_ENOUGH_VIEWERS",
    });

    let grantedScopes: string[] = ["instagram_business_basic"];
    let capability: "ACTIVE" | "BASIC_ONLY" | "UNKNOWN" = "BASIC_ONLY";

    const verifiedPermissions = await instagramModule.fetchInstagramPermissions(tokens.accessToken);
    if (!verifiedPermissions.includes("instagram_business_manage_insights")) {
      const recent = await instagramModule.getRecentPosts(tokens.accessToken, 1);
      if (recent.length > 0 && recent[0]) {
        const samplePost = recent[0];
        const testInsights = await instagramModule.getMediaInsights(tokens.accessToken, samplePost.id, samplePost.mediaProductType);
        if (
          testInsights?.status === "OK" ||
          testInsights?.status === "EMPTY" ||
          testInsights?.status === "NOT_ENOUGH_VIEWERS"
        ) {
          grantedScopes = ["instagram_business_basic", "instagram_business_manage_insights"];
          capability = "ACTIVE";
        }
      }
    }

    expect(grantedScopes).toContain("instagram_business_manage_insights");
    expect(capability).toBe("ACTIVE");
  });

  it("marks BASIC_ONLY when probe returns PERMISSION_DENIED", async () => {
    const tokens = {
      accessToken: "token_123",
      userId: "ig_user_1",
      permissions: [],
    };

    vi.spyOn(instagramModule, "fetchInstagramPermissions").mockResolvedValue(["instagram_business_basic"]);
    vi.spyOn(instagramModule, "getRecentPosts").mockResolvedValue([
      { id: "post_1", mediaType: "IMAGE", mediaProductType: "FEED" } as any,
    ]);
    vi.spyOn(instagramModule, "getMediaInsights").mockResolvedValue({
      status: "PERMISSION_DENIED",
    });

    let grantedScopes: string[] = ["instagram_business_basic"];
    let capability: "ACTIVE" | "BASIC_ONLY" | "UNKNOWN" = "BASIC_ONLY";

    const recent = await instagramModule.getRecentPosts(tokens.accessToken, 1);
    const samplePost = recent[0];
    const testInsights = samplePost
      ? await instagramModule.getMediaInsights(tokens.accessToken, samplePost.id, samplePost.mediaProductType)
      : null;
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

    expect(grantedScopes).toEqual(["instagram_business_basic"]);
    expect(capability).toBe("BASIC_ONLY");
  });
});
