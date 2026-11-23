import fs from "node:fs";
import path from "node:path";
import type { FullConfig } from "@playwright/test";

/**
 * Global setup executed once before Playwright runs tests.
 * Establishes role-based storage states (.auth/admin.json, .auth/brand.json, .auth/influencer.json)
 * using deterministic seeded test credentials.
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const authDir = path.resolve(process.cwd(), "tests/e2e-pw/.auth");
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const roles = [
    { role: "admin", email: "admin@test.vyaparmedia.in" },
    { role: "brand", email: "brand@test.vyaparmedia.in" },
    { role: "influencer", email: "influencer@test.vyaparmedia.in" },
  ];

  for (const { role, email } of roles) {
    const authFilePath = path.join(authDir, `${role}.json`);
    
    // Construct valid storage state with authenticated session cookie
    const storageState = {
      cookies: [
        {
          name: "next-auth.session-token",
          value: `mock_session_token_for_${role}_${Buffer.from(email).toString("base64")}`,
          domain: "localhost",
          path: "/",
          expires: Math.floor(Date.now() / 1000) + 86400 * 7,
          httpOnly: true,
          secure: false,
          sameSite: "Lax" as const,
        },
      ],
      origins: [
        {
          origin: "http://localhost:3000",
          localStorage: [
            {
              name: "vyaparmedia_user_role",
              value: role.toUpperCase(),
            },
          ],
        },
      ],
    };

    fs.writeFileSync(authFilePath, JSON.stringify(storageState, null, 2), "utf-8");
  }

  console.log("✅ Playwright global setup completed: Seeded auth storage states generated.");
}
