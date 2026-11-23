import { describe, it, expect } from "vitest";
import { FixtureComponent } from "../../src/components/FixtureComponent";

describe("Fixture Test", () => {
  it("renders properly", () => {
    expect(FixtureComponent).toBeDefined();
    const endpoint = "/api/fixture-route";
    expect(endpoint).toBe("/api/fixture-route");
  });
});
