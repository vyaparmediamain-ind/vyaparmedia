import prisma from "../db";
import { FraudCheckResult, FraudFlag } from "./types";

export async function checkBlacklist(
email: string,
phone?: string,
): Promise<FraudCheckResult> {
const flags: FraudFlag[] = [];
let riskScore = 0;

// Check DB for users with this email/phone who are already BANNED
const bannedUser = await prisma.user.findFirst({
where: {
OR: [{ email: email.toLowerCase() }, ...(phone ? [{ phone }] : [])],
status: "BANNED",
},
select: { id: true, email: true },
});

if (bannedUser) {
flags.push({
rule: "PREVIOUSLY_BANNED_ACCOUNT",
severity: "CRITICAL",
description: `Email or phone is associated with a previously banned account`,
});
riskScore += 100;
}

// Also check UserViolation table for PERMANENT_BAN violations
const activeViolation = await prisma.userViolation.findFirst({
where: {
user: { email: email.toLowerCase() },
action: "PERMANENT_BAN",
},
});

if (activeViolation && !bannedUser) {
flags.push({
rule: "ACTIVE_PERMANENT_BAN_VIOLATION",
severity: "CRITICAL",
description: "Account has an active permanent ban violation record",
});
riskScore += 100;
}

return {
passed: riskScore === 0,
flags,
riskScore,
action: riskScore >= 100 ? "BLOCK" : "ALLOW",
};
}

