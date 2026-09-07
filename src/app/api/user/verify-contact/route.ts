import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getSecureClientIp } from "@/lib/ip";
import { createActivityLog } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { createHash, timingSafeEqual } from "node:crypto";
import { apiWrapper } from "@/lib/api-wrapper";
import { redis } from "@/lib/redis";
import { checkRateLimit } from "@/lib/rate-limit";

const verifyContactSchema = z.object({
  type: z.enum(["email", "phone"]),
  code: z
    .string()
    .min(4, "Verification code is too short")
    .max(10, "Verification code is too long"),
});

async function verifyEmailCode(userId: string, code: string): Promise<boolean> {
  const submittedHash = createHash("sha256").update(code).digest("hex");
  const key = `email-contact-otp:${userId}`;
  const storedHash = (await redis.get(key)) || "";

  let isValidCode = false;
  if (storedHash.length > 0) {
    try {
      const storedBuffer = Buffer.from(storedHash, "utf8");
      const submittedBuffer = Buffer.from(submittedHash, "utf8");
      if (storedBuffer.length === submittedBuffer.length) {
        isValidCode = timingSafeEqual(storedBuffer, submittedBuffer);
      }
    } catch {
      isValidCode = false;
    }
  }

  if (isValidCode) {
    await redis.del(key);
  }
  return isValidCode;
}

async function verifyPhoneCode(phone: string, code: string, userId: string): Promise<boolean> {
  const { verifyOTP } = await import("@/lib/sms");
  const result = await verifyOTP(phone, code, {
    purpose: "phone_verification",
  });

  if (!result.success) {
    logger.warn("Invalid phone OTP verification attempt", {
      userId,
      error: result.error,
    });
  }
  return result.success;
}

async function verifyContactCode(type: "email" | "phone", code: string, userId: string, phone?: string | null): Promise<boolean> {
  if (type === "email") {
    const isEmailValid = await verifyEmailCode(userId, code);
    if (!isEmailValid) {
      logger.warn("Invalid or expired email OTP verification attempt", { userId });
    }
    return isEmailValid;
  }
  return verifyPhoneCode(phone || "", code, userId);
}

function buildUserUpdateData(
  user: { emailVerified: boolean; phoneVerified: boolean; verificationLevel: string; status: string },
  type: "email" | "phone",
): Prisma.UserUpdateInput {
  const isBothVerified =
    (type === "email" ? true : user.emailVerified) &&
    (type === "phone" ? true : user.phoneVerified);

  const updateData: Prisma.UserUpdateInput =
    type === "email" ? { emailVerified: true } : { phoneVerified: true };

  if (isBothVerified) {
    if (user.verificationLevel === "NONE") {
      updateData.verificationLevel = "BASIC";
    }
    if (user.status === "PENDING_VERIFICATION") {
      updateData.status = "ACTIVE";
    }
  }
  return updateData;
}

export const POST = apiWrapper(async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = await checkRateLimit(session.user.id, "AUTH");
    if (!limit.success) {
      return NextResponse.json({ error: "Too many verification attempts" }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = verifyContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { type, code } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isVerified = await verifyContactCode(type, code, session.user.id, user.phone);
    if (!isVerified) {
      return NextResponse.json(
        { error: "Invalid or expired verification code" },
        { status: 400 },
      );
    }

    const updateData = buildUserUpdateData(user, type);

    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    await createActivityLog({
      userId: session.user.id,
      action: "CONTACT_CHANGED",
      entityType: "User",
      entityId: session.user.id,
      metadata: {
        field: type,
        newValue: type === "email" ? user.email : user.phone,
        changedAt: new Date().toISOString(),
        ipAddress: getSecureClientIp(req),
      },
    });

    return NextResponse.json({
      success: true,
      message: `${type} verified successfully!`,
    });
  } catch (error: unknown) {
    logger.error("Verify contact error", error);
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 500 },
    );
  }
});
