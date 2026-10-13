import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("DEAD-DEP-01: Remove @tanstack/react-query and QueryProvider", () => {
  const rootDir = process.cwd();

  it("does not include @tanstack/react-query in package.json dependencies", () => {
    const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
    expect(pkgJson.dependencies["@tanstack/react-query"]).toBeUndefined();
  });

  it("does not render or import QueryProvider in src/app/providers.tsx", () => {
    const providersContent = fs.readFileSync(path.join(rootDir, "src/app/providers.tsx"), "utf8");
    expect(providersContent).not.toContain("QueryProvider");
  });

  it("ensures QueryProvider.tsx has been deleted", () => {
    const queryProviderPath = path.join(rootDir, "src/components/providers/QueryProvider.tsx");
    expect(fs.existsSync(queryProviderPath)).toBe(false);
  });

  it("ensures DiscoveryFeed.tsx does not import @tanstack/react-query", () => {
    const discoveryFeedPath = path.join(rootDir, "src/components/discovery/DiscoveryFeed.tsx");
    if (fs.existsSync(discoveryFeedPath)) {
      const feedContent = fs.readFileSync(discoveryFeedPath, "utf8");
      expect(feedContent).not.toContain("@tanstack/react-query");
    }
  });
});
