import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

interface RouteManifestEntry {
  path: string;
  file: string;
  type: string;
  methods: string[];
  authOptions: Record<
    string,
    {
      requireAuth?: boolean;
      requireAdmin?: boolean;
      requireBrand?: boolean;
      requireInfluencer?: boolean;
      requirePermission?: string | null;
      rateBucket?: string | null;
      validateSchemas?: Record<string, unknown>;
      skipCsrf?: boolean;
    }
  >;
  serverActions: unknown[];
}

interface RoutesManifest {
  generatedAt: string;
  totalApiRoutes: number;
  totalPageRoutes: number;
  apiRoutes: RouteManifestEntry[];
}

describe("Manifest Guard Contract Tests (Requirement 4)", () => {
  const rootDir = process.cwd();
  const manifestPath = path.join(rootDir, "docs/audit/routes.json");
  const apiDir = path.join(rootDir, "src/app/api");

  // Read manifest
  const manifestRaw = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw) as RoutesManifest;

  it("manifest exists and contains valid apiRoutes", () => {
    expect(manifest).toBeDefined();
    expect(manifest.apiRoutes).toBeInstanceOf(Array);
    expect(manifest.apiRoutes.length).toBeGreaterThan(0);
    expect(manifest.totalApiRoutes).toBe(manifest.apiRoutes.length);
  });

  it("every route declared in manifest exists on disk", () => {
    for (const route of manifest.apiRoutes) {
      const normalizedPath = route.file.split("/").join(path.sep);
      const fullPath = path.join(rootDir, normalizedPath);
      expect(
        fs.existsSync(fullPath),
        `Route ${route.path} declares file ${route.file} which does not exist on disk`
      ).toBe(true);
    }
  });

  it("every route.ts file on disk exists in routes.json manifest (no uncataloged routes)", () => {
    const diskFiles = fs
      .readdirSync(apiDir, { recursive: true })
      .filter((f): f is string => typeof f === "string" && f.endsWith("route.ts"))
      .map((f) => path.posix.join("src/app/api", f.split(path.sep).join("/")));

    const manifestFiles = new Set(
      manifest.apiRoutes.map((r) => r.file.split(path.sep).join("/"))
    );

    const unmapped = diskFiles.filter((f) => !manifestFiles.has(f));
    expect(
      unmapped,
      `Found ${unmapped.length} uncataloged route files on disk: ${unmapped.join(", ")}`
    ).toEqual([]);
  });

  it("every route on disk exports only methods declared in the manifest", () => {
    const validHttpMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];

    for (const route of manifest.apiRoutes) {
      const fullPath = path.join(rootDir, route.file.split("/").join(path.sep));
      const content = fs.readFileSync(fullPath, "utf8");

      for (const method of validHttpMethods) {
        // Match `export const GET` or `export async function GET`
        const methodRegex = new RegExp(`export\\s+(?:const|(?:async\\s+)?function)\\s+${method}\\b`);
        const exportsMethod = methodRegex.test(content);

        if (exportsMethod) {
          expect(
            route.methods,
            `Route ${route.path} exports ${method} but manifest does not declare it`
          ).toContain(method);
        }
      }

      // Conversely, check declared methods are actually exported in source
      for (const method of route.methods) {
        const methodRegex = new RegExp(`export\\s+(?:const|(?:async\\s+)?function)\\s+${method}\\b`);
        expect(
          methodRegex.test(content),
          `Manifest declares ${method} for ${route.path} (${route.file}), but export was not found in source file`
        ).toBe(true);
      }
    }
  });

  it("enforces strict CSRF exemption list (only authorized webhook endpoints skip CSRF)", () => {
    // Approved webhook ingress routes that are legitimately exempt from browser CSRF Origin checks
    const approvedCsrfExemptPaths = new Set([
      "/api/payments/webhook",
      "/api/webhooks/razorpay",
      "/api/webhooks/resend",
      "/api/webhooks/shiprocket",
      "/api/webhooks/msg91",
    ]);

    const actualExemptions: { path: string; method: string }[] = [];

    for (const route of manifest.apiRoutes) {
      for (const [method, opt] of Object.entries(route.authOptions || {})) {
        if (opt.skipCsrf) {
          actualExemptions.push({ path: route.path, method });
          expect(
            approvedCsrfExemptPaths.has(route.path),
            `Security Violation: Unauthorized CSRF exemption on ${method} ${route.path}. Only external webhooks may skip CSRF.`
          ).toBe(true);
        }
      }
    }

    // Must have at least the primary payment webhook verified
    expect(actualExemptions.length).toBeGreaterThanOrEqual(1);
  });

  it("verifies admin routes enforce requireAdmin authorization", () => {
    const adminRoutes = manifest.apiRoutes.filter((r) => r.path.startsWith("/api/admin/"));
    expect(adminRoutes.length).toBeGreaterThan(0);

    for (const route of adminRoutes) {
      for (const [method, opt] of Object.entries(route.authOptions || {})) {
        // Admin routes must enforce admin access either via requireAdmin or requirePermission
        const enforcesAdmin = Boolean(opt.requireAdmin || opt.requirePermission);
        expect(
          enforcesAdmin,
          `Admin route ${method} ${route.path} must require admin authorization (requireAdmin or requirePermission)`
        ).toBe(true);
      }
    }
  });

  it("verifies authOptions integrity across all manifest routes", () => {
    for (const route of manifest.apiRoutes) {
      for (const [method, opt] of Object.entries(route.authOptions || {})) {
        // Cannot simultaneously require brand AND require influencer exclusively
        if (opt.requireBrand && opt.requireInfluencer) {
          throw new Error(
            `Contradictory authOptions on ${method} ${route.path}: cannot require both Brand and Influencer exclusively.`
          );
        }

        // If requireAdmin, requireAuth must be true
        if (opt.requireAdmin) {
          expect(
            opt.requireAuth,
            `Route ${method} ${route.path} requires admin but requireAuth is false`
          ).toBe(true);
        }

        // If requireBrand or requireInfluencer, requireAuth must be true
        if (opt.requireBrand || opt.requireInfluencer) {
          expect(
            opt.requireAuth,
            `Route ${method} ${route.path} requires role but requireAuth is false`
          ).toBe(true);
        }
      }
    }
  });
});
