import { NextRequest } from "next/server";
import type { Session } from "next-auth";
import type { ValidatedNextRequest } from "@/lib/api-wrapper";

export type TestRole = "ADMIN" | "BRAND" | "INFLUENCER" | "SCOUT" | "AGENCY";

export interface MakeSessionOptions {
  id?: string | undefined;
  email?: string | undefined;
  name?: string | undefined;
  role?: TestRole | undefined;
  userType?: TestRole | undefined;
  status?: string | undefined;
}

/**
 * Creates a mock NextAuth session for tests with proper user role and types.
 */
export function makeSession(role: TestRole = "BRAND", overrides?: MakeSessionOptions): Session {
  const roleLower = role.toLowerCase();
  const id = overrides?.id ?? `usr_test_${roleLower}_${Date.now()}`;
  const email = overrides?.email ?? `${roleLower}@test.vyaparmedia.in`;
  const name = overrides?.name ?? `Test ${role}`;

  return {
    user: {
      id,
      email,
      name,
      role: overrides?.role ?? role,
      userType: overrides?.userType ?? role,
      status: overrides?.status ?? "ACTIVE",
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  } as unknown as Session;
}

export interface MakeAuthedRequestOptions<TBody = unknown, TQuery = unknown, TParams = unknown> {
  url?: string | undefined;
  method?: string | undefined;
  body?: TBody | undefined;
  query?: TQuery | undefined;
  params?: (TParams | Promise<TParams>) | undefined;
  headers?: Record<string, string> | undefined;
  clientIp?: string | undefined;
}

/**
 * Creates a validated NextRequest attached with session and parsed params/context
 * compatible with apiWrapper routes.
 */
export function makeAuthedRequest<TBody = unknown, TQuery = unknown, TParams = Record<string, string | string[]>>(
  role: TestRole | null = "BRAND",
  options: MakeAuthedRequestOptions<TBody, TQuery, TParams> = {},
): {
  req: ValidatedNextRequest<TBody, TQuery, TParams>;
  context: { params: Promise<Record<string, string | string[]>> };
} {
  const url = options.url ?? "http://localhost:3000/api/test";
  const method = options.method ?? (options.body ? "POST" : "GET");
  const headers = new Headers(options.headers ?? {});

  if (!headers.has("x-forwarded-for")) {
    headers.set("x-forwarded-for", options.clientIp ?? "127.0.0.1");
  }

  let requestBody: BodyInit | null = null;
  if (options.body !== undefined && method !== "GET" && method !== "HEAD") {
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    requestBody = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  const req = new NextRequest(url, {
    method,
    headers,
    body: requestBody,
  }) as ValidatedNextRequest<TBody, TQuery, TParams>;

  const session = role ? makeSession(role) : null;
  req.session = session;
  if (options.body !== undefined) {
    req.validBody = options.body;
  }
  if (options.query !== undefined) {
    req.validQuery = options.query;
  }

  const rawParams = options.params ?? ({} as TParams);
  const paramsPromise = rawParams instanceof Promise ? rawParams : Promise.resolve(rawParams as Record<string, string | string[]>);

  return {
    req,
    context: {
      params: paramsPromise as Promise<Record<string, string | string[]>>,
    },
  };
}
