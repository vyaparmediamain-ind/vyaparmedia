import { apiWrapper } from "@/lib/api-wrapper";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getReferralStats } from "@/lib/referral-engine";
import { logger } from "@/lib/logger";

async function _handler_GET() {
try {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const stats = await getReferralStats(session.user.id);

if (!stats) {
return NextResponse.json({ error: "Stats not found" }, { status: 404 });
}

return NextResponse.json(stats);
} catch (error) {
logger.error("Gamification referrals error", error);
return NextResponse.json(
{ error: "Failed to fetch referral stats" },
{ status: 500 },
);
}
}


// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
