import { headers } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/errors";

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

  // 3. Verify URL query parameter ?key=<secret> or ?secret=<secret> (convenient for cron-job.org)
  let isQueryValid = false;
  if (req?.url) {
    try {
      const url = new URL(req.url);
      const queryKey = url.searchParams.get("key") || url.searchParams.get("secret");
      if (queryKey) {
        const actualQueryHash = createHash("sha256").update(queryKey).digest();
        isQueryValid = timingSafeEqual(actualQueryHash, expectedSecretHash);
      }
    } catch {}
  }

  if (!isAuthValid && !isXCronValid && !isQueryValid) {
    throw AppError.unauthorized("Invalid Cron Secret");
  }
}
