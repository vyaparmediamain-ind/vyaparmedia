import { NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { ScoutService } from "@/services/scout.service";
import { z } from "zod";

const querySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "ALL"]).optional(),
  city: z.string().optional(),
  search: z.string().optional(),
  page: z.preprocess(Number, z.number().int().min(1).default(1)),
  limit: z.preprocess(Number, z.number().int().min(1).max(100).default(20)),
});

export const GET = apiWrapper(async (req) => {
  const session = req.session;
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const parsed = querySchema.safeParse({
    status: searchParams.get("status") || undefined,
    city: searchParams.get("city") || undefined,
    search: searchParams.get("search") || undefined,
    page: searchParams.get("page") || undefined,
    limit: searchParams.get("limit") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid parameters" }, { status: 400 });
  }

  const result = await ScoutService.adminListScouts(parsed.data);

  return NextResponse.json({
    success: true,
    data: result,
  });
}, { requireAuth: true, requireAdmin: true });
