"use client";

import useSWR from "swr";
import { useSession } from "next-auth/react";
import { PLATFORM_CONFIG } from "@/lib/platform-config";
import { fetcher } from "@/lib/fetcher";

interface PlatformConfigResponse {
  success: boolean;
  data: {
    name?: string;
    legalName?: string;
    tradeName?: string;
    constitution?: string;
    address?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    district?: string;
    state?: string;
    stateCode?: string;
    pincode?: string;
    gstin?: string;
    pan?: string;
    cin?: string;
    udyam?: string;
    email?: string;
    officialEmail?: string;
    billingEmail?: string;
    legalEmail?: string;
    privacyEmail?: string;
    grievanceEmail?: string;
    grievanceOfficer?: string;
    phone?: string;
    website?: string;
    sacCode?: string;
    domain?: string;
  };
}

export function usePlatformConfig() {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user?.id);

  const { data } = useSWR<PlatformConfigResponse>(
    isAuthenticated
      ? "/api/reports/platform-config"
      : "/api/public/platform-config",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    },
  );

  const remote = data?.data;

  return {
    name: remote?.name || PLATFORM_CONFIG.name,
    legalName: remote?.legalName || (isAuthenticated ? PLATFORM_CONFIG.legalName : ""),
    tradeName: remote?.tradeName || PLATFORM_CONFIG.tradeName,
    constitution: remote?.constitution || (isAuthenticated ? PLATFORM_CONFIG.constitution : ""),
    address: remote?.address || (isAuthenticated ? PLATFORM_CONFIG.address : ""),
    addressLine1: remote?.addressLine1 || (isAuthenticated ? PLATFORM_CONFIG.addressLine1 : ""),
    addressLine2: remote?.addressLine2 || (isAuthenticated ? PLATFORM_CONFIG.addressLine2 : ""),
    city: remote?.city || PLATFORM_CONFIG.city,
    district: remote?.district || (isAuthenticated ? PLATFORM_CONFIG.district : ""),
    state: remote?.state || PLATFORM_CONFIG.state,
    stateCode: remote?.stateCode || (isAuthenticated ? PLATFORM_CONFIG.stateCode : ""),
    pincode: remote?.pincode || (isAuthenticated ? PLATFORM_CONFIG.pincode : ""),
    gstin: remote?.gstin || (isAuthenticated ? PLATFORM_CONFIG.gstin : ""),
    pan: remote?.pan || (isAuthenticated ? PLATFORM_CONFIG.pan : ""),
    cin: remote?.cin || (isAuthenticated ? PLATFORM_CONFIG.cin : ""),
    udyam: remote?.udyam || (isAuthenticated ? PLATFORM_CONFIG.udyam : ""),
    email: remote?.email || PLATFORM_CONFIG.email,
    officialEmail: remote?.officialEmail || (isAuthenticated ? PLATFORM_CONFIG.officialEmail : ""),
    billingEmail: remote?.billingEmail || (isAuthenticated ? PLATFORM_CONFIG.billingEmail : ""),
    legalEmail: remote?.legalEmail || (isAuthenticated ? PLATFORM_CONFIG.legalEmail : ""),
    privacyEmail: remote?.privacyEmail || (isAuthenticated ? PLATFORM_CONFIG.privacyEmail : ""),
    grievanceEmail: remote?.grievanceEmail || (isAuthenticated ? PLATFORM_CONFIG.grievanceEmail : ""),
    grievanceOfficer: remote?.grievanceOfficer || (isAuthenticated ? PLATFORM_CONFIG.grievanceOfficer : ""),
    phone: remote?.phone || (isAuthenticated ? PLATFORM_CONFIG.phone : ""),
    website: remote?.website || PLATFORM_CONFIG.website,
    sacCode: remote?.sacCode || (isAuthenticated ? PLATFORM_CONFIG.sacCode : ""),
    domain: remote?.domain || PLATFORM_CONFIG.domain,
  };
}

export default usePlatformConfig;
