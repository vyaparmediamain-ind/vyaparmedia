import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { auth } from "@/lib/auth";
import { requireActiveAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendBlogNewsletterEmail } from "@/lib/email";

// H10 FIX: maxDuration reduced - actual bulk sending must be batched across
// multiple calls or moved to a background job queue (BullMQ / Redis).
export const maxDuration = 60;

// Maximum subscribers to email in a single HTTP request.
// Prevents timeout and memory exhaustion on large subscriber lists.
const BATCH_SIZE = 50;

async function _handler_POST(request: NextRequest) {
  const session = await auth();
  await requireActiveAdmin(session?.user);

  const body = await request.json();
  const { subject, content, offset = 0 } = body;

  // Validate inputs with length bounds to prevent DoS via oversized payloads
  if (!subject || typeof subject !== "string" || subject.trim().length < 3 || subject.length > 200) {
    return NextResponse.json({ success: false, message: "Subject must be 3-200 characters" }, { status: 400 });
  }
  if (!content || typeof content !== "string" || content.trim().length < 10 || content.length > 50000) {
    return NextResponse.json({ success: false, message: "Content must be 10-50000 characters" }, { status: 400 });
  }

  // Paginated batch: take only BATCH_SIZE subscribers at a time
  const subscribers = await prisma.blogSubscriber.findMany({
    where: { verified: true },
    select: { email: true, unsubscribeToken: true },
    skip: Math.max(0, Number(offset) || 0),
    take: BATCH_SIZE,
    orderBy: { id: "asc" },
  });

  if (subscribers.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No more verified subscribers to send to",
      sentCount: 0,
      hasMore: false,
    });
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const subscriber of subscribers) {
    try {
      await sendBlogNewsletterEmail(subscriber.email, subject, content, subscriber.unsubscribeToken);
      sentCount++;
    } catch (error) {
      failedCount++;
      logger.error("Failed to send newsletter email", {
        email: subscriber.email,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("Newsletter batch sent", { subject, sentCount, failedCount, offset, batchSize: BATCH_SIZE });

  return NextResponse.json({
    success: true,
    message: `Newsletter batch sent to ${sentCount} subscribers`,
    sentCount,
    failedCount,
    nextOffset: Number(offset) + BATCH_SIZE,
    hasMore: subscribers.length === BATCH_SIZE,
  });
}

export const POST = apiWrapper(_handler_POST, { requireAuth: true, requireAdmin: true });
