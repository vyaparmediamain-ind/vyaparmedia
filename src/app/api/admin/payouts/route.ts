import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { maskAccountNumber, tryDecrypt } from "@/lib/encryption";
import { WithdrawalStatus } from "@prisma/client";
import { paginationSchema } from "@/lib/validations";
import { AppError } from "@/lib/errors";

const querySchema = paginationSchema.extend({
status: z
.enum(["PENDING", "PENDING_REVIEW", "PROCESSING", "COMPLETED", "FAILED", "ALL"])
.default("PENDING"),
});

function maskUpi(value?: string | null) {
const plain = tryDecrypt(value);
if (!plain) return null;
const [local, domain] = plain.split("@");
if (!local || !domain) return "Configured";
return `${local.slice(0, 2)}***@${domain}`;
}

async function _handler_GET(request: NextRequest) {
try {
const { searchParams } = new URL(request.url);
const parsed = querySchema.safeParse({
status: searchParams.get("status") || undefined,
page: searchParams.get("page") || undefined,
limit: searchParams.get("limit") || undefined,
});

if (!parsed.success) {
return ApiResponse.error("Invalid parameters");
}

const { status, page, limit } = parsed.data;
let where = {};
if (status === "PENDING") {
where = { status: { in: [WithdrawalStatus.PENDING, WithdrawalStatus.PENDING_REVIEW] } };
} else if (status !== "ALL") {
where = { status };
}

const [withdrawals, total] = await Promise.all([
prisma.withdrawal.findMany({
where,
include: {
wallet: {
select: {
user: {
select: {
id: true,
email: true,
userType: true,
influencerProfile: { select: { displayName: true } },
brandProfile: { select: { companyName: true } },
taxCompliance: {
select: {
panLast4: true,
status: true,
itrAcknowledgementLast4: true,
},
},
},
},
},
},
},
orderBy: { createdAt: "desc" },
skip: (page - 1) * limit,
take: limit,
}),
prisma.withdrawal.count({ where }),
]);

const safeWithdrawals = withdrawals.map((withdrawal: (typeof withdrawals)[number]) => ({
...withdrawal,
bankAccountNumber: maskAccountNumber(withdrawal.bankAccountNumber),
upiId: maskUpi(withdrawal.upiId),
}));

return ApiResponse.success(
{ withdrawals: safeWithdrawals, total, page, limit },
"Payouts retrieved",
);
} catch (error: unknown) {
logger.error("GET /api/admin/payouts error", { error: (error instanceof Error ? error.message : String(error)) });
if (error instanceof AppError) {
return ApiResponse.error(error.message, error.statusCode);
}
return ApiResponse.error("Internal server error", 500);
}
}


// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET, { requireAuth: true, requireAdmin: true });
