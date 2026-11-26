import { NextResponse } from "next/server";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      data: {
        name: PLATFORM_CONFIG.name,
        legalName: PLATFORM_CONFIG.legalName,
        tradeName: PLATFORM_CONFIG.tradeName,
        constitution: PLATFORM_CONFIG.constitution,
        address: PLATFORM_CONFIG.address,
        addressLine1: PLATFORM_CONFIG.addressLine1,
        addressLine2: PLATFORM_CONFIG.addressLine2,
        city: PLATFORM_CONFIG.city,
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
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
