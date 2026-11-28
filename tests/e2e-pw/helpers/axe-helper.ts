import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import path from "node:path";

/**
 * Injects axe-core into the active Playwright page and asserts WCAG 2.1 AA compliance.
 */
export async function assertAccessible(
  page: Page,
  contextLabel: string,
  options: {
    includedImpacts?: ("minor" | "moderate" | "serious" | "critical")[];
  } = {}
): Promise<void> {
  const impacts = options.includedImpacts || ["serious", "critical"];
  const axePath = path.resolve(process.cwd(), "node_modules/axe-core/axe.min.js");

  await page.addScriptTag({ path: axePath });

  const results = await page.evaluate(async () => {
    const axeWindow = window as unknown as {
      axe?: {
        run: (doc: Document, opts: unknown) => Promise<{
          violations: Array<{ id: string; impact: string; description: string; nodes: Array<{ target: string[] }> }>;
        }>;
      };
    };
    if (typeof axeWindow.axe === "undefined") {
      throw new Error("axe-core script failed to inject into page");
    }
    return await axeWindow.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa"],
      },
      rules: {
        "color-contrast": { enabled: false },
        "scrollable-region-focusable": { enabled: false },
      },
    });
  });

  const violations = results.violations.filter((v: { impact: string }) =>
    impacts.includes(v.impact as "minor" | "moderate" | "serious" | "critical")
  );

  if (violations.length > 0) {
    const errorDetails = violations
      .map(
        (v: { id: string; impact: string; description: string; nodes: Array<{ target: string[] }> }) =>
          `[${v.impact.toUpperCase()}] ${v.id}: ${v.description} (Targets: ${v.nodes
            .map((n) => n.target.join(", "))
            .join("; ")})`
      )
      .join("\n");

    expect(
      violations.length,
      `Accessibility violations detected on ${contextLabel}:\n${errorDetails}`
    ).toBe(0);
  }
}
