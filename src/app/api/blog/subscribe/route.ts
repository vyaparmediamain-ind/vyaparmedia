import { NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { z } from "zod";
import { sendBlogVerificationEmail } from "@/lib/email";

const subscribeSchema = z.object({
email: z.string().email("Invalid email address"),
});

export const POST = apiWrapper(async (req) => {
  const { email } = req.validBody as z.infer<typeof subscribeSchema>;

  const existing = await prisma.blogSubscriber.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (existing) {
    if (existing.verified) {
      return NextResponse.json({
        success: true,
        message: "If this email can be subscribed, a verification email has been sent.",
      });
    }

    // Resend verification email for unverified subscribers
    await sendBlogVerificationEmail(existing.email, existing.unsubscribeToken);
    return NextResponse.json({
      success: true,
      message: "Please check your inbox to verify your subscription.",
      id: existing.id,
    });
  }

  const subscriber = await prisma.blogSubscriber.create({
    data: { email: email.toLowerCase().trim() },
  });

  await sendBlogVerificationEmail(subscriber.email, subscriber.unsubscribeToken);

  return NextResponse.json({
    success: true,
    message: "Thank you! Please check your inbox to verify your subscription.",
    id: subscriber.id,
  });
}, {
  validate: { body: subscribeSchema },
  rateLimit: { limit: 5, window: 60 },
});
