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
    legalName: remote?.legalName || PLATFORM_CONFIG.legalName,
    tradeName: remote?.tradeName || PLATFORM_CONFIG.tradeName,
    constitution: remote?.constitution || PLATFORM_CONFIG.constitution,
    address: remote?.address || PLATFORM_CONFIG.address,
    addressLine1: remote?.addressLine1 || PLATFORM_CONFIG.addressLine1,
    addressLine2: remote?.addressLine2 || PLATFORM_CONFIG.addressLine2,
    city: remote?.city || PLATFORM_CONFIG.city,
    district: remote?.district || PLATFORM_CONFIG.district,
    state: remote?.state || PLATFORM_CONFIG.state,
    stateCode: remote?.stateCode || PLATFORM_CONFIG.stateCode,
    pincode: remote?.pincode || PLATFORM_CONFIG.pincode,
    gstin: remote?.gstin || PLATFORM_CONFIG.gstin,
    cin: remote?.cin || PLATFORM_CONFIG.cin,
    udyam: remote?.udyam || PLATFORM_CONFIG.udyam,
    email: remote?.email || PLATFORM_CONFIG.email,
    officialEmail: remote?.officialEmail || PLATFORM_CONFIG.officialEmail,
    billingEmail: remote?.billingEmail || PLATFORM_CONFIG.billingEmail,
    legalEmail: remote?.legalEmail || PLATFORM_CONFIG.legalEmail,
    privacyEmail: remote?.privacyEmail || PLATFORM_CONFIG.privacyEmail,
    grievanceEmail: remote?.grievanceEmail || PLATFORM_CONFIG.grievanceEmail,
    grievanceOfficer: remote?.grievanceOfficer || PLATFORM_CONFIG.grievanceOfficer,
    phone: remote?.phone || PLATFORM_CONFIG.phone,
    website: remote?.website || PLATFORM_CONFIG.website,
    sacCode: remote?.sacCode || PLATFORM_CONFIG.sacCode,
    domain: remote?.domain || PLATFORM_CONFIG.domain,
  };
}

export default usePlatformConfig;
