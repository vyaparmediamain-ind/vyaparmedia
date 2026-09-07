"use client";


import { logger } from "@/lib/logger-client";
import { useState, useEffect, useRef, useCallback } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useSession } from "next-auth/react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import IndiaTaxCompliancePanel from "@/components/dashboard/settings/IndiaTaxCompliancePanel";
import NotificationPreferencesPanel, {
type NotificationPreferences,
} from "@/components/dashboard/settings/NotificationPreferencesPanel";
import ProfileTab, { type Profile, type User } from "@/components/dashboard/settings/ProfileTab";
import SocialTab, { type SocialConnections } from "@/components/dashboard/settings/SocialTab";
import RatesTab from "@/components/dashboard/settings/RatesTab";
import VerificationTab, { type VerificationData } from "@/components/dashboard/settings/VerificationTab";
import SecurityTab from "@/components/dashboard/settings/SecurityTab";
import { ToastContainer } from "@/components/ui/toast";
import { Button } from "@/components/ui";



export default function SettingsPage() {
const isMounted = useRef(true);
useEffect(() => {
isMounted.current = true;
return () => {
isMounted.current = false;
};
}, []);

const { data: session, update } = useSession();
const [activeTab, setActiveTab] = useState<string>("profile");
const [toasts, setToasts] = useState<Array<{ id: string; type: "success" | "error" | "info"; message: string }>>([]);
const toastCounterRef = useRef(0);

const handleRemoveToast = useCallback((id: string) => {
if (!isMounted.current) return;
setToasts((prev) => prev.filter((t) => t.id !== id));
}, []);

const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
// Use a monotonic counter instead of Math.random() to generate unique, collision-free IDs.
toastCounterRef.current += 1;
const id = `toast-${toastCounterRef.current}`;
setToasts((prev) => [...prev, { id, type, message }]);
setTimeout(() => handleRemoveToast(id), 4000);
}, [handleRemoveToast]);

const [profile, setProfile] = useState<Profile | null>(null);
const [referralCode, setReferralCode] = useState("");
const [badgesCount, setBadgesCount] = useState(0);
const [user, setUser] = useState<User | null>(null);
const [socialConnections, setSocialConnections] = useState<SocialConnections | null>(null);
const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
const [notificationPreferences, setNotificationPreferences] =
useState<NotificationPreferences>({
email: { marketing: true, updates: true, security: true },
push: { marketing: true, updates: true, security: true },
});
const [isSaving, setIsSaving] = useState(false);

useEffect(() => {
// Sync social stats verified from child custom event
const handleSocialVerified = (e: Event) => {
const detail = (e as CustomEvent).detail;
if (detail) {
setProfile((prev) => {
if (!prev) return prev;
if (detail.platform === "instagram") {
return {
...prev,
instagramHandle: detail.handle,
instagramFollowers: detail.followers,
instagramEngagementRate: detail.engagementRate,
};
} else {
return {
...prev,
youtubeHandle: detail.handle,
youtubeSubscribers: detail.followers,
youtubeEngagementRate: detail.engagementRate,
};
}
});
showToast(
`${detail.platform.toUpperCase()} successfully verified! Stats linked in real.`,
"success",
);
}
};

window.addEventListener("social-verified", handleSocialVerified);
return () => {
window.removeEventListener("social-verified", handleSocialVerified);
};
}, [showToast]);

useEffect(() => {
const urlParams = new URLSearchParams(window.location.search);
const success = urlParams.get("success");
if (success === "instagram_connected") {
showToast("Instagram connected successfully!", "success");
window.history.replaceState({}, document.title, window.location.pathname);
} else if (success === "digilocker_connected") {
showToast("DigiLocker connected successfully! Verification documents loaded.", "success");
window.history.replaceState({}, document.title, window.location.pathname);
} else if (urlParams.get("error")) {
showToast(`Error: ${urlParams.get("error")}`, "error");
window.history.replaceState({}, document.title, window.location.pathname);
}
}, [showToast]);

const { data: settingsData, isLoading: loading } = useSWR<{
profile?: Partial<Profile>;
user?: Partial<User> & { referralCode?: string; notificationPreferences?: NotificationPreferences };
badges?: unknown[];
socialConnections?: Partial<SocialConnections>;
}>("/api/settings", fetcher);

useEffect(() => {
if (!settingsData) return;
if (settingsData.profile) {
setProfile({
...settingsData.profile,
categories: settingsData.profile.categories || [],
languages: settingsData.profile.languages || [],
} as Profile);
}
setReferralCode(settingsData.user?.referralCode || "");
setBadgesCount(settingsData.badges?.length || 0);
if (settingsData.user) {
setUser(settingsData.user as User);
}
if (settingsData.user?.notificationPreferences) {
setNotificationPreferences(settingsData.user.notificationPreferences);
}
if (settingsData.socialConnections) {
setSocialConnections(settingsData.socialConnections as SocialConnections);
}
}, [settingsData]);

useEffect(() => {
if (!user?.userType) return;

const requestedTab = new URLSearchParams(window.location.search).get("tab");
const allowedTabs = [
"profile",
"verification",
"tax",
"notifications",
"security",
...(user.userType === "INFLUENCER" ? ["social", "rates"] : []),
];

if (requestedTab && allowedTabs.includes(requestedTab)) {
setActiveTab(requestedTab);
}
}, [user?.userType]);

