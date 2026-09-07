"use client";


import { logger } from "@/lib/logger-client";
import Link from "next/link";
import { useState, useRef } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { type NotificationPreferences } from "./NotificationPreferencesPanel";
import { isBrand, isInfluencer } from "@/lib/rbac";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { ALL_CATEGORIES } from "@/lib/categories";


export interface Profile {
displayName: string;
bio: string;
profileImage?: string;
website?: string;
industry?: string;
city?: string;
state?: string;
address?: string;
pinCode?: string;
gender?: string;
age?: number | null;
minRate: number;
maxRate: number;
minInstagramRate?: number;
maxInstagramRate?: number;
minYoutubeRate?: number;
maxYoutubeRate?: number;
instagramHandle?: string;
instagramFollowers: number;
instagramEngagementRate: number;
youtubeHandle?: string;
youtubeSubscribers?: number;
youtubeEngagementRate?: number;
categories: string[];
languages: string[];
}

export interface User {
id: string;
userType: string;
referralCode?: string;
name?: string;
email?: string;
phone?: string;
emailVerified?: boolean;
phoneVerified?: boolean;
isTwoFactorEnabled?: boolean;
notificationPreferences?: NotificationPreferences;
lastLogin?: string;
}

interface ProfileTabProps {
profile: Profile;
setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
user: User;
referralCode: string;
badgesCount: number;
showToast: (message: string, type?: "success" | "error" | "info") => void;
}

const allCategories = ALL_CATEGORIES;

const allLanguages = [
"Hindi",
"English",
"Tamil",
"Telugu",
"Kannada",
"Malayalam",
"Bengali",
"Marathi",
"Gujarati",
"Punjabi",
"Odia",
"Assamese",
];

const allCities = [
"Mumbai", "Delhi", "Bangalore", "Hyderabad", "Ahmedabad", "Chennai", "Kolkata", "Surat", "Pune", "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Indore", "Thane", "Bhopal", "Visakhapatnam", "Pimpri-Chinchwad", "Patna", "Vadodara", "Ghaziabad", "Ludhiana", "Agra", "Nashik", "Faridabad", "Meerut", "Rajkot", "Kalyan-Dombivli", "Vasai-Virar", "Varanasi", "Srinagar", "Aurangabad", "Dhanbad", "Amritsar", "Navi Mumbai", "Allahabad", "Howrah", "Ranchi", "Gwalior", "Jabalpur", "Coimbatore", "Vijayawada", "Jodhpur", "Madurai", "Raipur", "Kota", "Guwahati", "Chandigarh", "Solapur", "Hubballi-Dharwad", "Mysore", "Tiruchirappalli", "Bareilly", "Aligarh", "Tiruppur", "Gurgaon", "Moradabad", "Jalandhar", "Bhubaneswar", "Salem", "Warangal", "Mira-Bhayandar", "Jalgaon", "Guntur", "Thiruvananthapuram", "Bhiwandi", "Saharanpur", "Gorakhpur", "Bikaner", "Amravati", "Noida", "Jamshedpur", "Bhilai", "Cuttack", "Firozabad", "Kochi", "Nellore", "Bhavnagar", "Dehradun", "Durgapur", "Asansol", "Rourkela", "Nanded", "Kolhapur", "Ajmer", "Akola", "Gulbarga", "Jamnagar", "Ujjain", "Loni", "Siliguri", "Jhansi", "Ulhasnagar", "Jammu", "Sangli-Miraj & Kupwad", "Mangalore", "Erode", "Belgaum", "Ambattur", "Tirunelveli", "Malegaon", "Gaya", "Udaipur", "Maheshtala"
];

const allStates = [
"Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
"Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Lakshadweep", "Delhi", "Puducherry", "Ladakh", "Jammu and Kashmir"
];

function getUserTypeTone(userType?: string): "influencer" | "brand" | "partner" {
if (isInfluencer(userType)) return "influencer";
if (isBrand(userType)) return "brand";
return "partner";
}

