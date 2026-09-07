import { AppError } from "@/lib/errors";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import {
UserType,
UserStatus,
VerificationLevel,
ViolationType,
ViolationSeverity,
ViolationAction,
Prisma
} from "@prisma/client";
import {
requireActiveAdmin,
invalidateAdminCache,
type AdminSessionUser,
} from "@/lib/admin-auth";
import { createActivityLog, createAuditLog, ActivityAction } from "@/lib/audit";
import { NotificationService } from "@/services/notification.service";

export class AdminService {
static async checkAdminAccess(input: AdminSessionUser | null | undefined) {
await requireActiveAdmin(input);
}

static async getVerificationQueue() {
return await prisma.user.findMany({
where: { status: "PENDING_VERIFICATION" },
select: {
id: true,
email: true,
userType: true,
createdAt: true,
influencerProfile: { select: { displayName: true } },
brandProfile: { select: { companyName: true } },
taxCompliance: {
select: {
status: true,
panLast4: true,
gstinLast4: true,
itrAcknowledgementLast4: true,
eInvoiceApplicable: true,
},
},
verificationDocs: { select: { id: true } },
_count: { select: { verificationDocs: true } },
},
orderBy: { createdAt: "desc" },
take: 200, // Safety limit to prevent unbounded queries
});
}

static async listUsers(params: {
search?: string;
userType?: string;
status?: string;
verificationLevel?: string;
page: number;
limit: number;
}) {
const where: Prisma.UserWhereInput = {
id: { not: "PLATFORM_TREASURY" },
};

if (params.search) {
where.OR = [
{ email: { contains: params.search, mode: "insensitive" } },
{ phone: { contains: params.search, mode: "insensitive" } },
{
influencerProfile: {
displayName: { contains: params.search, mode: "insensitive" },
},
},
{
brandProfile: {
companyName: { contains: params.search, mode: "insensitive" },
},
},
];
}

if (params.userType && params.userType !== "ALL") {
where.userType = params.userType as UserType;
} else {
where.userType = { not: "ADMIN" };
}
if (params.status) where.status = params.status as UserStatus;
if (params.verificationLevel)
where.verificationLevel = params.verificationLevel as VerificationLevel;

const [users, total] = await Promise.all([
prisma.user.findMany({
where,
select: {
id: true,
email: true,
userType: true,
status: true,
trustScore: true,
createdAt: true,
verificationLevel: true,
influencerProfile: { select: { displayName: true, avatar: true } },
brandProfile: { select: { companyName: true, logo: true } },
taxCompliance: {
select: {
status: true,
panLast4: true,
gstinLast4: true,
itrAcknowledgementLast4: true,
eInvoiceApplicable: true,
},
},
badges: {
select: {
badgeId: true,
},
},
},
orderBy: { createdAt: "desc" },
skip: (params.page - 1) * params.limit,
take: params.limit,
}),
prisma.user.count({ where }),
]);

return { users, total };
}

static async getUserDetails(userId: string) {
const user = await prisma.user.findUnique({
where: { id: userId },
select: {
id: true,
email: true,
phone: true,
userType: true,
status: true,
verificationLevel: true,
emailVerified: true,
phoneVerified: true,
trustScore: true,
xp: true,
level: true,
referralCode: true,
referredBy: true,
createdAt: true,
updatedAt: true,
lastLoginAt: true,
influencerProfile: true,
brandProfile: true,
taxCompliance: true,
wallet: {
include: {
transactions: { take: 10, orderBy: { createdAt: "desc" } },
},
},
verificationDocs: { take: 20 },
violations: { take: 10, orderBy: { createdAt: "desc" } },
activityLogs: { take: 20, orderBy: { createdAt: "desc" } },
badges: { include: { badge: true } },
disputes: { take: 10, orderBy: { createdAt: "desc" } },
},
});

if (!user) throw AppError.notFound("User not found");

// Get Deal Stats
const dealStats = await this.getDealStats(user.id, user.userType);

return { user, dealStats };
}

static async updateUserStatus(
adminUser: AdminSessionUser,
userId: string,
data: {
action:
| "ban"
| "suspend"
| "activate"
| "adjust_trust"
| "set_verification";
reason?: string;
trustScoreAdjustment?: number;
verificationLevel?: string;
suspensionDays?: number;
},
) {
const admin = await requireActiveAdmin(adminUser);
if (
admin.id === userId &&
["ban", "suspend", "adjust_trust", "set_verification"].includes(data.action)
) {
throw AppError.badRequest("Admins cannot ban, suspend, adjust trust, or set verification on their own account");
}

const user = await prisma.user.findUnique({
where: { id: userId },
select: { id: true, email: true, status: true, trustScore: true },
});
if (!user) throw AppError.notFound("User not found");

let updateData: Prisma.UserUpdateInput = {};
let message = "";
let devLogMessage = "";
let violationData: {
type: string;
severity: string;
description: string;
action: string;
} | null = null;
let notificationTitle = "Account Update";

switch (data.action) {
case "ban":
updateData = { status: "BANNED" };
message = `User ${user.email} has been banned.`;
devLogMessage = `User ${userId} BANNED by admin ${admin.email}`;
notificationTitle = "Account banned";
violationData = {
type: "TERMS_VIOLATION",
severity: "CRITICAL",
description: data.reason || "Admin banned via panel",
action: "PERMANENT_BAN",
};
break;
case "suspend":
updateData = { status: "SUSPENDED" };
message = `User ${user.email} has been suspended.`;
devLogMessage = `User ${userId} SUSPENDED by admin ${admin.email}`;
notificationTitle = "Account suspended";
violationData = {
type: "TERMS_VIOLATION",
severity: "HIGH",
description: data.reason || "Admin suspended via panel",
action: "TEMP_SUSPENSION",
};
break;
case "activate":
updateData = { status: "ACTIVE" };
message = `User ${user.email} has been activated.`;
devLogMessage = `User ${userId} ACTIVATED by admin ${admin.email}`;
notificationTitle = "Account activated";
break;
case "adjust_trust": {
if (data.trustScoreAdjustment === undefined)
throw AppError.badRequest("Adjustment required");
const newScore = Math.max(
300,
Math.min(900, user.trustScore + data.trustScoreAdjustment),
);
updateData = { trustScore: newScore };
message = `Trust score adjusted by ${data.trustScoreAdjustment}`;
devLogMessage = `User ${userId} trust score adjusted by ${data.trustScoreAdjustment} to ${newScore} by admin ${admin.email}`;
notificationTitle = "Trust score updated";
break;
}
case "set_verification":
if (!data.verificationLevel)
throw AppError.badRequest("Verification level required");
updateData = { verificationLevel: data.verificationLevel as VerificationLevel };
message = `Verification level set to ${data.verificationLevel}`;
devLogMessage = `User ${userId} verification level set to ${data.verificationLevel} by admin ${admin.email}`;
notificationTitle = "Verification level updated";
break;
}

logger.info(devLogMessage || message, {
adminEmail: admin.email,
adminId: admin.id,
userId,
action: data.action,
});

const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
const updatedUser = await tx.user.update({
where: { id: userId },
data: updateData,
});

if (violationData) {
await tx.userViolation.create({
data: {
userId,
type: violationData.type as ViolationType,
severity: violationData.severity as ViolationSeverity,
description: violationData.description,
action: violationData.action as ViolationAction,
expiresAt: data.suspensionDays
? new Date(Date.now() + data.suspensionDays * 24 * 60 * 60 * 1000)
: null,
metadata: {
adminEmail: admin.email,
adminId: admin.id,
reason: data.reason,
suspensionDays: data.suspensionDays,
},
},
});
}

// Notification
await NotificationService.createNotification({
userId,
type: "system",
title: notificationTitle,
message: data.reason || message,
data: { adminAction: data.action },
}, tx);

return { success: true, message, user: updatedUser };
});

