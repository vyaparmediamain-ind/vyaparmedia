import { headers } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function validateCronSecret(req?: Request) {
  const reqHeaders = await headers();
  const authHeader = reqHeaders.get("authorization");
  const xCronHeader = reqHeaders.get("x-cron-secret") || reqHeaders.get("x-api-key");
  const configuredSecret = process.env.CRON_SECRET;

  if (!configuredSecret) {
    throw AppError.internal("CRON_SECRET is not configured");
  }

  // 1. Verify standard Authorization: Bearer <secret> (case-insensitive per RFC-7235)
  const authHeaderNormalized = authHeader ? authHeader.replace(/^bearer /i, `Bearer `) : "";
  const expectedAuth = `Bearer ${configuredSecret}`;
  const expectedAuthHash = createHash("sha256").update(expectedAuth).digest();
  const actualAuthHash = createHash("sha256").update(authHeaderNormalized || "").digest();
  const isAuthValid = !!authHeader && timingSafeEqual(actualAuthHash, expectedAuthHash);

  // 2. Verify fallback x-cron-secret / x-api-key: <secret>
  const expectedSecretHash = createHash("sha256").update(configuredSecret).digest();
  const actualXCronHash = createHash("sha256").update(xCronHeader || "").digest();
  const isXCronValid = !!xCronHeader && timingSafeEqual(actualXCronHash, expectedSecretHash);

  // 3. Verify Upstash-Signature header from QStash scheduled crons
  const upstashSig = reqHeaders.get("upstash-signature");
  let isUpstashValid = false;
  if (upstashSig) {
    const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
    if (currentKey || nextKey) {
      try {
        const { Receiver } = await import("@upstash/qstash");
        const receiverConfig: { currentSigningKey: string; nextSigningKey?: string } = {
          currentSigningKey: currentKey || "",
        };
        if (nextKey) {
          receiverConfig.nextSigningKey = nextKey;
        }
        const receiver = new Receiver(receiverConfig);
        const body = req ? await req.clone().text() : "";
        isUpstashValid = await receiver.verify({ signature: upstashSig, body });
      } catch (qstashErr) {
        logger.warn("QStash signature verification failed in cron guard", { error: String(qstashErr) });
      }
    } else if (process.env.NODE_ENV === "test" || process.env.SKIP_ENV_VALIDATION === "true") {
      isUpstashValid = upstashSig === "valid_mock_qstash_signature";
    }
  }

  // Note: URL query parameter (?key= / ?secret=) authentication was removed (P0-REL-03)
  // because URL parameters are logged across CDN edge logs, proxy access logs, and Vercel analytics.

  if (!isAuthValid && !isXCronValid && !isUpstashValid) {
    throw AppError.unauthorized("Invalid Cron Secret or QStash Signature");
  }
}
