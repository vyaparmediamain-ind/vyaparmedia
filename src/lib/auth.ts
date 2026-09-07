import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "./db";
import { loginSchema } from "./validations";
import { logger } from "./logger";
import { redis } from "./redis";
import { revokeRefreshToken, generateRefreshToken } from "./tokens";
import GoogleProvider from "next-auth/providers/google";
import { env } from "@/env";
import { createActivityLog, ActivityAction } from "./audit";

import {
checkLoginLimitsAndBlacklist,
handleFailedLoginAttempt,
verifyImpossibleTravelAndVpn,
verifyTwoFactorCode,
handleGoogleOAuthSignIn,
resolveClientIpAndAgent,
trackUserDeviceFingerprint,
storeActiveSessionToken,
} from "./auth/helpers";

import {
handleExistingJwtSession,
handleInitialJwtSession,
trackActiveJtiInRedis,
} from "./auth/session";

const ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes
export { ACCESS_TOKEN_EXPIRY };

const googleClientId = env.GOOGLE_CLIENT_ID;
const googleClientSecret = env.GOOGLE_CLIENT_SECRET;

export const { handlers, signIn, signOut, auth } = NextAuth({
basePath: "/api/auth",
trustHost: true,
secret: env.NEXTAUTH_SECRET,
providers: [
...(googleClientId && googleClientSecret
? [
GoogleProvider({
clientId: googleClientId,
clientSecret: googleClientSecret,
allowDangerousEmailAccountLinking: false,
}),
]
: []),
Credentials({
name: "credentials",
credentials: {
email: { label: "Email", type: "email" },
password: { label: "Password", type: "password" },
twoFactorCode: { label: "2FA Code", type: "text" },
},
async authorize(credentials, request) {
try {
const { ip, userAgent } = resolveClientIpAndAgent(request);

const parsed = loginSchema.safeParse(credentials);
if (!parsed.success) {
logger.warn("Login attempt with invalid credentials schema", { ip });
return null;
}

const { email: rawEmail, password } = parsed.data;
const email = rawEmail.toLowerCase().trim();

const limitsPassed = await checkLoginLimitsAndBlacklist(ip, email);
if (!limitsPassed) return null;

const user = await prisma.user.findUnique({
where: { email },
select: {
id: true,
email: true,
passwordHash: true,
userType: true,
status: true,
verificationLevel: true,
trustScore: true,
xp: true,
level: true,
isTwoFactorEnabled: true,
twoFactorSecret: true,
twoFactorRecoveryCodes: true,
failedLoginAttempts: true,
lockedUntil: true,
influencerProfile: { select: { displayName: true, avatar: true } },
brandProfile: { select: { companyName: true, logo: true } },
},
});

if (!user) {
logger.warn("Failed login user not found", { email, ip });
return null;
}

if (user.lockedUntil && user.lockedUntil > new Date()) {
logger.warn("Login blocked account locked", {
email,
ip,
lockedUntil: user.lockedUntil,
});
return null;
}

if (user.status === "BANNED" || user.status === "SUSPENDED" || user.status === "DELETED") {
logger.warn(`Login blocked account ${user.status.toLowerCase()}`, { email, ip });
return null;
}

const isValidPassword = await compare(password, user.passwordHash);
if (!isValidPassword) {
await handleFailedLoginAttempt(user, email, ip, userAgent);
}

await verifyImpossibleTravelAndVpn(user, ip, email, credentials);

await verifyTwoFactorCode(user, credentials);

await prisma.user.update({
where: { id: user.id },
data: {
lastLoginAt: new Date(),
failedLoginAttempts: 0,
lockedUntil: null,
},
});

await prisma.loginAttempt.create({
data: {
userId: user.id,
email,
ipAddress: ip,
userAgent,
success: true,
},
});

const name =
user.influencerProfile?.displayName ||
user.brandProfile?.companyName ||
user.email.split("@")[0];

const image =
user.influencerProfile?.avatar ||
user.brandProfile?.logo ||
null;

trackUserDeviceFingerprint(user.id, ip, userAgent);

const refreshTokenNode = await generateRefreshToken(user.id);
await storeActiveSessionToken(user.id, refreshTokenNode.token);

return {
id: user.id,
name: name ?? null,
image: image ?? null,
email: user.email,
userType: user.userType,
status: user.status,
verificationLevel: user.verificationLevel,
trustScore: user.trustScore,
xp: user.xp,
level: user.level,
refreshToken: refreshTokenNode.token,
};
} catch (entireAuthorizeError: unknown) {
const msg = entireAuthorizeError instanceof Error ? entireAuthorizeError.message : String(entireAuthorizeError);
if (
msg === "2FA_REQUIRED" ||
msg === "INVALID_2FA" ||
msg?.includes("INVALID_PASSWORD") ||
msg?.includes("SUSPICIOUS_IP_BLOCK") ||
msg?.includes("SUSPICIOUS_LOGIN_BLOCK")
) {
throw entireAuthorizeError;
}
logger.error("CRITICAL: authorize crashed", entireAuthorizeError);
return null;
}
},
}),
],
callbacks: {
async signIn({ user, account }) {
if (account?.provider === "google") {
return handleGoogleOAuthSignIn(user, account);
}
return true;
},
async jwt({ token, user, account: _account, trigger: _trigger }): Promise<Record<string, unknown>> {
const t = (user || _trigger === "update")
? await handleInitialJwtSession(token, user, _trigger)
: await handleExistingJwtSession(token);

// Track active JTI for session invalidation on password change or admin action
if (t.id && t.jti && !t.error) {
await trackActiveJtiInRedis(t.id as string, t.jti as string);
}

return t;
},
async session({ session, token }) {
if (token) {
// Block banned/suspended/deleted users from getting valid sessions
if (
token.status === "BANNED" ||
token.status === "SUSPENDED" ||
token.status === "DELETED" ||
token.error === "AccountBlocked"
) {
session.error = "AccountBlocked";
}

// Check for rotation errors
if (token.error === "RefreshAccessTokenError") {
session.error = "RefreshAccessTokenError";
}

if (token.error === "SessionRevoked") {
session.error = "SessionRevoked";
}

session.user.id = token.id as string;
session.user.name = (token.name as string | null | undefined) ?? null;
session.user.image = (token.image as string | null | undefined) ?? null;
session.user.userType = (token.userType as string | undefined) ?? "INFLUENCER";
session.user.status = (token.status as string | undefined) ?? "PENDING_VERIFICATION";
session.user.verificationLevel = (token.verificationLevel as string | undefined) ?? "NONE";
session.user.trustScore = (token.trustScore as number | undefined) ?? 600;
session.user.xp = (token.xp as number | undefined) ?? 0;
session.user.level = (token.level as number | undefined) ?? 1;
if (token.lastRefreshed !== undefined) {
session.lastRefreshed = token.lastRefreshed as number;
}
if (token.error !== undefined) {
session.error = token.error;
}
}
return session;
},
},
pages: {
signIn: "/login",
error: "/login",
},
session: {
strategy: "jwt",
maxAge: 7 * 24 * 60 * 60, // 7 days (not 30 this is a financial platform)
},
events: {
async signIn({ user }) {
logger.info("User signed in", { userId: user.id, email: user.email });
await createActivityLog({
userId: user.id as string,
action: ActivityAction.LOGIN,
entityType: "USER",
entityId: user.id as string,
metadata: { email: user.email },
}).catch(() => {});
},
async signOut(
message:
| { token?: import("next-auth/jwt").JWT | null }
| { session?: void | import("@auth/core/adapters").AdapterSession | null },
): Promise<void> {
// Note: Token may be null on signOut depending on flow
if (message && "token" in message && message.token) {
const userId = message.token.id || message.token.sub;
logger.info("User signed out", { userId });
if (message.token.refreshToken) {
await revokeRefreshToken(message.token.refreshToken as string);
}
if (userId) {
try {
await redis.del(`active_session:${userId}`);
} catch {
// ignore
}
}
}
},
async session() {
// Intentionally empty auditing is handled per-action
},
},
cookies: {
sessionToken: {
name:
process.env.NODE_ENV === "production"
? "__Secure-authjs.session-token"
: "authjs.session-token",
options: {
httpOnly: true,
sameSite: "lax",
path: "/",
secure: process.env.NODE_ENV === "production",
},
},
},
});