// Immediately invalidate the user's active Redis session so they are
// kicked out within seconds rather than waiting for the 60-second JWT poll.
if (data.action === "ban" || data.action === "suspend") {
try {
const { revokeAllUserSessions } = await import("@/lib/blacklist");
await revokeAllUserSessions(userId);
logger.info("[Security] Active sessions fully revoked on ban/suspend", { userId, action: data.action });
} catch (redisErr) {
// Non-fatal: JWT will pick up the DB status change within 60 seconds
logger.warn("[Security] Failed to invalidate session on ban/suspend", { userId, error: String(redisErr) });
}
}

// Purge admin-verification cache so demotion / ban takes effect immediately
// (avoids the 60-second Redis TTL window from admin-auth.ts).
await invalidateAdminCache(userId);

// Asynchronously log the admin mutation to the audit trail
let auditAction: ActivityAction | string = "";
switch (data.action) {
case "ban":
auditAction = ActivityAction.ACCOUNT_BANNED;
break;
case "suspend":
auditAction = ActivityAction.ACCOUNT_SUSPENDED;
break;
case "activate":
auditAction = "ACCOUNT_ACTIVATED";
break;
case "adjust_trust":
auditAction = "TRUST_ADJUSTED";
break;
case "set_verification":
auditAction = "VERIFICATION_UPDATED";
break;
}

