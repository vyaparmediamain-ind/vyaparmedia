import React from "react";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import "vitest-axe/extend-expect";
import { renderWithProviders } from "../../utils/render";
import { Logo } from "@/components/Logo";

describe("Component Smoke: Logo", () => {
  it("renders brand name and tagline accurately", () => {
    const { getByText } = renderWithProviders(<Logo size="md" showTagline={true} />);

    expect(getByText("Vyapar")).toBeInTheDocument();
    expect(getByText("Media")).toBeInTheDocument();
    expect(getByText("Trusted Creator Commerce")).toBeInTheDocument();
  });

  it("renders as anchor link when asLink is true", () => {
    const { container } = renderWithProviders(<Logo href="/test-destination" asLink={true} />);
    const link = container.querySelector("a");

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/test-destination");
  });

  it("renders as div when asLink is false", () => {
    const { container } = renderWithProviders(<Logo asLink={false} />);
    const link = container.querySelector("a");

    expect(link).toBeNull();
  });

  it("passes axe accessibility checks without violations", async () => {
    const { container } = renderWithProviders(<Logo asLink={true} href="/" />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