export default function ProfileTab({
profile,
setProfile,
user,
referralCode,
badgesCount,
showToast,
}: Readonly<ProfileTabProps>) {
const { update } = useSession();
const [isUploading, setIsUploading] = useState(false);
const profileImageInputRef = useRef<HTMLInputElement>(null);

const [localCategories, setLocalCategories] = useState<string[]>(() => {
return Array.from(new Set([...allCategories, ...(profile.categories || [])]));
});
const [localLanguages, setLocalLanguages] = useState<string[]>(() => {
return Array.from(new Set([...allLanguages, ...(profile.languages || [])]));
});
const [customCategory, setCustomCategory] = useState("");
const [customLanguage, setCustomLanguage] = useState("");

const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side size guard — mirrors backend /api/upload limit for images (5 MB).
    // Checked before the optimistic UI update to avoid flashing a broken Object URL.
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_IMAGE_SIZE) {
      showToast("File too large. Maximum profile image size is 5 MB.", "error");
      if (profileImageInputRef.current) profileImageInputRef.current.value = "";
      return;
    }

    // Optimistic update: instantly render the selected image on the client side
    // using a temporary local Object URL to avoid visual lag while uploading.
    const previousImage = profile?.profileImage; // string | undefined
    // With exactOptionalPropertyTypes, we cannot spread { profileImage: undefined }.
    // Build a revert helper that omits the key when there's no previous image.
    const revertProfileImage = (prev: Profile): Profile => {
      if (previousImage !== undefined) {
        return { ...prev, profileImage: previousImage };
      }
      const { profileImage: _omit, ...rest } = prev;
      return rest as Profile;
    };
    const objectUrl = URL.createObjectURL(file);
    setProfile((prev) => (prev ? { ...prev, profileImage: objectUrl } : null));
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", isBrand(user?.userType) ? "logos" : "avatars");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      const uploadedUrl = data?.data?.url || data?.url;
      if (data.success && uploadedUrl) {
        setProfile((prev) =>
          prev ? { ...prev, profileImage: uploadedUrl } : null,
        );
        // Auto-save only the updated profile image field (prevents redundant/noop write of all other profile fields)
        const saveRes = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileImage: uploadedUrl }),
        });
        if (saveRes.ok) {
          await update(); // Sync session to reflect new image URL on front-end
          showToast("Profile picture updated!", "success");
        } else {
          // Revert optimistic update — settings save failed
          setProfile((prev) => (prev ? revertProfileImage(prev) : null));
          showToast("Failed to save profile picture to settings", "error");
        }
      } else {
        // Revert optimistic update — upload failed
        setProfile((prev) => (prev ? revertProfileImage(prev) : null));
        showToast("Upload failed: " + (data.message || data.error || "Unknown error"), "error");
      }
    } catch (error) {
      logger.error("[profile-tab] Failed to upload avatar:", error);
      // Revert optimistic update — network error
      setProfile((prev) => (prev ? revertProfileImage(prev) : null));
      showToast("Upload failed", "error");
    } finally {
      setIsUploading(false);
      if (profileImageInputRef.current) profileImageInputRef.current.value = "";
      URL.revokeObjectURL(objectUrl);
    }
  };

const toggleCategory = (category: string) => {
if (profile.categories.includes(category)) {
setProfile({
...profile,
categories: profile.categories.filter((c: string) => c !== category),
});
} else if (profile.categories.length < 5) {
setProfile({
...profile,
categories: [...profile.categories, category],
});
}
};

const toggleLanguage = (language: string) => {
if (profile.languages.includes(language)) {
setProfile({
...profile,
languages: profile.languages.filter((l: string) => l !== language),
});
} else {
setProfile({
...profile,
languages: [...profile.languages, language],
});
}
};

