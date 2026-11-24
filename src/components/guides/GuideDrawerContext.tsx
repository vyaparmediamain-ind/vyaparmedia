"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import type { GuideUserType } from "@/lib/guides/schema";

export type GuideLanguage = "en" | "hinglish";

interface GuideDrawerContextType {
  isOpen: boolean;
  activeLanguage: GuideLanguage;
  selectedGuideId: string | null;
  selectedStepAnchor: string | null;
  userRole: GuideUserType | null;
  openGuideDrawer: (guideId?: string, stepAnchor?: string) => void;
  closeGuideDrawer: () => void;
  setLanguage: (lang: GuideLanguage) => void;
  toggleLanguage: () => void;
}

const GuideDrawerContext = createContext<GuideDrawerContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = "vm_guide_language_pref";

export function GuideDrawerProvider({
  children,
  initialRole = null,
}: {
  readonly children: React.ReactNode;
  readonly initialRole?: GuideUserType | null;
}) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [activeLanguage, setActiveLanguageState] = useState<GuideLanguage>("en");
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const [selectedStepAnchor, setSelectedStepAnchor] = useState<string | null>(null);

  const rawRole = (session?.user?.userType || initialRole || "INFLUENCER").toUpperCase();
  const validRoles: GuideUserType[] = ["INFLUENCER", "BRAND", "SCOUT", "ADMIN"];
  const userRole: GuideUserType = validRoles.includes(rawRole as GuideUserType)
    ? (rawRole as GuideUserType)
    : "INFLUENCER";

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLang === "en" || savedLang === "hinglish") {
        setActiveLanguageState(savedLang);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const setLanguage = useCallback((lang: GuideLanguage) => {
    setActiveLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // localStorage not available
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(activeLanguage === "en" ? "hinglish" : "en");
  }, [activeLanguage, setLanguage]);

  const openGuideDrawer = useCallback((guideId?: string, stepAnchor?: string) => {
    if (guideId) {
      setSelectedGuideId(guideId);
    }
    if (stepAnchor) {
      setSelectedStepAnchor(stepAnchor);
    }
    setIsOpen(true);
  }, []);

  const closeGuideDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      activeLanguage,
      selectedGuideId,
      selectedStepAnchor,
      userRole,
      openGuideDrawer,
      closeGuideDrawer,
      setLanguage,
      toggleLanguage,
    }),
    [
      isOpen,
      activeLanguage,
      selectedGuideId,
      selectedStepAnchor,
      userRole,
      openGuideDrawer,
      closeGuideDrawer,
      setLanguage,
      toggleLanguage,
    ]
  );

  return (
    <GuideDrawerContext.Provider value={value}>
      {children}
    </GuideDrawerContext.Provider>
  );
}

export function useGuideDrawer(): GuideDrawerContextType {
  const context = useContext(GuideDrawerContext);
  if (!context) {
    // Graceful fallback if called outside provider
    return {
      isOpen: false,
      activeLanguage: "en",
      selectedGuideId: null,
      selectedStepAnchor: null,
      userRole: null,
      openGuideDrawer: () => {},
      closeGuideDrawer: () => {},
      setLanguage: () => {},
      toggleLanguage: () => {},
    };
  }
  return context;
}
