import { NextResponse } from "next/server";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      data: {
        name: PLATFORM_CONFIG.name,
        tradeName: PLATFORM_CONFIG.tradeName,
        email: PLATFORM_CONFIG.email,
        website: PLATFORM_CONFIG.website,
        domain: PLATFORM_CONFIG.domain,
        city: PLATFORM_CONFIG.city,
        state: PLATFORM_CONFIG.state,
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
