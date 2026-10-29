"use client";

import { logger } from "@/lib/logger-client";
import { useEffect, useRef, useState } from "react";
import type { Profile } from "./ProfileTab";
import SocialPlatformCard from "./SocialPlatformCard";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";

export interface SocialConnectionDetail {
  connected: boolean;
  accessTokenPresent?: boolean;
  needsReconnect?: boolean;
  pendingApproval?: boolean;
  lastSynced?: string | null;
  handle?: string | null;
}

export interface SocialConnections {
  instagram: SocialConnectionDetail;
  youtube: SocialConnectionDetail;
}

interface SocialTabProps {
  profile: Profile;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  socialConnections: SocialConnections | null;
  setSocialConnections: React.Dispatch<React.SetStateAction<SocialConnections | null>>;
  isSaving: boolean;
  setIsSaving: (val: boolean) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export default function SocialTab({
  profile,
  setProfile,
  socialConnections,
  setSocialConnections,
  isSaving,
  setIsSaving,
  showToast,
}: Readonly<SocialTabProps>) {
  const isMounted = useRef(true);
  const [redirectingPlatform, setRedirectingPlatform] = useState<"instagram" | "youtube" | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleInstagramConnect = async () => {
    setRedirectingPlatform("instagram");
    try {
      const data = await apiClient.users.authorizeSocial("instagram") as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setRedirectingPlatform(null);
        showToast(data.error || "Failed to connect Instagram.", "error");
      }
    } catch (error) {
      setRedirectingPlatform(null);
      logger.error("[social-tab] Failed to connect Instagram:", error);
      showToast("Failed to connect Instagram. Please try again.", "error");
    }
  };

  const disconnectPlatform = async (platform: "instagram" | "youtube") => {
    const platformLabel = platform === "instagram" ? "Instagram" : "YouTube";
    try {
      const res = await apiClient.users.disconnectSocial(platform) as { message?: string };
      // Refresh settings to reflect disconnected status
      const data = await apiClient.settings.get_() as { socialConnections?: SocialConnections };
      if (data.socialConnections) {
        setSocialConnections(data.socialConnections);
      }
      if (platform === "instagram") {
        showToast(
          res.message || "Instagram disconnected. Note: To completely revoke permissions, open Instagram > Settings > Apps & Websites > Active > Remove.",
          "info",
        );
      } else {
        showToast(`${platformLabel} disconnected successfully.`, "info");
      }
    } catch (error) {
      logger.error(`[social-tab] Failed to disconnect ${platformLabel}:`, error);
      showToast(
        formatUserError(error, `Failed to disconnect ${platformLabel}. Please try again.`),
        "error",
      );
    }
  };

  const handleInstagramDisconnect = () => disconnectPlatform("instagram");

  const handleYouTubeConnect = async () => {
    setRedirectingPlatform("youtube");
    try {
      const data = await apiClient.users.authorizeSocial("youtube") as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setRedirectingPlatform(null);
        showToast(data.error || "Failed to connect YouTube.", "error");
      }
    } catch (error) {
      setRedirectingPlatform(null);
      logger.error("[social-tab] Failed to connect YouTube:", error);
      showToast("Failed to connect YouTube. Please try again.", "error");
    }
  };

  const handleYouTubeDisconnect = () => disconnectPlatform("youtube");

  const verifySocial = async (platform: "instagram" | "youtube") => {
    const handle = platform === "instagram" ? profile.instagramHandle : profile.youtubeHandle;
    if (!handle) {
      showToast(`Please enter your ${platform} handle first.`, "error");
      return;
    }

    setIsSaving(true);
    try {
      const data = await apiClient.users.verifySocial({ platform, handle }) as {
        success?: boolean;
        followers?: number;
        engagementRate?: number;
        error?: string;
      };

      if (data.success) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("social-verified", {
              detail: { platform, handle, followers: data.followers, engagementRate: data.engagementRate },
            })
          );
        }
      }

      if (!isMounted.current) return;

      if (!data.success) {
        showToast(
          data.error || "Verification failed. Make sure the handle is public and correctly spelled.",
          "error",
        );
      }
    } catch (error) {
      logger.error("[social-tab] Failed to verify social account:", error);
      if (isMounted.current) {
        showToast(
          formatUserError(error, "Failed to verify social account. Make sure the handle is public and correctly spelled."),
          "error",
        );
      }
    } finally {
      if (isMounted.current) {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="grid-2">
      <SocialPlatformCard
        platform="instagram"
        title="Instagram"
        handle={profile.instagramHandle || ""}
        onHandleChange={(val) => setProfile({ ...profile, instagramHandle: val })}
        connected={Boolean(socialConnections?.instagram?.connected)}
        needsReconnect={Boolean(socialConnections?.instagram?.needsReconnect)}
        pendingApproval={Boolean(socialConnections?.instagram?.pendingApproval)}
        lastSynced={socialConnections?.instagram?.lastSynced}
        followersOrSubscribers={profile.instagramFollowers || 0}
        engagementRate={profile.instagramEngagementRate || 0}
        isSaving={isSaving}
        isRedirecting={redirectingPlatform === "instagram"}
        onConnect={handleInstagramConnect}
        onSync={() => verifySocial("instagram")}
        onDisconnect={handleInstagramDisconnect}
      />

      <SocialPlatformCard
        platform="youtube"
        title="YouTube"
        handle={profile.youtubeHandle || ""}
        onHandleChange={(val) => setProfile({ ...profile, youtubeHandle: val })}
        connected={Boolean(socialConnections?.youtube?.connected)}
        needsReconnect={Boolean(socialConnections?.youtube?.needsReconnect)}
        pendingApproval={Boolean(socialConnections?.youtube?.pendingApproval)}
        lastSynced={socialConnections?.youtube?.lastSynced}
        followersOrSubscribers={profile.youtubeSubscribers ?? 0}
        engagementRate={profile.youtubeEngagementRate || 0}
        isSaving={isSaving}
        isRedirecting={redirectingPlatform === "youtube"}
        onConnect={handleYouTubeConnect}
        onSync={() => verifySocial("youtube")}
        onDisconnect={handleYouTubeDisconnect}
      />
    </div>
  );
}
