import { NextRequest, NextResponse } from "next/server";
import { apiWrapper, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { requireActiveAdmin } from "@/lib/admin-auth";
import {
  banIp,
  unbanIp,
  getBanDetails,
  listBannedIps,
} from "@/lib/blacklist";
import { isIP } from "node:net";
import { z } from "zod";

const banIpSchema = z.object({
  ip: z.string().refine((val) => isIP(val) !== 0, { message: "Invalid IP address" }),
  reason: z.string().min(3, "Reason must be at least 3 characters").max(255),
  durationSeconds: z.number().int().positive().max(31536000).default(86400), // Max 1 year, default 24h
});

const unbanIpSchema = z.object({
  ip: z.string().refine((val) => isIP(val) !== 0, { message: "Invalid IP address" }),
});

/**
 * GET /api/admin/ip-blacklist
 * List all active Redis IP bans or look up details for a specific IP.
 */
async function _handler_GET(req: NextRequest) {
  const session = (req as AuthenticatedRequest).session;
  await requireActiveAdmin(session.user);

  const { searchParams } = new URL(req.url);
  const checkIp = searchParams.get("ip")?.trim();

  if (checkIp) {
    const details = await getBanDetails(checkIp);
    return NextResponse.json({
      success: true,
      ip: checkIp,
      ...details,
    });
  }

  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || 50)));
  const bannedIps = await listBannedIps(limit);

  return NextResponse.json({
    success: true,
    total: bannedIps.length,
    bannedIps,
  });
}

/**
 * POST /api/admin/ip-blacklist
 * Instantly bans an IP address in Redis (zero cache invalidation lag).
 */
async function _handler_POST(req: NextRequest) {
  const session = (req as AuthenticatedRequest).session;
  await requireActiveAdmin(session.user);

  const body = await req.json();
  const parsed = banIpSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation Error", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { ip, reason, durationSeconds } = parsed.data;
  await banIp(ip, `[Admin ${session.user.id}] ${reason}`, durationSeconds);

  return NextResponse.json({
    success: true,
    message: `IP ${ip} has been banned immediately.`,
    ip,
    durationSeconds,
  });
}

/**
 * DELETE /api/admin/ip-blacklist
 * Instantly removes an IP ban from Redis.
 */
async function _handler_DELETE(req: NextRequest) {
  const session = (req as AuthenticatedRequest).session;
  await requireActiveAdmin(session.user);

  const body = await req.json();
  const parsed = unbanIpSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation Error", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { ip } = parsed.data;
  const unbanned = await unbanIp(ip);

  return NextResponse.json({
    success: true,
    message: unbanned
      ? `IP ${ip} has been unbanned.`
      : `IP ${ip} was not found in active banlist.`,
    ip,
    unbanned,
  });
}

export const GET = apiWrapper(_handler_GET, { requirePermission: "MANAGE_USERS" });
export const POST = apiWrapper(_handler_POST, { requirePermission: "MANAGE_USERS" });
export const DELETE = apiWrapper(_handler_DELETE, { requirePermission: "MANAGE_USERS" });
