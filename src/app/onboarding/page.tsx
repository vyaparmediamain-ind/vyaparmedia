"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  User,
  Globe,
  MapPin,
  Tag,
  Languages as LanguagesIcon,
  IndianRupee,
  Loader2,
  Check,
  Building2,
  Camera,
  Video,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { formatUserError } from "@/lib/user-messages";
import Logo from "@/components/Logo";
import { BackButton } from "@/components/ui/BackButton";

const NICHE_ITEMS = [
  { name: "Tech & Gadgets", icon: "💻" },
  { name: "Fashion & Style", icon: "👗" },
  { name: "Beauty & Skincare", icon: "✨" },
  { name: "Fitness & Health", icon: "💪" },
  { name: "Food & Cooking", icon: "🍳" },
  { name: "Travel & Vlogs", icon: "✈️" },
  { name: "Finance & Investing", icon: "📈" },
  { name: "Gaming & Esports", icon: "🎮" },
  { name: "Comedy & Entertainment", icon: "🎭" },
  { name: "Education & Career", icon: "📚" },
  { name: "Parenting & Family", icon: "👨‍👩‍👧" },
  { name: "Automobile", icon: "🚗" },
];

const LANGUAGE_OPTIONS = [
  "Hindi",
  "English",
  "Hinglish",
  "Punjabi",
  "Marathi",
  "Gujarati",
  "Bengali",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
];

