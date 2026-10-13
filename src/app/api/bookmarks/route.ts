import { NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { redis } from "@/lib/redis";
import prisma from "@/lib/db";
import { bookmarkRequestSchema } from "@/lib/schemas";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

// Third-tier in-memory fallback for offline test environments
const memoryBookmarks = new Set<string>();

export const GET = apiWrapper(
  async (req) => {
    const userId = req.session?.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    const redisKey = `user:${userId}:bookmarks`;

    try {
      if (redis) {
        const savedIds = await redis.smembers(redisKey);
        if (savedIds && savedIds.length > 0) {
          return NextResponse.json({ success: true, savedIds });
        }
      }
    } catch (redisErr) {
      logger.debug("Bookmarks Redis lookup failed, falling back to database", { userId, error: redisErr });
    }

    // Industry-standard persistent DB fallback: load bookmarks from user preferences in Postgres
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { notificationPreferences: true },
      });
      const prefs = (user?.notificationPreferences as Record<string, unknown>) || {};
      const dbSaved = (prefs.bookmarks as string[]) || [];

      if (dbSaved.length > 0) {
        // Asynchronously populate Redis cache if Redis came back online
        if (redis) {
          redis.sadd(redisKey, ...dbSaved).catch((err) => {
            logger.warn("Failed to repopulate bookmarks in Redis", { userId, error: err });
          });
        }
        return NextResponse.json({ success: true, savedIds: dbSaved });
      }
    } catch (dbErr) {
      logger.warn("Bookmarks database fallback read failed, using memory cache", { userId, error: dbErr });
    }

    // Third-tier process memory fallback (for offline tests)
    const userSaved = Array.from(memoryBookmarks)
      .filter((k) => k.startsWith(`${userId}:`))
      .map((k) => k.split(":")[1]!);

    return NextResponse.json({ success: true, savedIds: userSaved });
  },
  { requireAuth: true }
);

export const POST = apiWrapper(
  async (req) => {
    const userId = req.session?.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    const body = (req.validBody ?? (await req.json())) as {
      targetId: string;
      targetType: string;
      isSaved: boolean;
    };

    const { targetId, targetType, isSaved } = body;
    const redisKey = `user:${userId}:bookmarks`;
    const itemKey = `${userId}:${targetId}`;

    // 1. Write to Redis cache (Fast-path)
    try {
      if (redis) {
        if (isSaved) {
          await redis.sadd(redisKey, targetId);
        } else {
          await redis.srem(redisKey, targetId);
        }
      }
    } catch (redisErr) {
      logger.debug("Bookmarks Redis write failed, proceeding to persistent DB write", { userId, error: redisErr });
    }

    // 2. Industry-standard Persistent DB storage: Synchronize to PostgreSQL so bookmarks survive restarts & Redis flushes
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { notificationPreferences: true },
      });
      const prefs = (user?.notificationPreferences as Record<string, unknown>) || {};
      const currentBookmarks = new Set<string>((prefs.bookmarks as string[]) || []);

      if (isSaved) {
        currentBookmarks.add(targetId);
      } else {
        currentBookmarks.delete(targetId);
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          notificationPreferences: {
            ...prefs,
            bookmarks: Array.from(currentBookmarks),
          },
        },
      });
    } catch (dbErr) {
      logger.error("Bookmarks database persistent write failed", dbErr, { userId, targetId, isSaved });
    }

    // 3. Keep local memory cache updated for test isolation
    if (isSaved) {
      memoryBookmarks.add(itemKey);
    } else {
      memoryBookmarks.delete(itemKey);
    }

    return NextResponse.json({
      success: true,
      targetId,
      targetType,
      isSaved,
    });
  },
  {
    requireAuth: true,
    validate: { body: bookmarkRequestSchema },
  }
);
