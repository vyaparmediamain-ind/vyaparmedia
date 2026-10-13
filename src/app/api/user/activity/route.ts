import { apiWrapper } from "@/lib/api-wrapper";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { hasAllPermissions } from "@/lib/rbac";

async function _handler_GET() {
try {
const session = await auth();
if (!session?.user?.id || !hasAllPermissions(session.user.userType, ["VIEW_DASHBOARD", "VIEW_SETTINGS"])) {
return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
}

const activity = await prisma.loginAttempt.findMany({
where: { userId: session.user.id },
orderBy: { createdAt: "desc" },
take: 10,
select: {
id: true,
ipAddress: true,
userAgent: true,
success: true,
createdAt: true,
},
});

// Map basic userAgents into human readable device strings like "Windows - Chrome" (simple heuristic)
const parsedActivity = activity.map((act) => {
let device = "Unknown Device";
const ua = act.userAgent || "";
if (ua.includes("Windows")) device = "Windows PC";
if (ua.includes("Mac OS")) device = "Mac";
if (ua.includes("iPhone")) device = "iPhone";
if (ua.includes("Android")) device = "Android Device";

if (ua.includes("Chrome")) device += " (Chrome)";
else if (ua.includes("Safari") && !ua.includes("Chrome"))
device += " (Safari)";
else if (ua.includes("Firefox")) device += " (Firefox)";
else if (ua.includes("Edge")) device += " (Edge)";

return {
id: act.id,
device: device,
location: act.ipAddress || "Unknown",
time: act.createdAt.toISOString(),
active:
act.success &&
Date.now() - act.createdAt.getTime() < 3600000 * 24, // Rough heuristic for active vs old session
success: act.success,
};
});

return NextResponse.json({ activity: parsedActivity });
} catch (error) {
logger.error("Activity fetch error", error);
return NextResponse.json(
{ error: "Failed to fetch activity" },
{ status: 500 },
);
}
}


// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
