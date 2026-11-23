import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  generateRouteManifest,
  type RouteManifestResult,
  type ApiRouteInfo,
} from "@/../scripts/audit/route-manifest";
import {
  analyzeConnections,
  type ConnectionsResult,
  isAllowListed,
  getAllowListReason,
} from "@/../scripts/audit/connections";

describe("Route Manifest & Connection Drift Tests", () => {
  const rootDir = process.cwd();
  const routesJsonPath = path.join(rootDir, "docs/audit/routes.json");
  const connectionsJsonPath = path.join(rootDir, "docs/audit/connections.json");

  it("regenerates the route manifest in-memory without drift from committed routes.json", () => {
    expect(fs.existsSync(routesJsonPath), "docs/audit/routes.json must exist").toBe(true);

    const committedManifest: RouteManifestResult = JSON.parse(
      fs.readFileSync(routesJsonPath, "utf-8")
    );
    const inMemoryManifest = generateRouteManifest(rootDir);

    expect(inMemoryManifest.totalApiRoutes).toBe(committedManifest.totalApiRoutes);
    expect(inMemoryManifest.totalPageRoutes).toBe(committedManifest.totalPageRoutes);

    const inMemoryApiPaths = inMemoryManifest.apiRoutes.map((r: ApiRouteInfo) => r.path).sort();
    const committedApiPaths = committedManifest.apiRoutes.map((r: ApiRouteInfo) => r.path).sort();

    expect(inMemoryApiPaths).toEqual(committedApiPaths);

    // Verify all methods match
    for (const committedRoute of committedManifest.apiRoutes) {
      const match = inMemoryManifest.apiRoutes.find((r: ApiRouteInfo) => r.path === committedRoute.path);
      expect(
        match,
        `Route ${committedRoute.path} found in committed routes.json but missing in memory`
      ).toBeDefined();
      expect(
        match?.methods.sort(),
        `Methods mismatch for route ${committedRoute.path}`
      ).toEqual(committedRoute.methods.sort());
    }
  });

  it("regenerates client connections in-memory with zero broken calls and zero method mismatches", () => {
    expect(fs.existsSync(connectionsJsonPath), "docs/audit/connections.json must exist").toBe(true);

    const committedConnections: ConnectionsResult = JSON.parse(
      fs.readFileSync(connectionsJsonPath, "utf-8")
    );
    const inMemoryConnections = analyzeConnections(rootDir);

    // Core Connection Invariants
    expect(
      inMemoryConnections.brokenCallSitesCount,
      `Detected ${inMemoryConnections.brokenCallSitesCount} broken client call sites: ${JSON.stringify(inMemoryConnections.brokenCallSites)}`
    ).toBe(0);

    expect(
      inMemoryConnections.methodMismatchesCount,
      `Detected ${inMemoryConnections.methodMismatchesCount} HTTP method mismatches: ${JSON.stringify(inMemoryConnections.methodMismatches)}`
    ).toBe(0);

    expect(
      inMemoryConnections.candidateDeadRoutesCount,
      `Detected ${inMemoryConnections.candidateDeadRoutesCount} candidate dead routes not on allow-list: ${JSON.stringify(inMemoryConnections.candidateDeadRoutes)}`
    ).toBe(0);

    expect(inMemoryConnections.totalCallSites).toBe(committedConnections.totalCallSites);
    expect(inMemoryConnections.brokenCallSitesCount).toBe(committedConnections.brokenCallSitesCount);
    expect(inMemoryConnections.candidateDeadRoutesCount).toBe(committedConnections.candidateDeadRoutesCount);
  });

  it("ensures every uncalled route is explicitly categorized on the allow-list with a documented reason", () => {
    const manifest = generateRouteManifest(rootDir);
    const connections = analyzeConnections(rootDir);

    const calledRoutes = new Set(
      connections.callSites.filter((c) => c.matchedRoute).map((c) => c.normalizedRoute)
    );

    for (const route of manifest.apiRoutes) {
      if (!calledRoutes.has(route.path)) {
        const allowed = isAllowListed(route.path);
        const reason = getAllowListReason(route.path);

        expect(
          allowed,
          `Route ${route.path} has zero client callers and is missing from explicit allow-list`
        ).toBe(true);

        expect(
          typeof reason === "string" && reason.trim().length > 10,
          `Route ${route.path} on allow-list has empty or insufficient justification reason`
        ).toBe(true);
      }
    }
  });
});
