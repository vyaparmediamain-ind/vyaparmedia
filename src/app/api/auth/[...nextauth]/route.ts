/**
* NextAuth.js v5 Route Handler
* Re-exports handlers from the centralized auth configuration.
*/
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
