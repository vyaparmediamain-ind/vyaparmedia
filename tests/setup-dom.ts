import "@testing-library/jest-dom/vitest";
import "vitest-axe/extend-expect";
import * as matchers from "vitest-axe/matchers";
import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import React from "react";

// Augment Vitest Assertion interface for vitest-axe matchers
declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Assertion<R, T> {
    toHaveNoViolations(): R;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}

// Extend expect with vitest-axe matchers
expect.extend(matchers);

// Automatically unmount React trees after each test to prevent memory leaks and cross-test contamination
afterEach(() => {
  cleanup();
});

// Next.js App Router navigation mocks
vi.mock("next/navigation", () => {
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  };

  return {
    useRouter: () => router,
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
  };
});

// Next.js next/image mock rendering standard HTML img
vi.mock("next/image", () => ({
  default: function MockImage({
    src,
    alt,
    fill: _fill,
    priority: _priority,
    ...props
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    priority?: boolean;
    [key: string]: unknown;
  }) {
    return React.createElement("img", { src, alt, ...props });
  },
}));

// Next.js next/link mock rendering standard HTML anchor
vi.mock("next/link", () => ({
  default: function MockLink({
    href,
    children,
    ...props
  }: {
    href: string | { pathname?: string };
    children?: React.ReactNode;
    [key: string]: unknown;
  }) {
    const url = typeof href === "object" ? href.pathname ?? "" : href;
    return React.createElement("a", { href: url, ...props }, children);
  },
}));

// Next.js next/headers mock
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    getAll: vi.fn(() => []),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(() => false),
  })),
  headers: vi.fn(() => new Headers()),
}));

// Browser API stubs for JSDOM environment
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

class MockResizeObserver implements ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: MockResizeObserver,
});

if (typeof navigator !== "undefined") {
  Object.defineProperty(navigator, "clipboard", {
    writable: true,
    configurable: true,
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(""),
    },
  });
}
