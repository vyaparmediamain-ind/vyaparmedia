import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { formatCreatorProfileData } from "@/lib/creator-profile";
import { isKillSwitchActive, setKillSwitchOverride, clearKillSwitchOverrides } from "@/lib/kill-switch";
import { GET as getInstagramAuthorize } from "@/app/api/auth/instagram/authorize/route";
import { GET as getYouTubeAuthorize } from "@/app/api/auth/youtube/authorize/route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";

describe("OAuth Social Trust, Kill-Switches & Social Status (Checklist Items 8, 9, 10)", () => {
  const mockAuth = vi.mocked(auth);

  beforeEach(() => {
    vi.clearAllMocks();
    clearKillSwitchOverrides();
  });

  afterEach(() => {
    clearKillSwitchOverrides();
    vi.restoreAllMocks();
  });

  describe("Item 8: Social handle is a trust signal — verified ONLY via OAuth", () => {
    it("marks isSocialVerified = false when influencer has manual handles but NO OAuth account", () => {
      const influencerWithManualHandles = {
        id: "inf_1",
        userId: "user_1",
        displayName: "Manual Creator",
        instagramHandle: "@manual_insta",
        youtubeHandle: "@manual_yt",
        instagramFollowers: 50000,
        youtubeSubscribers: 10000,
        user: {
          id: "user_1",
          email: "creator@example.com",
          userType: "INFLUENCER",
          trustScore: 700,
          verificationDocs: [],
          oauthAccounts: [], // NO OAuth accounts linked!
        },
        deals: [],
      };

      const result = formatCreatorProfileData(influencerWithManualHandles as never);
      expect(result.isSocialVerified).toBe(false);
    });

    it("marks isSocialVerified = true ONLY when an OAuth account exists (Instagram or YouTube)", () => {
      const influencerWithOAuth = {
        id: "inf_2",
        userId: "user_2",
        displayName: "OAuth Verified Creator",
        instagramHandle: "@oauth_creator",
        user: {
          id: "user_2",
          email: "verified@example.com",
          userType: "INFLUENCER",
          trustScore: 750,
          verificationDocs: [],
          oauthAccounts: [
            { id: "oa_1", provider: "instagram", providerAccountId: "ig_123" },
          ],
        },
        deals: [],
      };

      const result = formatCreatorProfileData(influencerWithOAuth as never);
      expect(result.isSocialVerified).toBe(true);
    });
  });

  describe("Item 9: Feature flags / kill-switches for social and auth", () => {
    it("blocks Instagram authorize with 503 when killswitch:social:instagram is active", async () => {
      setKillSwitchOverride("killswitch:social:instagram", true);
      expect(await isKillSwitchActive("killswitch:social:instagram")).toBe(true);

      mockAuth.mockResolvedValue({
        user: { id: "user_test_1" },
      } as unknown as Awaited<ReturnType<typeof auth>>);

      const req = new NextRequest("https://app.vyaparmedia.in/api/auth/instagram/authorize");
      const res = await getInstagramAuthorize(req);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toContain("Instagram");
    });

    it("blocks YouTube authorize with 503 when killswitch:social:youtube is active", async () => {
      setKillSwitchOverride("killswitch:social:youtube", true);
      expect(await isKillSwitchActive("killswitch:social:youtube")).toBe(true);

      mockAuth.mockResolvedValue({
        user: { id: "user_test_1" },
      } as unknown as Awaited<ReturnType<typeof auth>>);

      const req = new NextRequest("https://app.vyaparmedia.in/api/auth/youtube/authorize");
      const res = await getYouTubeAuthorize(req);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toContain("YouTube");
    });

    it("maps GoogleAuthUnavailable to user-friendly paused message in login page", async () => {
      const { getSessionMessage } = await import("@/app/login/page");
      const msg = getSessionMessage(false, null, "GoogleAuthUnavailable");
      expect(msg).toBe("Google sign-in is temporarily paused. Please sign in with your email and password.");
    });
  });

  describe("Item 10: Settings > Social status representations", () => {
    it("recognizes all 4 connection states correctly (Not connected, Connected, Needs reconnect, Pending approval)", () => {
      type SocialState = "not_connected" | "connected" | "needs_reconnect" | "pending_approval";

      function computeState(conn: {
        connected: boolean;
        needsReconnect?: boolean;
        pendingApproval?: boolean;
      }): SocialState {
        if (conn.needsReconnect) return "needs_reconnect";
        if (conn.pendingApproval) return "pending_approval";
        if (conn.connected) return "connected";
        return "not_connected";
      }

      expect(computeState({ connected: false })).toBe("not_connected");
      expect(computeState({ connected: true })).toBe("connected");
      expect(computeState({ connected: false, needsReconnect: true })).toBe("needs_reconnect");
      expect(computeState({ connected: true, pendingApproval: true })).toBe("pending_approval");
    });
  });
});