if (auditAction) {
await Promise.all([
createActivityLog({
userId: admin.id,
action: auditAction as ActivityAction,
entityType: "USER",
entityId: userId,
metadata: {
adminEmail: admin.email,
reason: data.reason,
trustScoreAdjustment: data.trustScoreAdjustment,
verificationLevel: data.verificationLevel,
suspensionDays: data.suspensionDays,
previousStatus: user.status,
previousTrustScore: user.trustScore,
},
}).catch(() => {}),
createAuditLog({
actorId: admin.id,
actionType: auditAction,
entityType: "USER",
entityId: userId,
beforeJSON: { status: user.status, trustScore: user.trustScore },
afterJSON: {
action: data.action,
reason: data.reason,
trustScoreAdjustment: data.trustScoreAdjustment,
verificationLevel: data.verificationLevel,
suspensionDays: data.suspensionDays,
},
}).catch(() => {}),
]);
}

return result;
}

private static async getDealStats(userId: string, userType: string) {
let field = "";
if (userType === "INFLUENCER") {
const p = await prisma.influencerProfile.findUnique({
where: { userId },
select: { id: true },
});
if (!p) return null;
field = "influencerId";
return await this.fetchStats(field, p.id);
} else if (userType === "BRAND") {
const p = await prisma.brandProfile.findUnique({
where: { userId },
select: { id: true },
});
if (!p) return null;
field = "brandId";
return await this.fetchStats(field, p.id);
}
return null;
}

private static async fetchStats(field: string, profileId: string) {
const [total, completed, active, cancelled] = await Promise.all([
prisma.deal.count({ where: { [field]: profileId } }),
prisma.deal.count({ where: { [field]: profileId, status: "COMPLETED" } }),
prisma.deal.count({
where: {
[field]: profileId,
status: {
in: [
"ACTIVE",
"PAYMENT_PENDING",
"PAYMENT_HELD",
"CONTENT_SUBMITTED",
"CONTENT_APPROVED",
"VERIFIED",
],
},
},
}),
prisma.deal.count({ where: { [field]: profileId, status: "CANCELLED" } }),
]);
return { total, completed, active, cancelled };
}

static async getFlaggedApplications() {
return await prisma.application.findMany({
where: { status: "FLAGGED" },
select: {
id: true,
proposedRate: true,
createdAt: true,
influencer: {
select: {
id: true,
displayName: true,
user: { select: { id: true, email: true, trustScore: true } },
},
},
campaign: {
select: {
id: true,
title: true,
brand: { select: { id: true, companyName: true } },
},
},
},
orderBy: { createdAt: "desc" },
take: 100, // Safety cap to prevent loading all flagged applications
});
}

static async listViolations(userId?: string) {
const where = userId ? { userId } : {};
return await prisma.userViolation.findMany({
where,
orderBy: { createdAt: "desc" },
take: 100,
include: {
user: {
select: {
id: true,
email: true,
userType: true,
influencerProfile: { select: { displayName: true } },
brandProfile: { select: { companyName: true } },
},
},
},
});
}

static async listAuditLogs(filters?: {
actorId?: string;
entityType?: string;
entityId?: string;
startDate?: Date;
endDate?: Date;
}) {
const where: Prisma.AuditLogWhereInput = {};

if (filters?.actorId) where.actorId = filters.actorId;
if (filters?.entityType) where.entityType = filters.entityType;
if (filters?.entityId) where.entityId = filters.entityId;
if (filters?.startDate || filters?.endDate) {
where.timestamp = {};
if (filters.startDate) where.timestamp.gte = filters.startDate;
if (filters.endDate) where.timestamp.lte = filters.endDate;
}

return await prisma.auditLog.findMany({
where,
orderBy: { timestamp: "desc" },
take: 100,
});
}
}
