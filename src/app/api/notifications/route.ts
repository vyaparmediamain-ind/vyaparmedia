import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiWrapper } from "@/lib/api-wrapper";
import { NotificationService } from "@/services/notification.service";
import { z } from "zod";
import { parsePagination } from "@/lib/utils";

export const GET = apiWrapper(async (req) => {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const { searchParams } = new URL(req.url);
const { page, limit } = parsePagination(searchParams);

const result = await NotificationService.listNotifications(
session.user.id,
page,
limit,
);

return NextResponse.json({
notifications: result.notifications,
unreadCount: result.unreadCount,
pagination: {
page,
limit,
total: result.total,
totalPages: Math.ceil(result.total / (limit || 1)),
},
});
});

export const POST = apiWrapper(async (req) => {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const body = await req.json();
const schema = z.object({
notificationIds: z.array(z.string()).max(100).optional(),
markAll: z.boolean().optional(),
});

const parsed = schema.parse(body);

if (parsed.markAll) {
await NotificationService.markAsRead(session.user.id);
} else {
await NotificationService.markAsRead(
session.user.id,
parsed.notificationIds,
);
}

return NextResponse.json({
success: true,
message: "Notifications marked as read",
});
});
