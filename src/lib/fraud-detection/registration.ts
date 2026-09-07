import prisma from "../db";
import { isVPNOrProxy } from "../ipinfo";
import disposableDomainsList from "disposable-email-domains";
import { FraudCheckResult, FraudFlag, RegistrationCheckParams } from "./types";
import { checkBlacklist } from "./blacklist";

export async function checkRegistrationFraud(
params: RegistrationCheckParams,
): Promise<FraudCheckResult> {
const flags: FraudFlag[] = [];
let riskScore = 0;

// Rule 0: Global Blacklist Check
const blacklistCheck = await checkBlacklist(params.email, params.phone);
if (!blacklistCheck.passed) {
return blacklistCheck;
}

// Rule 1: Multiple accounts from same device
const existingDevices = await prisma.deviceFingerprint.count({
where: { fingerprint: params.deviceFingerprint },
});

if (existingDevices > 0) {
flags.push({
rule: "MULTIPLE_ACCOUNTS_SAME_DEVICE",
severity: "CRITICAL",
description: `${existingDevices} existing account(s) from this device`,
evidence: params.deviceFingerprint,
});
riskScore += 60;
}

// Rule 2: Multiple accounts from same IP in last 24h
const recentIPRegistrations = await prisma.user.count({
where: {
activityLogs: {
some: {
action: "REGISTER",
ipAddress: params.ipAddress,
createdAt: {
gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
},
},
},
},
});

if (recentIPRegistrations >= 3) {
flags.push({
rule: "MULTIPLE_REGISTRATIONS_SAME_IP",
severity: "HIGH",
description: `${recentIPRegistrations} registrations from this IP in 24h`,
evidence: params.ipAddress,
});
riskScore += 40;
}

// Rule 3: Disposable email domain
const disposableDomains = (disposableDomainsList || []) as string[];
const emailDomain = params.email.split("@")[1]?.toLowerCase();

const isDisposable =
emailDomain &&
(disposableDomains.includes(emailDomain) ||
[
"tempmail.com",
"guerrillamail.com",
"10minutemail.com",
"throwaway.email",
"mailinator.com",
"yopmail.com",
"trashmail.com",
"fakeinbox.com",
"dispostable.com",
"getairmail.com",
"maildrop.cc",
"mintemail.com",
"sharklasers.com",
"temp-mail.org",
"temp-mail.com",
"generator.email",
"yopmail.fr",
"yopmail.net",
"duck.com",
].includes(emailDomain));

if (isDisposable && emailDomain) {
flags.push({
rule: "DISPOSABLE_EMAIL",
severity: "CRITICAL",
description: "Disposable email address detected",
evidence: emailDomain,
});
riskScore += 60;
}

// Rule 4: VPN/Proxy detection via IPInfo enterprise module
const isVPN = await isVPNOrProxy(params.ipAddress);
if (isVPN) {
flags.push({
rule: "VPN_DETECTED",
severity: "HIGH",
description: "VPN or proxy IP detected",
evidence: params.ipAddress,
});
riskScore += 50;
}

// Determine action
let action: FraudCheckResult["action"] = "ALLOW";
if (riskScore >= 80) action = "BLOCK";
else if (riskScore >= 50) action = "REVIEW";
else if (riskScore >= 25) action = "FLAG";

return {
passed: action === "ALLOW" || action === "FLAG",
flags,
riskScore,
action,
};
}

// ==================== APPLICATION CHECKS ====================



