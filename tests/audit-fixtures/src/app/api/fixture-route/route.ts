import { apiWrapper } from "@/lib/api-wrapper";
import { z } from "zod";

const testSchema = z.object({ id: z.string() });

export const GET = apiWrapper(async () => {
  return new Response(JSON.stringify({ ok: true }));
}, {
  requireAuth: true,
  requireAdmin: true,
  userRateLimit: { bucket: "API_DEFAULT" },
});

export const POST = apiWrapper(async () => {
  return new Response(JSON.stringify({ created: true }));
}, {
  requireAuth: true,
  validate: {
    body: testSchema,
  },
});
