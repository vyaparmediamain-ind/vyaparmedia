"use client";


import { logger } from "@/lib/logger-client";
import { useEffect, useRef } from "react";
import type { Profile } from "./ProfileTab";
import SocialPlatformCard from "./SocialPlatformCard";

export interface SocialConnections {
instagram: {
connected: boolean;
accessTokenPresent: boolean;
};
youtube: {
connected: boolean;
accessTokenPresent: boolean;
};
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

useEffect(() => {
isMounted.current = true;
return () => {
isMounted.current = false;
};
}, []);

const handleInstagramConnect = async () => {
try {
const res = await fetch("/api/auth/instagram/authorize");
const data = await res.json();
if (data.url) {
window.location.href = data.url;
}
} catch (error) {
logger.error("[social-tab] Failed to connect Instagram:", error);
showToast("Failed to connect Instagram. Please try again.", "error");
}
};

const disconnectPlatform = async (platform: "instagram" | "youtube") => {
const platformLabel = platform === "instagram" ? "Instagram" : "YouTube";
try {
const res = await fetch(`/api/auth/${encodeURIComponent(platform)}/disconnect`, { method: "POST" });
if (res.ok) {
// Refresh settings to reflect disconnected status
const refreshRes = await fetch("/api/settings");
const data = await refreshRes.json();
if (data.socialConnections) {
setSocialConnections(data.socialConnections);
}
showToast(`${platformLabel} disconnected successfully.`, "info");
} else {
showToast(`Failed to disconnect ${platformLabel}.`, "error");
}
} catch (error) {
logger.error(`[social-tab] Failed to disconnect ${platformLabel}:`, error);
showToast(`Failed to disconnect ${platformLabel}.`, "error");
}
};

const handleInstagramDisconnect = () => disconnectPlatform("instagram");

const handleYouTubeConnect = async () => {
try {
const res = await fetch("/api/auth/youtube/authorize");
const data = await res.json();
if (data.url) {
window.location.href = data.url;
} else {
showToast(data.error || "Failed to connect YouTube.", "error");
}
} catch (error) {
logger.error("[social-tab] Failed to connect YouTube:", error);
showToast("Failed to connect YouTube. Please try again.", "error");
}
};

const handleYouTubeDisconnect = () => disconnectPlatform("youtube");

const verifySocial = async (platform: "instagram" | "youtube") => {
const handle =
platform === "instagram"
? profile.instagramHandle
: profile.youtubeHandle;
if (!handle) {
showToast(`Please enter your ${platform} handle first.`, "error");
return;
}

setIsSaving(true);
try {
const res = await fetch("/api/social/verify", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ platform, handle }),
});
const data = await res.json();

if (res.ok && data.success) {
if (typeof window !== "undefined") {
window.dispatchEvent(
new CustomEvent("social-verified", {
detail: { platform, handle, followers: data.followers, engagementRate: data.engagementRate },
})
);
}
}

if (!isMounted.current) return;

if (!(res.ok && data.success)) {
showToast(
data.error ||
"Verification failed. Make sure the handle is public and correctly spelled.",
"error",
);
}
} catch (error) {
logger.error("[social-tab] Failed to verify social account:", error);
if (isMounted.current) {
showToast("Failed to verify social account.", "error");
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
    followersOrSubscribers={profile.instagramFollowers || 0}
    engagementRate={profile.instagramEngagementRate || 0}
    isSaving={isSaving}
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
    followersOrSubscribers={profile.youtubeSubscribers ?? 0}
    engagementRate={profile.youtubeEngagementRate || 0}
    isSaving={isSaving}
    onConnect={handleYouTubeConnect}
    onSync={() => verifySocial("youtube")}
    onDisconnect={handleYouTubeDisconnect}
  />
</div>
);
}
