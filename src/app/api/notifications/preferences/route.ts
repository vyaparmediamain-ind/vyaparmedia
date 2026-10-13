import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiWrapper } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  normalizeNotificationPreferences,
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

  const preferences = normalizeNotificationPreferences(
    user?.notificationPreferences
  );

  return NextResponse.json({ preferences });
});

export const PATCH = apiWrapper(async (req) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const normalized = normalizeNotificationPreferences(body?.preferences || body);

  // Read existing to preserve non-preference keys like pushSubscriptions if any
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notificationPreferences: true },
  });

  const existing = (user?.notificationPreferences || {}) as Record<string, unknown>;

  const updatedPrefs = {
    ...existing,
    ...normalized,
  };

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      notificationPreferences: updatedPrefs as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    success: true,
    preferences: normalized,
    message: "Notification preferences updated successfully",
  });
});

export const POST = PATCH;
