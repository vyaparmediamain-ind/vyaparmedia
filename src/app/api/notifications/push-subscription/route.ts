import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiWrapper } from "@/lib/api-wrapper";
import { z } from "zod";
import {
  savePushSubscription,
  removePushSubscription,
} from "@/lib/push-notifications";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export const POST = apiWrapper(async (req) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = subscribeSchema.parse(body);

  const success = await savePushSubscription(session.user.id, parsed);

  return NextResponse.json({
    success,
    message: success ? "Push subscription saved successfully" : "Failed to save push subscription",
  });
});

export const DELETE = apiWrapper(async (req) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = unsubscribeSchema.parse(body);

  const success = await removePushSubscription(session.user.id, parsed.endpoint);

  return NextResponse.json({
    success,
    message: success ? "Push subscription removed" : "Failed to remove subscription",
  });
});

export const GET = apiWrapper(async () => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSPOsnf3Tap2jVOUMYDqq50F_ckqWAATLu48";

  return NextResponse.json({
    vapidPublicKey,
    supported: true,
  });
});
