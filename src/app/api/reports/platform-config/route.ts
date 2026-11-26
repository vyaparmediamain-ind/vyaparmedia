import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

export const dynamic = "force-dynamic";

/**
 * Authenticated Corporate Details Endpoint for Official Letterheads & Reports
 * Restricted strictly to authenticated platform members generating official statements,
 * tax reports, or signed agreements under Indian Evidence & Tax Acts.
 * Anonymous scraping and public crawling are rejected with 401 Unauthorized.
 */
export const GET = apiWrapper(
  async () => {
    return ApiResponse.success({
      name: PLATFORM_CONFIG.name,
      legalName: PLATFORM_CONFIG.legalName,
      tradeName: PLATFORM_CONFIG.tradeName,
      constitution: PLATFORM_CONFIG.constitution,
      address: PLATFORM_CONFIG.address,
      addressLine1: PLATFORM_CONFIG.addressLine1,
      addressLine2: PLATFORM_CONFIG.addressLine2,
      city: PLATFORM_CONFIG.city,
      district: PLATFORM_CONFIG.district,
      state: PLATFORM_CONFIG.state,
      stateCode: PLATFORM_CONFIG.stateCode,
      pincode: PLATFORM_CONFIG.pincode,
      gstin: PLATFORM_CONFIG.gstin,
      pan: PLATFORM_CONFIG.pan,
      cin: PLATFORM_CONFIG.cin,
      udyam: PLATFORM_CONFIG.udyam,
      email: PLATFORM_CONFIG.email,
      officialEmail: PLATFORM_CONFIG.officialEmail,
      billingEmail: PLATFORM_CONFIG.billingEmail,
      legalEmail: PLATFORM_CONFIG.legalEmail,
      privacyEmail: PLATFORM_CONFIG.privacyEmail,
      grievanceEmail: PLATFORM_CONFIG.grievanceEmail,
      grievanceOfficer: PLATFORM_CONFIG.grievanceOfficer,
      phone: PLATFORM_CONFIG.phone,
      website: PLATFORM_CONFIG.website,
      sacCode: PLATFORM_CONFIG.sacCode,
      domain: PLATFORM_CONFIG.domain,
    });
  },
  {
    requireAuth: true,
    rateLimit: { limit: 60, window: 60 },
  },
);
