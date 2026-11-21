import { NextResponse } from "next/server";
import { z } from "zod";
import { apiWrapper } from "@/lib/api-wrapper";
import { ScoutService } from "@/services/scout.service";

const scoutKycSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
  city: z.string().trim().min(2, "City is required").max(50),
  state: z.string().trim().max(50).optional(),
  college: z.string().trim().max(100).optional(),
  panNumber: z.string().trim().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i, "Invalid PAN number format (e.g. ABCDE1234F)"),
  aadhaarNumber: z.string().trim().regex(/^\d{12}$/, "Aadhaar must be a 12-digit number"),
  panDocumentUrl: z.string().url().optional(),
  aadhaarDocumentUrl: z.string().url().optional(),
  selfieUrl: z.string().url().optional().or(z.literal("")),
});

export const POST = apiWrapper(async (req) => {
  const session = req.session;
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = scoutKycSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Validation error", errors: parsed.error.format() },
      { status: 400 }
    );
  }

  const scout = await ScoutService.submitKyc(userId, parsed.data);

  return NextResponse.json(
    {
      success: true,
      message: "Scout KYC submitted successfully for verification",
      scout,
    },
    { status: 200 }
  );
}, { requireAuth: true });

export const GET = apiWrapper(async (req) => {
  const session = req.session;
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const dashboardData = await ScoutService.getDashboard(userId);

  return NextResponse.json(
    {
      success: true,
      isRegistered: dashboardData.isRegistered,
      verificationStatus: dashboardData.verificationStatus,
      rejectionReason: dashboardData.rejectionReason,
      scoutCode: dashboardData.scoutCode,
      scoutProfile: dashboardData.scoutProfile,
    },
    { status: 200 }
  );
}, { requireAuth: true });
