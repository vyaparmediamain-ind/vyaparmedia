import { NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { ScoutService } from "@/services/scout.service";

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
      data: dashboardData,
    },
    { status: 200 }
  );
}, { requireAuth: true });
