import { z } from "zod";
import { http } from "@/lib/api-client/http";

/**
 * Standard fetcher for SWR/React Query — powered by centralized http transport.
 * Benefits: retry logic, global 401 redirect, consistent error structure.
 */
export async function fetcher<T = unknown>(url: string): Promise<T> {
  return http<T>(url);
}

/**
 * Enterprise schema-validated fetcher.
 * Enforces runtime response validation via Zod's .parse() — failing fast
 * if the backend response structure drifts or mismatches expectations.
 */
export async function fetcherWithSchema<TSchema extends z.ZodTypeAny>(
  url: string,
  schema: TSchema,
  init?: RequestInit,
): Promise<z.infer<TSchema>> {
  return http<z.infer<TSchema>>(url, { ...init, schema });
}

/**
 * Helper to produce an SWR-compatible fetcher bound to a specific Zod schema.
 * Usage: useSWR("/api/path", createSchemaFetcher(mySchema))
 */
export function createSchemaFetcher<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  init?: RequestInit,
) {
  return (url: string) => fetcherWithSchema(url, schema, init);
}