return (
<div className="grid-2">
<div className="card">
<div
className="mb-4 rounded-2xl text-xs inline-block px-2 py-1 text-white tracking-wider profile-type-pill"
data-tone={getUserTypeTone(user.userType)}
>
{user.userType} PROFILE
</div>

<div
className="flex justify-center mb-6"
>
<button
type="button"
onClick={() => profileImageInputRef.current?.click()}
aria-label="Change profile image"
className="relative cursor-pointer border-none p-0 bg-none"
>
<div
className="overflow-hidden flex items-center justify-center relative rounded-full profile-avatar-frame"
style={{ width: 100, height: 100, minWidth: 100, minHeight: 100 }}
>
{profile.profileImage ? (
<Image
src={profile.profileImage}
alt="Profile"
width={100}
height={100}
unoptimized
className="object-cover w-full h-full rounded-full"
/>
) : (
<div className="text-3xl">
{isBrand(user.userType) ? (
  <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9 text-secondary">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <line x1="9" y1="22" x2="9" y2="16" />
    <line x1="15" y1="22" x2="15" y2="16" />
    <line x1="9" y1="16" x2="15" y2="16" />
    <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" />
  </svg>
) : (
  <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9 text-secondary">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)}
</div>
)}

{isUploading && (
<div
className="absolute flex items-center justify-center inset-0 profile-upload-overlay"
>
<span
className="loading profile-upload-spinner"
></span>
</div>
)}
</div>
<div
className="absolute flex items-center justify-center text-sm rounded-full text-white bg-color-primary w-32 h-32 profile-camera-button"
>
<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
  <circle cx="12" cy="13" r="3" />
</svg>
</div>
</button>
<input
type="file"
ref={profileImageInputRef}
aria-label="Upload profile photo"
className="hidden"
accept="image/*"
onChange={handleProfileImageUpload}
/>
</div>

<h2
className="text-base font-bold mb-5"
>
Basic Information
</h2>

<div
className="p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-tertiary rounded-md gap-4"
>
<div>
<div
className="text-xs text-secondary uppercase tracking-wider"
>
Your Referral Code
</div>
<div
className="text-xl font-extrabold font-mono break-all"
>
{referralCode || "..."}
</div>
</div>
<div className="text-left sm:text-right">
<div
className="text-xs text-secondary uppercase tracking-wider"
>
Badges Earned
</div>
<div className="text-xl font-extrabold">
{badgesCount}
</div>
<div className="text-xs">
<Link
href="/dashboard/badges"
className="text-primary"
>
View All
</Link>
</div>
</div>
</div>

<div className="mb-5">
<Input
label={isBrand(user.userType) ? "Company Name" : "Display Name"}
type="text"
value={profile.displayName}
onChange={(e) =>
setProfile({ ...profile, displayName: e.target.value })
}
fullWidth
/>
</div>

<div className="mb-5">
<Textarea
label={isBrand(user.userType) ? "Description" : "Bio"}
rows={4}
placeholder={
isBrand(user.userType)
? "Tell influencers about your brand..."
: "Tell brands about yourself..."
}
value={profile.bio}
onChange={(e) =>
setProfile({ ...profile, bio: e.target.value })
}
className="resize-y"
fullWidth
/>
<p
className="text-xs text-muted mt-1"
>
{profile.bio.length}/{isBrand(user.userType) ? 1000 : 300}{" "}
characters
</p>
</div>

{isBrand(user.userType) && (
<div
className="grid-2 gap-4 mb-5"
>
<Input
id="profile-website-input"
label="Website"
type="url"
placeholder="https://example.com"
value={profile.website || ""}
onChange={(e) =>
setProfile({ ...profile, website: e.target.value })
}
fullWidth
/>
<Input
id="profile-industry-input"
label="Industry"
type="text"
placeholder="e.g. Fashion, Tech"
value={profile.industry || ""}
onChange={(e) =>
setProfile({ ...profile, industry: e.target.value })
}
fullWidth
/>
</div>
)}

<div className="grid-2 gap-4">
<div>
<Input
id="profile-city-input"
label="City"
type="text"
list="city-options"
placeholder="Enter or select city"
value={profile.city || ""}
onChange={(e) =>
setProfile({ ...profile, city: e.target.value })
}
fullWidth
/>
<datalist id="city-options">
{allCities.map((city) => (
<option key={city} value={city} />
))}
</datalist>
</div>
<Select
id="profile-state-select"
label="State"
value={profile.state || ""}
onChange={(e) =>
setProfile({ ...profile, state: e.target.value })
}
fullWidth
>
<option value="">Select state</option>
{allStates.map((state) => (
<option key={state} value={state}>
{state}
</option>
))}
</Select>
</div>

<div
className="grid-2 gap-4 mt-4"
>
<Input
id="profile-address-input"
label="Address"
type="text"
placeholder="Street Address or Area"
value={profile.address || ""}
onChange={(e) =>
setProfile({ ...profile, address: e.target.value })
}
fullWidth
/>
<Input
id="profile-pincode-input"
label="Pin Code"
type="text"
placeholder="e.g. 400001"
value={profile.pinCode || ""}
onChange={(e) =>
setProfile({ ...profile, pinCode: e.target.value })
}
fullWidth
/>
</div>

{isInfluencer(user.userType) && (
<div className="grid-2 gap-4 mt-4">
<Select
id="profile-gender-select"
label="Gender"
value={profile.gender || ""}
onChange={(e) =>
setProfile({ ...profile, gender: e.target.value })
}
fullWidth
>
<option value="">Select Gender</option>
<option value="MALE">Male</option>
<option value="FEMALE">Female</option>
<option value="OTHER">Other</option>
</Select>
<Input
id="profile-age-input"
label="Age"
type="number"
placeholder="e.g. 25"
value={profile.age ?? ""}
onChange={(e) =>
setProfile({ ...profile, age: e.target.value ? Number.parseInt(e.target.value, 10) : null })
}
fullWidth
/>
</div>
)}
</div>

{isInfluencer(user.userType) && (
<div className="card">
<h2
className="text-base font-bold mb-5"
>
Categories & Languages
</h2>

<div className="mb-5">
<div className="label">Categories (Select up to 5)</div>
<div
className="flex flex-wrap gap-2"
>
{localCategories.map((category) => (
<Button
key={category}
type="button"
variant="ghost"
onClick={() => toggleCategory(category)}
className="badge cursor-pointer border-none px-3 py-2 profile-choice-chip"
data-selected={profile.categories.includes(category) ? "true" : "false"}
>
{category}
</Button>
))}
</div>
</div>

<div className="mb-5 flex gap-2 items-center">
<Input
type="text"
placeholder="Add custom category..."
value={customCategory}
onChange={(e) => setCustomCategory(e.target.value)}
onKeyDown={(e) => {
if (e.key === 'Enter') {
e.preventDefault();
if (customCategory.trim() && !localCategories.includes(customCategory.trim())) {
setLocalCategories(prev => [...prev, customCategory.trim()]);
toggleCategory(customCategory.trim());
setCustomCategory("");
}
}
}}
className="max-w-200"
/>
<Button
type="button"
variant="secondary"
onClick={() => {
if (customCategory.trim() && !localCategories.includes(customCategory.trim())) {
setLocalCategories(prev => [...prev, customCategory.trim()]);
toggleCategory(customCategory.trim());
setCustomCategory("");
}
}}
>
Add
</Button>
</div>

<div>
<div className="label">Languages</div>
<div
className="flex flex-wrap gap-2"
>
{localLanguages.map((language) => (
<Button
key={language}
type="button"
variant="ghost"
onClick={() => toggleLanguage(language)}
className="badge cursor-pointer border-none px-3 py-2 profile-choice-chip"
data-selected={profile.languages.includes(language) ? "true" : "false"}
>
{language}
</Button>
))}
</div>
</div>

<div className="mt-3 flex gap-2 items-center">
<Input
type="text"
placeholder="Add custom language..."
value={customLanguage}
onChange={(e) => setCustomLanguage(e.target.value)}
onKeyDown={(e) => {
if (e.key === 'Enter') {
e.preventDefault();
if (customLanguage.trim() && !localLanguages.includes(customLanguage.trim())) {
setLocalLanguages(prev => [...prev, customLanguage.trim()]);
toggleLanguage(customLanguage.trim());
setCustomLanguage("");
}
}
}}
className="max-w-200"
/>
<Button
type="button"
variant="secondary"
onClick={() => {
if (customLanguage.trim() && !localLanguages.includes(customLanguage.trim())) {
setLocalLanguages(prev => [...prev, customLanguage.trim()]);
toggleLanguage(customLanguage.trim());
setCustomLanguage("");
}
}}
>
Add
</Button>
</div>
</div>
)}
</div>
);
}
