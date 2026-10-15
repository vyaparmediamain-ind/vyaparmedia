import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiWrapper } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  normalizeNotificationPreferences,
  normalizeQuietHours,
} from "@/lib/push-notifications";

export const GET = apiWrapper(async () => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notificationPreferences: true },
  });

  const rawPrefs = (user?.notificationPreferences || {}) as Record<string, unknown>;
  const preferences = normalizeNotificationPreferences(rawPrefs);
  const quietHours = normalizeQuietHours(rawPrefs.quietHours);

  return NextResponse.json({ preferences, quietHours });
});

export const PATCH = apiWrapper(async (req) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const normalized = normalizeNotificationPreferences(body?.preferences || body);
  const quietHours = body?.quietHours !== undefined ? normalizeQuietHours(body.quietHours) : undefined;

  // Read existing to preserve non-preference keys like pushSubscriptions if any
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notificationPreferences: true },
  });

  const existing = (user?.notificationPreferences || {}) as Record<string, unknown>;

  const updatedPrefs: Record<string, unknown> = {
    ...existing,
    ...normalized,
  };

  if (quietHours) {
    updatedPrefs.quietHours = quietHours;
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      notificationPreferences: updatedPrefs as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    success: true,
    preferences: normalized,
    quietHours: quietHours || normalizeQuietHours(existing.quietHours),
    message: "Notification preferences updated successfully",
  });
});

export const POST = PATCH;