const INDUSTRY_OPTIONS = [
  "D2C / E-commerce",
  "Fashion & Apparel",
  "Fintech & Banking",
  "EdTech & Courses",
  "FMCG & Food",
  "Health & Wellness",
  "SaaS & Tech",
  "Gaming & Entertainment",
  "Marketing Agency",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [userType, setUserType] = useState<"INFLUENCER" | "BRAND">("INFLUENCER");
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [bio, setBio] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Tech & Gadgets"]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["English", "Hindi"]);
  const [selectedIndustry, setSelectedIndustry] = useState("D2C / E-commerce");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [youtubeHandle, setYoutubeHandle] = useState("");
  const [website, setWebsite] = useState("");
  const [minRateInr, setMinRateInr] = useState<number | "">("");

  useEffect(() => {
    async function fetchInitialProfile() {
      try {
        const res = await fetch("/api/user/onboarding");
        if (res.ok) {
          const json = await res.json();
          if (json?.data) {
            const data = json.data;
            if (data.userType) setUserType(data.userType);
            if (data.profile) {
              if (data.userType === "INFLUENCER") {
                if (data.profile.displayName) setDisplayName(data.profile.displayName);
                if (data.profile.bio) setBio(data.profile.bio);
                if (data.profile.city) setCity(data.profile.city);
                if (data.profile.state) setState(data.profile.state);
                if (data.profile.instagramHandle) setInstagramHandle(data.profile.instagramHandle);
                if (data.profile.youtubeHandle) setYoutubeHandle(data.profile.youtubeHandle);
                if (data.profile.minRate) setMinRateInr(Math.round(data.profile.minRate / 100));
                if (data.profile.categories && data.profile.categories !== "General") {
                  setSelectedCategories(data.profile.categories.split(",").map((s: string) => s.trim()));
                }
              } else {
                if (data.profile.companyName) setCompanyName(data.profile.companyName);
                if (data.profile.description) setDescription(data.profile.description);
                if (data.profile.city) setCity(data.profile.city);
                if (data.profile.state) setState(data.profile.state);
                if (data.profile.website) setWebsite(data.profile.website);
              }
            }
          }
        }
      } catch {
        // Non-blocking fallback
      } finally {
        setIsFetching(false);
      }
    }
    fetchInitialProfile();
  }, []);

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length > 1) {
        setSelectedCategories(selectedCategories.filter((c) => c !== cat));
      }
    } else {
      if (selectedCategories.length < 5) {
        setSelectedCategories([...selectedCategories, cat]);
      }
    }
  };

  const toggleLanguage = (lang: string) => {
    if (selectedLanguages.includes(lang)) {
      if (selectedLanguages.length > 1) {
        setSelectedLanguages(selectedLanguages.filter((l) => l !== lang));
      }
    } else {
      setSelectedLanguages([...selectedLanguages, lang]);
    }
  };

  const handleNext = () => {
    setErrorMsg(null);
    if (step === 1) {
      if (userType === "INFLUENCER" && !displayName.trim()) {
        setErrorMsg("Please enter your name or creator alias.");
        return;
      }
      if (userType === "BRAND" && !companyName.trim()) {
        setErrorMsg("Please enter your brand or company name.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (userType === "INFLUENCER" && selectedCategories.length === 0) {
        setErrorMsg("Please select at least one content niche.");
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const payload: Record<string, unknown> = {
        userType,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
      };

      if (userType === "INFLUENCER") {
        payload.displayName = displayName.trim();
        payload.bio = bio.trim() || undefined;
        payload.categories = selectedCategories;
        payload.languages = selectedLanguages;
        payload.instagramHandle = instagramHandle.trim() || undefined;
        payload.youtubeHandle = youtubeHandle.trim() || undefined;
        if (minRateInr !== "") payload.minRateInr = Number(minRateInr);
      } else {
        payload.companyName = companyName.trim();
        payload.description = description.trim() || undefined;
        payload.industry = selectedIndustry;
        payload.website = website.trim() || undefined;
      }

      const res = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to save profile settings");
      }

      setStep(4);
    } catch (err: unknown) {
      setErrorMsg(formatUserError(err, "Failed to save onboarding details. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Preparing your setup...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Header Bar */}
      <header className="max-w-3xl w-full mx-auto flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/dashboard" label="Back" variant="pill" />
          <Logo />
        </div>
        {step < 4 && (
          <Link
            href="/dashboard"
            className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now &rarr;
          </Link>
        )}
      </header>

      {/* Main Wizard Card */}
      <main className="max-w-2xl w-full mx-auto my-auto py-6">
        {/* Progress Stepper Bar */}
        {step < 4 && (
          <div className="mb-6 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <span>Step {step} of 3</span>
              <span className="tabular-nums">
                {step === 1 ? "33%" : step === 2 ? "66%" : "100%"} Complete
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }}
              />
            </div>
          </div>
        )}

        {/* Card Surface */}
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          {errorMsg && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2"
            >
              <span className="shrink-0 text-base">⚠️</span>
              <p>{errorMsg}</p>
            </div>
          )}

          {/* STEP 1: ROLE & CORE IDENTITY */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  Welcome! Tell us about yourself
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Choose your account focus so we can personalize your marketplace experience.
                </p>
              </div>

              {/* Role Selection Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setUserType("INFLUENCER")}
                  className={`p-5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                    userType === "INFLUENCER"
                      ? "border-primary bg-primary/5 text-foreground shadow-sm"
                      : "border-border hover:border-primary/40 bg-card text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                    {userType === "INFLUENCER" && (
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base">Creator / Influencer</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Monetize content, apply to brand deals, and receive safe escrow payouts.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setUserType("BRAND")}
                  className={`p-5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                    userType === "BRAND"
                      ? "border-primary bg-primary/5 text-foreground shadow-sm"
                      : "border-border hover:border-primary/40 bg-card text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Building2 className="w-5 h-5" />
                    </div>
                    {userType === "BRAND" && (
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base">Brand / Marketer</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Launch campaigns, discover vetted creators, and manage payouts safely.
                    </p>
                  </div>
                </button>
              </div>

              {/* Name & Location Inputs */}
              <div className="space-y-4 pt-2">
                {userType === "INFLUENCER" ? (
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5" htmlFor="creator-name">
                      Display Name / Creator Alias <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="creator-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Rohan Varma"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5" htmlFor="brand-name">
                      Company / Brand Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="brand-name"
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Aura Lifestyle India Pvt Ltd"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5" htmlFor="city-input">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>City</span>
                    </label>
                    <input
                      id="city-input"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Bengaluru"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5" htmlFor="state-input">
                      State
                    </label>
                    <input
                      id="state-input"
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. Karnataka"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-primary/20 transition-all active:scale-95"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: NICHE, CATEGORIES & LANGUAGES */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  {userType === "INFLUENCER" ? "What content do you create?" : "What industry are you in?"}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  This helps match you with high-converting brand sponsorships and targeted discovery.
                </p>
              </div>

              {userType === "INFLUENCER" ? (
                <>
                  {/* Category Cards with visual icons */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-primary" />
                        <span>Content Niches (Pick up to 5)</span>
                      </span>
                      <span className="text-[11px] text-muted-foreground font-normal">
                        {selectedCategories.length}/5 selected
                      </span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {NICHE_ITEMS.map((niche) => {
                        const isSelected = selectedCategories.includes(niche.name);
                        return (
                          <button
                            key={niche.name}
                            type="button"
                            onClick={() => toggleCategory(niche.name)}
                            className={`p-3 rounded-xl text-left border transition-all flex items-center justify-between ${
                              isSelected
                                ? "bg-primary/10 border-primary text-primary shadow-xs font-bold"
                                : "bg-muted/40 border-border text-foreground hover:border-primary/50 text-xs font-medium"
                            }`}
                          >
                            <span className="flex items-center gap-2 text-xs truncate">
                              <span className="text-base shrink-0">{niche.icon}</span>
                              <span className="truncate">{niche.name}</span>
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Language Pills */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-foreground flex items-center gap-1.5">
                      <LanguagesIcon className="w-3.5 h-3.5 text-primary" />
                      <span>Languages You Create In</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {LANGUAGE_OPTIONS.map((lang) => {
                        const isSelected = selectedLanguages.includes(lang);
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => toggleLanguage(lang)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                              isSelected
                                ? "bg-primary border-primary text-primary-foreground shadow-xs"
                                : "bg-muted border-border text-foreground hover:border-primary/50"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            <span>{lang}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Short Bio */}
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5" htmlFor="creator-bio">
                      Short Bio
                    </label>
                    <textarea
                      id="creator-bio"
                      rows={3}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell brands about your aesthetic style, audience demographic, and past collaborations..."
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm resize-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Brand Industry */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-primary" />
                      <span>Select Primary Industry</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {INDUSTRY_OPTIONS.map((ind) => {
                        const isSelected = selectedIndustry === ind;
                        return (
                          <button
                            key={ind}
                            type="button"
                            onClick={() => setSelectedIndustry(ind)}
                            className={`p-3 rounded-xl text-left text-xs font-bold border transition-all ${
                              isSelected
                                ? "bg-primary/10 border-primary text-primary shadow-xs"
                                : "bg-muted border-border text-foreground hover:border-primary/50"
                            }`}
                          >
                            {ind}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Brand Overview Description */}
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5" htmlFor="brand-overview">
                      Brand Overview
                    </label>
                    <textarea
                      id="brand-overview"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What products or services does your brand offer to Indian consumers?"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm resize-none"
                    />
                  </div>
                </>
              )}

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 rounded-xl border border-border hover:bg-muted font-bold text-xs sm:text-sm flex items-center gap-2 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-primary/20 transition-all active:scale-95"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SOCIAL HANDLES & COMMERCIAL RATES */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  {userType === "INFLUENCER" ? "Link Socials & Commercial Rates" : "Brand Website & Online Presence"}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {userType === "INFLUENCER"
                    ? "Add your social handles so brands can review your portfolio and send verified offers."
                    : "Add your official website so creators can research your brand before accepting proposals."}
                </p>
              </div>

              {userType === "INFLUENCER" ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5" htmlFor="insta-handle">
                      <Camera className="w-4 h-4 text-pink-600" />
                      <span>Instagram Handle</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-muted-foreground font-bold text-xs sm:text-sm">@</span>
                      <input
                        id="insta-handle"
                        type="text"
                        value={instagramHandle}
                        onChange={(e) => setInstagramHandle(e.target.value)}
                        placeholder="your_handle"
                        className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5" htmlFor="yt-handle">
                      <Video className="w-4 h-4 text-red-600" />
                      <span>YouTube Channel / Handle</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-muted-foreground font-bold text-xs sm:text-sm">@</span>
                      <input
                        id="yt-handle"
                        type="text"
                        value={youtubeHandle}
                        onChange={(e) => setYoutubeHandle(e.target.value)}
                        placeholder="channel_handle"
                        className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5" htmlFor="min-rate">
                      <IndianRupee className="w-4 h-4 text-verified" />
                      <span>Starting Commercial Rate per Deliverable (₹)</span>
                    </label>
                    <input
                      id="min-rate"
                      type="number"
                      value={minRateInr}
                      onChange={(e) => setMinRateInr(e.target.value ? Number(e.target.value) : "")}
                      placeholder="e.g. 5000"
                      min="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm tabular-nums"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      You can adjust your deal pricing anytime when negotiating custom deliverables with brands.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5" htmlFor="brand-website">
                      <Globe className="w-4 h-4 text-primary" />
                      <span>Company Website</span>
                    </label>
                    <input
                      id="brand-website"
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 flex items-center justify-between flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 rounded-xl border border-border hover:bg-muted font-bold text-xs sm:text-sm flex items-center gap-2 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleSubmit}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    Skip &amp; Finish
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleSubmit}
                    className="px-7 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-primary/25 transition-all disabled:opacity-50 active:scale-95"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving Profile...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Setup</span>
                        <Sparkles className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: CELEBRATION & ENTER DASHBOARD */}
          {step === 4 && (
            <div className="text-center py-8 space-y-6 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-2xl bg-verified-muted text-verified border border-verified-border mx-auto flex items-center justify-center shadow-md">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-foreground tracking-tight">
                  You&apos;re All Set!
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Your profile has been successfully configured. You can now access your dashboard, discover collaborations, and start closing escrow-secured deals.
                </p>
              </div>

              {/* Escrow Guarantee Highlight */}
              <div className="p-4 rounded-2xl bg-escrow-muted border border-escrow-border text-xs text-escrow max-w-md mx-auto text-left flex items-center gap-3">
                <Lock className="w-5 h-5 shrink-0" />
                <span>
                  All collaborations on VyaparMedia are protected by 100% RBI-compliant escrow. Funds are locked before production begins.
                </span>
              </div>

              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => router.push(userType === "BRAND" ? "/dashboard/campaigns" : "/dashboard")}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/25 transition-all active:scale-95"
                >
                  <span>Enter Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Trust Footer */}
      <footer className="max-w-3xl w-full mx-auto text-center py-4 text-xs text-muted-foreground flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-verified" />
        <span>&copy; {new Date().getFullYear()} VyaparMedia Technologies. All rights reserved.</span>
      </footer>
    </div>
  );
}
