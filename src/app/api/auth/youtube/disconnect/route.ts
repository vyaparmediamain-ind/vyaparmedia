import { apiWrapper } from "@/lib/api-wrapper";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";

async function _handler_POST() {
try {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

await prisma.$transaction([
prisma.oAuthAccount.deleteMany({
where: {
userId: session.user.id,
provider: "youtube",
},
}),
prisma.influencerProfile.updateMany({
where: { userId: session.user.id },
data: {
youtubeHandle: null,
youtubeSubscribers: 0,
youtubeEngagementRate: 0,
},
}),
]);

return NextResponse.json({ success: true });
} catch (error: unknown) {
logger.error("YouTube disconnect error", error);
return NextResponse.json(
{ error: "Failed to disconnect YouTube" },
{ status: 500 },
);
}
}


// Wrapped handlers via apiWrapper
export const POST = apiWrapper(_handler_POST);
