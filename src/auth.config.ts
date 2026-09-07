import type { NextAuthConfig } from "next-auth";

export const authConfig = {
basePath: "/api/auth",
trustHost: true,
pages: {
signIn: "/login",
error: "/login",
},
session: {
strategy: "jwt",
},
callbacks: {
async jwt({ token, user, trigger }) {
if (user) {
token.id = user.id;
token.userType = user.userType ?? "INFLUENCER";
token.status = user.status ?? "PENDING_VERIFICATION";
token.verificationLevel = user.verificationLevel ?? "NONE";
token.trustScore = user.trustScore ?? 600;
token.xp = user.xp ?? 0;
token.level = user.level ?? 1;
token.name = user.name ?? token.name ?? null;
token.lastRefreshed = Date.now();
}
if (!token.lastRefreshed) {
token.lastRefreshed = Date.now();
}
if (trigger === "update") {
token.lastRefreshed = Date.now();
}
return token;
},
async session({ session, token }) {
if (token) {
session.user.id = token.id as string;
session.user.name = (token.name as string | null | undefined) ?? null;
session.user.userType = (token.userType as string | undefined) ?? "INFLUENCER";
session.user.status = (token.status as string | undefined) ?? "PENDING_VERIFICATION";
session.user.verificationLevel = (token.verificationLevel as string | undefined) ?? "NONE";
session.user.trustScore = (token.trustScore as number | undefined) ?? 600;
session.user.xp = (token.xp as number | undefined) ?? 0;
session.user.level = (token.level as number | undefined) ?? 1;
session.user.ip = token.ip as string;
if (token.lastRefreshed !== undefined) {
session.lastRefreshed = token.lastRefreshed as number;
}
if (token.error !== undefined) {
session.error = token.error as string;
}
}
return session;
},
async authorized({ auth: _session }) {
return true;
},
},
providers: [],
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: (process.env.NODE_ENV === "production" ? "strict" : "lax") as "strict" | "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
} satisfies NextAuthConfig;
