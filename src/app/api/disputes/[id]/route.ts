import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiWrapper } from "@/lib/api-wrapper";
import { DisputeService } from "@/services/dispute.service";
import { AdminService } from "@/services/admin.service";
import { analyzeDispute } from "@/lib/dispute-mediator";

export const GET = apiWrapper(async (_req, { params }) => {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const { id } = await params;
const disputeId = Array.isArray(id) ? id[0]! : id;

let isAdmin = false;

// Check if user is admin to allow unrestricted access
try {
if (session.user.email) {
await AdminService.checkAdminAccess(session.user);
isAdmin = true;
}
} catch {
// Not admin
}

if (!disputeId) {
return NextResponse.json({ error: "Invalid dispute ID" }, { status: 400 });
}

const dispute = await DisputeService.getDisputeDetails(
session.user.id,
disputeId,
isAdmin,
);

let analysis = null;
if (dispute.status === "TIER1_AUTO" || dispute.status === "OPEN") {
try {
analysis = await analyzeDispute(dispute.id);
} catch {
// ignore
}
}

return NextResponse.json({ dispute, analysis });
});
