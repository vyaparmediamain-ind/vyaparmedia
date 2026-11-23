import { describe, it, expect } from "vitest";
import path from "node:path";
import { generateRouteManifest } from "../../scripts/audit/route-manifest";
import { analyzeConnections } from "../../scripts/audit/connections";
import { generateTestMatrix } from "../../scripts/audit/test-matrix";
import { analyzeFallbacks } from "../../scripts/audit/fallbacks";

describe("AST Audit Tooling Test Suite", () => {
  const fixtureRoot = path.resolve(process.cwd(), "tests/audit-fixtures");

  describe("scripts/audit/route-manifest.ts", () => {
    it("extracts API route paths, methods, and apiWrapper auth options", () => {
      const manifest = generateRouteManifest(fixtureRoot);

      expect(manifest.totalApiRoutes).toBeGreaterThanOrEqual(1);
      const fixtureApi = manifest.apiRoutes.find((r) => r.path === "/api/fixture-route");
      expect(fixtureApi).toBeDefined();
      expect(fixtureApi?.methods).toEqual(["GET", "POST"]);

      const getAuth = fixtureApi?.authOptions.GET;
      expect(getAuth?.requireAuth).toBe(true);
      expect(getAuth?.requireAdmin).toBe(true);
      expect(getAuth?.rateBucket).toBe("API_DEFAULT");

      const postAuth = fixtureApi?.authOptions.POST;
      expect(postAuth?.requireAuth).toBe(true);
      expect(postAuth?.validateSchemas.body).toBe("testSchema");
    });

    it("extracts page route paths and server-side auth guards", () => {
      const manifest = generateRouteManifest(fixtureRoot);

      expect(manifest.totalPageRoutes).toBeGreaterThanOrEqual(1);
      const fixturePage = manifest.pageRoutes.find((p) => p.path === "/fixture-page");
      expect(fixturePage).toBeDefined();
      expect(fixturePage?.authGuard).toBe("requireActiveAdmin");
    });
  });

  describe("scripts/audit/connections.ts", () => {
    it("resolves client calls to routes and detects broken endpoints", () => {
      const result = analyzeConnections(fixtureRoot);

      expect(result.totalCallSites).toBeGreaterThanOrEqual(1);

      // Should identify broken call to /api/non-existent-route
      const broken = result.brokenCallSites.find(
        (b) => b.normalizedRoute === "/api/non-existent-route"
      );
      expect(broken).toBeDefined();
      expect(broken?.file).toContain("FixtureComponent.tsx");

      // Should detect matching call to /api/fixture-route
      const matched = result.callSites.find(
        (c) => c.normalizedRoute === "/api/fixture-route" && c.matchedRoute
      );
      expect(matched).toBeDefined();
      expect(matched?.method).toBe("POST");

      // Built-in investigations
      expect(result.investigations["/api/discovery-feed"]).toBeDefined();
      expect(result.investigations["/api/telemetry/event"]).toBeDefined();
      expect(result.investigations["/api/upload/confirm"]).toBeDefined();
    });
  });

  describe("scripts/audit/test-matrix.ts", () => {
    it("maps components and routes to test files by layer", () => {
      const matrix = generateTestMatrix(fixtureRoot);

      expect(matrix.totalModules).toBeGreaterThanOrEqual(1);

      // FixtureComponent should be marked covered by unit test
      const componentCoverage = matrix.modules.find(
        (m) => m.modulePath.includes("FixtureComponent")
      );
      expect(componentCoverage).toBeDefined();
      expect(componentCoverage?.covered).toBe(true);
      expect(componentCoverage?.tests[0]?.layer).toBe("unit");

      // Route /api/fixture-route should be marked covered by route-string reference
      const routeCoverage = matrix.modules.find(
        (m) => m.modulePath === "/api/fixture-route"
      );
      expect(routeCoverage).toBeDefined();
      expect(routeCoverage?.covered).toBe(true);
      expect(routeCoverage?.tests[0]?.referenceType).toBe("route-string");
    });
  });

  describe("scripts/audit/fallbacks.ts", () => {
    it("detects and classifies catch blocks, metric defaults, and code smells", () => {
      const result = analyzeFallbacks(fixtureRoot);

      // Catch blocks
      expect(result.summary.totalCatchBlocks).toBeGreaterThanOrEqual(1);
      const logCatch = result.catchBlocks.find(
        (cb) => cb.file.includes("FixtureComponent")
      );
      expect(logCatch).toBeDefined();
      expect(logCatch?.classification).toBe("log_only");

      // Metric default (views || 0)
      const metricDef = result.metricDefaults.find(
        (md) => md.identifier === "views" && md.defaultValue === 0
      );
      expect(metricDef).toBeDefined();
      expect(metricDef?.operator).toBe("||");

      // Math.random
      const mathRand = result.smells.find((s) => s.type === "math_random");
      expect(mathRand).toBeDefined();

      // Non-null assertion (name!)
      const nonNull = result.smells.find((s) => s.type === "non_null_assertion");
      expect(nonNull).toBeDefined();

      // Any keyword (looseData: any)
      const anyKw = result.smells.find((s) => s.type === "any_keyword");
      expect(anyKw).toBeDefined();
    });
  });
});
