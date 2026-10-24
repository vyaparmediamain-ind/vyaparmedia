"use client";

import { logger } from "@/lib/logger-client";
import Link from "next/link";
import { useState, useRef, useMemo } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { type NotificationPreferences } from "./NotificationPreferencesPanel";
import { isBrand, isInfluencer } from "@/lib/rbac";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { ALL_CATEGORIES } from "@/lib/categories";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import { copyToClipboard } from "@/lib/clipboard";
import {
  User as UserIcon,
  Camera,
  MapPin,
  Layers,
  Sparkles,
  Building2,
  CheckCircle2,
  Copy,
  Award,
  Briefcase,
  Plus,
  Smartphone,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import StoryShareModal from "@/components/share/StoryShareModal";

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
  companyName?: string;
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
  trustScore?: number;
  verificationLevel?: string;
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

export default function ProfileTab({
  profile,
  setProfile,
  user,
  referralCode,
  badgesCount,
  showToast,
}: Readonly<ProfileTabProps>) {
  const { data: session, update } = useSession();
  const [isUploading, setIsUploading] = useState(false);
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const [customCategory, setCustomCategory] = useState("");
  const [customLanguage, setCustomLanguage] = useState("");
  const [localCategories, setLocalCategories] = useState<string[]>([...allCategories]);
  const [localLanguages, setLocalLanguages] = useState<string[]>([...allLanguages]);

  // Profile strength score
  const completenessScore = useMemo(() => {
    let score = 0;
    if (profile.displayName?.trim()) score += 25;
    if (profile.bio?.trim()) score += 25;
    if (profile.profileImage) score += 20;
    if (profile.city?.trim() || profile.state?.trim()) score += 15;
    if (isBrand(user.userType)) {
      if (profile.website?.trim() || profile.industry?.trim()) score += 15;
    } else {
      if (profile.categories?.length > 0) score += 15;
    }
    return score;
  }, [profile, user.userType]);

  const handleProfileImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast("Image size must be less than 10MB", "error");
      return;
    }

    setIsUploading(true);
    const objectUrl = URL.createObjectURL(file);
    const previousImage = profile.profileImage;
    setProfile((prev) => (prev ? { ...prev, profileImage: objectUrl } : null));

    const revertProfileImage = (curr: Profile): Profile => {
      const copy: Profile = { ...curr };
      if (previousImage !== undefined) {
        copy.profileImage = previousImage;
      } else {
        delete copy.profileImage;
      }
      return copy;
    };

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "avatars");
      formData.append("type", "avatar");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as {
        success?: boolean;
        url?: string;
        fileUrl?: string;
        message?: string;
        error?: string;
        data?: { url?: string; fileUrl?: string };
      };
      const uploadedUrl = data.url || data.fileUrl || data.data?.url || data.data?.fileUrl;

      if (data.success && uploadedUrl) {
        setProfile((prev) =>
          prev ? { ...prev, profileImage: uploadedUrl } : null,
        );
        try {
          await apiClient.settings.save({ profileImage: uploadedUrl });
          await update();
          showToast("Profile picture updated!", "success");
        } catch (saveErr) {
          setProfile((prev) => (prev ? revertProfileImage(prev) : null));
          showToast(
            saveErr instanceof ApiClientError
              ? saveErr.message
              : "Failed to save profile picture to settings",
            "error",
          );
        }
      } else {
        setProfile((prev) => (prev ? revertProfileImage(prev) : null));
        showToast(
          formatUserError(
            data.message || data.error,
            "Upload failed. Please ensure file is an image under 10MB.",
          ),
          "error",
        );
      }
    } catch (error) {
      logger.error("[profile-tab] Failed to upload avatar:", error);
      setProfile((prev) => (prev ? revertProfileImage(prev) : null));
      showToast(
        formatUserError(
          error,
          "Upload failed. Please ensure file is an image under 10MB.",
        ),
        "error",
      );
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
    } else {
      showToast("Maximum 5 categories allowed", "info");
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
    <div className="space-y-6 max-w-4xl">
      {/* 1. Overview Status Card (matching KYC TierStatusCardComponent) */}
      <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Profile &amp; Marketplace Identity
            </span>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <UserIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                  {profile.displayName || user.name || "Your Profile"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isBrand(user.userType)
                    ? "Your brand's public profile visible to creators on the marketplace"
                    : "Your creator media kit and portfolio visible to prospective brands"}
                </p>
              </div>
            </div>
          </div>

          <div className="sm:text-right p-3 sm:p-0 rounded-xl bg-muted/30 sm:bg-transparent border sm:border-0 border-border">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Account Role
            </span>
            <div className="mt-1">
              {isBrand(user.userType) ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                  <Building2 className="w-3.5 h-3.5" /> Brand Account
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-1 rounded-full border border-verified-border">
                  <Sparkles className="w-3.5 h-3.5" /> Creator Account
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              {badgesCount} Badges Earned
            </span>
            <div className="mt-2 flex items-center sm:justify-end">
              {isBrand(user.userType) ? (() => {
                const brandTarget =
                  user?.id ||
                  session?.user?.id ||
                  (profile as unknown as { id?: string })?.id ||
                  (profile.displayName ? encodeURIComponent(profile.displayName.trim()) : "") ||
                  (user.name ? encodeURIComponent(user.name.trim()) : "");
                if (!brandTarget || brandTarget === "undefined") return null;
                return (
                  <Link
                    href={`/brand/${brandTarget}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline transition-colors"
                  >
                    <span>View Public Profile</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                );
              })() : profile.instagramHandle ? (
                <Link
                  href={`/creator/${encodeURIComponent(profile.instagramHandle)}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-verified hover:underline transition-colors"
                >
                  <span>View Public Profile</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        {/* Profile Strength Bar */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-verified" /> Profile Completion Strength
            </span>
            <span className="text-foreground font-bold tabular-nums">
              {completenessScore}% Complete
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-verified h-full rounded-full transition-all duration-300"
              style={{ width: `${completenessScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Avatar & Referral Identity Card */}
      <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                Avatar &amp; Referral Program
              </h3>
              <p className="text-xs text-muted-foreground">
                Upload your high-resolution profile image or official brand logo
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-1 rounded-full border border-verified-border">
            <CheckCircle2 className="w-3.5 h-3.5" /> Live on Marketplace
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 pt-1">
          {/* Avatar frame */}
          <div className="relative group shrink-0">
            <button
              type="button"
              onClick={() => profileImageInputRef.current?.click()}
              aria-label="Change profile image"
              className="relative rounded-full overflow-hidden w-24 h-24 border-2 border-border group-hover:border-primary transition-all cursor-pointer flex items-center justify-center bg-muted/40"
            >
              {profile.profileImage ? (
                <Image
                  src={profile.profileImage}
                  alt="Profile"
                  width={96}
                  height={96}
                  unoptimized
                  className="object-cover w-full h-full rounded-full"
                />
              ) : (
                <div className="text-muted-foreground">
                  {isBrand(user.userType) ? (
                    <Building2 className="w-8 h-8 text-muted-foreground" />
                  ) : (
                    <UserIcon className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
              )}

              {isUploading ? (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : (
                <div className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-primary-foreground">
                  <Camera className="w-5 h-5" />
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => profileImageInputRef.current?.click()}
              aria-label="Upload photo"
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
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

          {/* Referral & Badges cards */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border flex flex-col justify-between">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
                Your Referral Code
              </span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-base font-extrabold text-foreground">
                  {referralCode || "..."}
                </span>
                {referralCode && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStoryModalOpen(true)}
                      className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                      title="Post referral or profile to Instagram / WhatsApp Story"
                    >
                      <Smartphone className="w-3 h-3" /> Story Card
                    </button>
                    <span className="text-muted-foreground/40">•</span>
                    <button
                      type="button"
                      onClick={() => {
                        copyToClipboard(referralCode);
                        showToast("Referral code copied!", "success");
                      }}
                      className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/30 border border-border flex flex-col justify-between">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
                Marketplace Badges
              </span>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-verified" />
                  <span className="text-base font-extrabold text-foreground">
                    {badgesCount}
                  </span>
                </div>
                <Link
                  href="/dashboard/badges"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  View All Badges →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Basic Identity Details Card */}
      <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              Basic Details &amp; Bio
            </h3>
            <p className="text-xs text-muted-foreground">
              Public representation and description shown on marketplace search
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Input
            label={isBrand(user.userType) ? "Company / Brand Name" : "Display Name"}
            type="text"
            value={profile.displayName}
            onChange={(e) =>
              setProfile({ ...profile, displayName: e.target.value })
            }
            fullWidth
          />

          <div>
            <Textarea
              label={isBrand(user.userType) ? "Brand Description" : "Public Bio"}
              rows={4}
              placeholder={
                isBrand(user.userType)
                  ? "Describe your brand values, target audience, and campaign goals..."
                  : "Introduce yourself, your content style, and previous brand collaborations..."
              }
              value={profile.bio}
              onChange={(e) =>
                setProfile({ ...profile, bio: e.target.value })
              }
              className="resize-y"
              fullWidth
            />
            <div className="flex justify-between items-center text-[11px] text-muted-foreground mt-1">
              <span>Markdown supported</span>
              <span>
                {profile.bio.length} / {isBrand(user.userType) ? 1000 : 300} characters
              </span>
            </div>
          </div>

          {isBrand(user.userType) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="profile-website-input"
                label="Official Website URL"
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
                label="Industry Vertical"
                type="text"
                placeholder="e.g. D2C Fashion, Consumer Tech, FinTech"
                value={profile.industry || ""}
                onChange={(e) =>
                  setProfile({ ...profile, industry: e.target.value })
                }
                fullWidth
              />
            </div>
          )}
        </div>
      </div>

      {/* 4. Location & Logistics Address Card */}
      <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              {isBrand(user.userType)
                ? "Location & Warehouse / Pickup Address"
                : "Location & Product Delivery Address"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isBrand(user.userType)
                ? "Registered warehouse address used for automated 1-click Shiprocket courier pickups"
                : "Geographical location and confidential delivery address for campaign sample seeding deals"}
            </p>
          </div>
        </div>

        {/* Confidentiality Guarantee Banner */}
        {isBrand(user.userType) ? (
          <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs flex items-start gap-2.5 text-foreground">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-primary">Confidential Pickup Location</p>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Your warehouse and pickup address is used strictly for automated courier pickups (Delhivery, BlueDart, DTDC via Shiprocket). Creators never see your warehouse address.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-verified-muted border border-verified-border text-xs flex items-start gap-2.5 text-foreground">
            <ShieldCheck className="w-4 h-4 text-verified shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-verified">100% Confidential Delivery Address</p>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Your street address and PIN code are securely stored and NEVER shared with brands. When you accept product deals, our automated logistics partners deliver directly to you with zero data exposure.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              label="State / Union Territory"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="profile-address-input"
              label={
                isBrand(user.userType)
                  ? "Warehouse / Pickup Street Address"
                  : "Default Delivery Street Address"
              }
              type="text"
              placeholder={
                isBrand(user.userType)
                  ? "Street address, building, landmark"
                  : "House / Flat No., Street, Area"
              }
              value={profile.address || ""}
              onChange={(e) =>
                setProfile({ ...profile, address: e.target.value })
              }
              fullWidth
            />
            <Input
              id="profile-pincode-input"
              label={
                isBrand(user.userType)
                  ? "Pickup PIN Code (6 digits)"
                  : "Delivery PIN Code (6 digits)"
              }
              type="text"
              placeholder="e.g. 400001"
              maxLength={6}
              value={profile.pinCode || ""}
              onChange={(e) =>
                setProfile({ ...profile, pinCode: e.target.value })
              }
              fullWidth
            />
          </div>

          {/* Delivery Contact Phone — read from User.phone, updatable via Account tab */}
          {isInfluencer(user.userType) && (
            <div className="p-3.5 rounded-xl border border-border bg-muted/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-foreground">Delivery Contact Phone</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {user.phone ? (
                      <span className="font-mono text-foreground">+91 {user.phone}</span>
                    ) : (
                      <span className="text-amber-500 font-medium">⚠️ Not set — required for Shiprocket courier delivery</span>
                    )}
                  </div>
                </div>
              </div>
              <a
                href="/dashboard/settings?tab=account"
                className="text-xs text-primary font-bold hover:underline shrink-0"
              >
                {user.phone ? "Change" : "Add Phone"}
              </a>
            </div>
          )}

          {isInfluencer(user.userType) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  setProfile({
                    ...profile,
                    age: e.target.value
                      ? Number.parseInt(e.target.value, 10)
                      : null,
                  })
                }
                fullWidth
              />
            </div>
          )}
        </div>
      </div>

      {/* 5. Categories & Languages Card (for Influencers) */}
      {isInfluencer(user.userType) && (
        <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  Categories &amp; Content Languages
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select up to 5 niches and languages you produce creator content in
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
              {profile.categories.length}/5 Selected
            </span>
          </div>

          {/* Categories */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-foreground block">
              Content Categories (Niches)
            </span>
            <div className="flex flex-wrap gap-2">
              {localCategories.map((category) => {
                const isSelected = profile.categories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:border-border/80"
                    }`}
                  >
                    {category} {isSelected && "✓"}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 items-center max-w-sm pt-1">
              <Input
                type="text"
                placeholder="Add custom niche..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (
                      customCategory.trim() &&
                      !localCategories.includes(customCategory.trim())
                    ) {
                      setLocalCategories((prev) => [...prev, customCategory.trim()]);
                      toggleCategory(customCategory.trim());
                      setCustomCategory("");
                    }
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  if (
                    customCategory.trim() &&
                    !localCategories.includes(customCategory.trim())
                  ) {
                    setLocalCategories((prev) => [...prev, customCategory.trim()]);
                    toggleCategory(customCategory.trim());
                    setCustomCategory("");
                  }
                }}
                className="text-xs font-bold shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            </div>
          </div>

          {/* Languages */}
          <div className="space-y-3 pt-3 border-t border-border">
            <span className="text-xs font-bold text-foreground block">
              Content Languages
            </span>
            <div className="flex flex-wrap gap-2">
              {localLanguages.map((language) => {
                const isSelected = profile.languages.includes(language);
                return (
                  <button
                    key={language}
                    type="button"
                    onClick={() => toggleLanguage(language)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:border-border/80"
                    }`}
                  >
                    {language} {isSelected && "✓"}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 items-center max-w-sm pt-1">
              <Input
                type="text"
                placeholder="Add custom language..."
                value={customLanguage}
                onChange={(e) => setCustomLanguage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (
                      customLanguage.trim() &&
                      !localLanguages.includes(customLanguage.trim())
                    ) {
                      setLocalLanguages((prev) => [...prev, customLanguage.trim()]);
                      toggleLanguage(customLanguage.trim());
                      setCustomLanguage("");
                    }
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  if (
                    customLanguage.trim() &&
                    !localLanguages.includes(customLanguage.trim())
                  ) {
                    setLocalLanguages((prev) => [...prev, customLanguage.trim()]);
                    toggleLanguage(customLanguage.trim());
                    setCustomLanguage("");
                  }
                }}
                className="text-xs font-bold shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Story Share Modal (Public Profile & Referral Story) */}
      <StoryShareModal
        open={storyModalOpen}
        onClose={() => setStoryModalOpen(false)}
        defaultTab={referralCode && !profile.instagramHandle && user.userType !== "BRAND" ? "referral" : "profile"}
        referralCode={referralCode}
        userType={user.userType}
        profile={{
          displayName: profile.displayName || profile.companyName || user.name || (user.userType === "BRAND" ? "Verified Brand" : "Vyapar Creator"),
          username: user.userType === "BRAND"
            ? (profile.companyName?.toLowerCase().replace(/[^a-z0-9]/g, "") || user.id.slice(-8) || "brand")
            : (profile.instagramHandle?.replace(/^@/, "").toLowerCase() || user.id.slice(-8) || "creator"),
          avatar: profile.profileImage,
          trustScore: user.trustScore ?? (user.userType === "BRAND" ? 750 : 600),
          categories: profile.categories,
          city: profile.city,
          companyName: profile.companyName,
          industry: profile.industry,
          website: profile.website,
          isKycVerified: true,
          userType: user.userType,
        }}
      />
    </div>
  );
}
