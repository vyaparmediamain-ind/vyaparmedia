import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";

async function _handler_POST(_req: NextRequest) {
try {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Delete the Instagram OAuth account and clear cached stats in transaction
await prisma.$transaction([
prisma.oAuthAccount.deleteMany({
where: {
userId: session.user.id,
provider: "instagram",
},
}),
prisma.influencerProfile.updateMany({
where: { userId: session.user.id },
data: {
instagramHandle: null,
instagramFollowers: 0,
instagramEngagementRate: 0,
},
}),
]);

return NextResponse.json({ success: true });
} catch (error: unknown) {
logger.error("Instagram disconnect error", error);
return NextResponse.json({ error: "Failed to disconnect Instagram" }, { status: 500 });
}
}


// Wrapped handlers via apiWrapper
export const POST = apiWrapper(_handler_POST);
