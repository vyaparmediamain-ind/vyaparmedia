import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { AdminService } from "@/services/admin.service";
import { z } from "zod";

// Schema for updating user status
const updateUserSchema = z.object({
action: z.enum([
"ban",
"suspend",
"activate",
"adjust_trust",
"set_verification",
]),
reason: z.string().max(500).optional(),
trustScoreAdjustment: z.number().min(-100).max(100).optional(),
verificationLevel: z.enum(["NONE", "BASIC", "IDENTITY", "FULL"]).optional(),
suspensionDays: z.number().min(1).max(365).optional(),
}).strip();

export const GET = apiWrapper(async (_req, { params }) => {
const { id } = await params;
const userId = Array.isArray(id) ? id[0]! : id;
if (!userId) {
return ApiResponse.error("Invalid user ID");
}
const result = await AdminService.getUserDetails(userId);

return ApiResponse.success(result, "User details retrieved");
}, { requireAuth: true, requireAdmin: true });

export const PUT = apiWrapper(async (req, { params }) => {
const session = (req as AuthenticatedRequest).session;

const { id } = await params;
const userId = Array.isArray(id) ? id[0]! : id;
if (!userId) {
return ApiResponse.error("Invalid user ID");
}

// Parse Body
const body = await req.json();
const parsed = updateUserSchema.parse(body);

const updateData: Parameters<typeof AdminService.updateUserStatus>[2] = {
action: parsed.action,
};
if (parsed.reason !== undefined) updateData.reason = parsed.reason;
if (parsed.trustScoreAdjustment !== undefined) updateData.trustScoreAdjustment = parsed.trustScoreAdjustment;
if (parsed.verificationLevel !== undefined) updateData.verificationLevel = parsed.verificationLevel;
if (parsed.suspensionDays !== undefined) updateData.suspensionDays = parsed.suspensionDays;

const result = await AdminService.updateUserStatus(
session.user,
userId,
updateData,
);

return ApiResponse.success(result, "User status updated");
}, { requireAuth: true, requireAdmin: true });