useEffect(() => {
if (activeTab === "verification" && !verificationData) {
fetch("/api/verification")
.then((res) => res.json())
.then((data) => {
if (isMounted.current) {
setVerificationData(data);
}
})
.catch((err) => {
if (err?.name !== "AbortError") {
logger.error("[settings] Failed to load verification data:", err);
}
});
}
}, [activeTab, verificationData]);

const handleSave = async () => {
if (!profile) return;
setIsSaving(true);
try {
const res = await fetch("/api/settings", {
method: "PUT",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(profile),
});
      const data = await res.json();
      if (res.ok) {
        await update();
        showToast("Profile saved successfully!", "success");
      } else {
        const errorMsg = data.message || data.error || (data.details ? "Invalid input details" : "Failed to save profile");
        showToast(errorMsg, "error");
      }
} catch (error) {
logger.error("[settings] Failed to save profile:", error);
showToast("Failed to save profile", "error");
} finally {
if (isMounted.current) {
setIsSaving(false);
}
}
};

const handleNotificationToggle = (
type: "email" | "push",
category: "marketing" | "updates" | "security",
) => {
setNotificationPreferences((prev) => ({
...prev,
[type]: {
...prev[type],
[category]: !prev[type][category],
},
}));
};

const saveNotificationPreferences = async () => {
setIsSaving(true);
try {
const res = await fetch("/api/settings", {
method: "PUT",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ notificationPreferences }),
});
if (res.ok) {
showToast("Preferences saved successfully", "success");
} else {
showToast("Failed to save preferences", "error");
}
} catch (error) {
logger.error("[settings] Failed to save preferences:", error);
showToast("An error occurred", "error");
} finally {
if (isMounted.current) {
setIsSaving(false);
}
}
};

if (loading) {
return (
<DashboardShell user={session?.user || user}>
<div
className="flex items-center justify-center min-h-60vh"
>
<span className="loading" />
</div>
</DashboardShell>
);
}

if (!profile || !user) {
return (
<div className="text-center p-10">
Failed to load profile
</div>
);
}

return (
<DashboardShell user={session?.user || user}>
<ToastContainer toasts={toasts} onClose={handleRemoveToast} />

{/* Header */}
<div
className="mb-6 flex justify-between items-center"
>
<div>
<h1 className="text-2xl font-extrabold">Settings</h1>
<p className="text-secondary text-sm">
Manage your profile and preferences
</p>
</div>
{activeTab !== "notifications" && activeTab !== "tax" && activeTab !== "security" && activeTab !== "verification" && (
<Button
variant="primary"
aria-label={isSaving ? "Saving changes" : "Save Changes"}
aria-busy={isSaving}
onClick={handleSave}
disabled={isSaving}
>
{isSaving ? (
<span className="loading" />
) : (
<>
<span aria-hidden="true"></span> Save Changes
</>
)}
</Button>
)}
</div>

      <div className="dashboard-settings-content">
        {/* Modern Segmented Settings Tabs */}
        <div
          role="tablist"
          aria-label="Settings sections"
          className="settings-tabs-container"
        >
          {[
            { id: "profile", label: "Profile" },
            ...(user.userType === "INFLUENCER"
              ? [
                  { id: "social", label: "Social Accounts" },
                  { id: "rates", label: "Rates" },
                ]
              : []),
            { id: "verification", label: "Verification" },
            { id: "tax", label: "Tax" },
            { id: "notifications", label: "Notifications" },
            { id: "security", label: "Security" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="settings-tab-button"
              data-active={activeTab === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>

{/* Profile Tab */}
{activeTab === "profile" && (
<ProfileTab
profile={profile}
setProfile={setProfile}
user={user}
referralCode={referralCode}
badgesCount={badgesCount}
showToast={showToast}
/>
)}

{/* Social Tab */}
{activeTab === "social" && (
<SocialTab
profile={profile}
setProfile={setProfile}
socialConnections={socialConnections}
setSocialConnections={setSocialConnections}
isSaving={isSaving}
setIsSaving={setIsSaving}
showToast={showToast}
/>
)}

{/* Rates Tab */}
{activeTab === "rates" && (
<RatesTab
profile={profile}
setProfile={setProfile}
/>
)}

{/* Verification Tab */}
{activeTab === "verification" && (
<VerificationTab
user={user}
verificationData={verificationData}
setVerificationData={setVerificationData}
showToast={showToast}
/>
)}

{/* Tax Tab */}
{activeTab === "tax" && <IndiaTaxCompliancePanel />}

{/* Notifications Tab */}
{activeTab === "notifications" && (
<NotificationPreferencesPanel
preferences={notificationPreferences}
isSaving={isSaving}
onToggle={handleNotificationToggle}
onSave={saveNotificationPreferences}
/>
)}

{/* Security Tab */}
{activeTab === "security" && (
<SecurityTab
user={user}
setUser={setUser}
isSaving={isSaving}
setIsSaving={setIsSaving}
showToast={showToast}
/>
)}
</div>
</DashboardShell>
);
}
