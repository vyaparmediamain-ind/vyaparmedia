import { NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { ScoutService } from "@/services/scout.service";

export const GET = apiWrapper(async (req) => {
  const session = req.session;
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const networkList = await ScoutService.getNetworkList(userId);

  return NextResponse.json(
    {
      success: true,
      network: networkList,
    },
    { status: 200 }
  );
}, { requireAuth: true });
