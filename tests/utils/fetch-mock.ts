import { vi } from "vitest";

export interface MockRouteHandler {
  matcher: string | RegExp | ((url: string, init?: RequestInit) => boolean);
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>;
}

export interface RecordedFetchCall {
  url: string;
  init?: RequestInit | undefined;
  timestamp: number;
}

export class UnexpectedFetchError extends Error {
  constructor(url: string, method: string, registeredMatchers: string[]) {
    super(
      `[StrictFetchMock] Unexpected fetch call: ${method} "${url}". ` +
      `No mock handler matched this URL. Registered matchers: [${registeredMatchers.join(", ")}]. ` +
      `Ensure all external network boundaries are explicitly stubbed before executing the test.`
    );
    this.name = "UnexpectedFetchError";
  }
}

/**
 * Strict fetch mocking utility.
 * Fails fast with a detailed error whenever an unmocked URL is requested.
 */
export class StrictFetchMock {
  private originalFetch: typeof globalThis.fetch;
  private routes: MockRouteHandler[] = [];
  private calls: RecordedFetchCall[] = [];

  constructor() {
    this.originalFetch = globalThis.fetch;
  }

  public install(): this {
    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";
      this.calls.push({ url, init, timestamp: Date.now() });

      for (const route of this.routes) {
        let isMatch = false;
        if (typeof route.matcher === "string") {
          isMatch = url.includes(route.matcher);
        } else if (route.matcher instanceof RegExp) {
          isMatch = route.matcher.test(url);
        } else if (typeof route.matcher === "function") {
          isMatch = route.matcher(url, init);
        }

        if (isMatch) {
          return route.handler(url, init);
        }
      }

      const matchersDescription = this.routes.map((r) =>
        typeof r.matcher === "string"
          ? `"${r.matcher}"`
          : r.matcher instanceof RegExp
          ? r.matcher.toString()
          : "[custom function]"
      );

      throw new UnexpectedFetchError(url, method, matchersDescription);
    }) as typeof globalThis.fetch;

    return this;
  }

  public mockJson(
    matcher: string | RegExp | ((url: string, init?: RequestInit) => boolean),
    data: unknown,
    status = 200,
    headers: Record<string, string> = { "content-type": "application/json" }
  ): this {
    this.routes.push({
      matcher,
      handler: () =>
        new Response(JSON.stringify(data), {
          status,
          headers,
        }),
    });
    return this;
  }

  public mockRoute(
    matcher: string | RegExp | ((url: string, init?: RequestInit) => boolean),
    handler: (url: string, init?: RequestInit) => Response | Promise<Response>
  ): this {
    this.routes.push({ matcher, handler });
    return this;
  }

  public getCalls(matcher?: string | RegExp): RecordedFetchCall[] {
    if (!matcher) return [...this.calls];
    return this.calls.filter((c) =>
      typeof matcher === "string" ? c.url.includes(matcher) : matcher.test(c.url)
    );
  }

  public clearCalls(): void {
    this.calls = [];
  }

  public reset(): void {
    this.routes = [];
    this.calls = [];
  }

  public restore(): void {
    this.reset();
    globalThis.fetch = this.originalFetch;
  }
}

export function createFetchMock(): StrictFetchMock {
  return new StrictFetchMock().install();
}
