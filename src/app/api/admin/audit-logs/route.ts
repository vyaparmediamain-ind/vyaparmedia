import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { AdminService } from "@/services/admin.service";

async function _handler_GET(request: NextRequest) {

const { searchParams } = new URL(request.url);
const actorId = searchParams.get("actorId")?.trim() || undefined;
const entityType = searchParams.get("entityType")?.trim() || undefined;
const entityId = searchParams.get("entityId")?.trim() || undefined;
  const rawStartDate = searchParams.get("startDate")?.trim();
  const rawEndDate = searchParams.get("endDate")?.trim();

  const parsedStartDate = rawStartDate ? new Date(rawStartDate) : undefined;
  const parsedEndDate = rawEndDate ? new Date(rawEndDate) : undefined;

  const startDate = (parsedStartDate && !Number.isNaN(parsedStartDate.getTime())) ? parsedStartDate : undefined;
  const endDate = (parsedEndDate && !Number.isNaN(parsedEndDate.getTime())) ? parsedEndDate : undefined;

const filter: Parameters<typeof AdminService.listAuditLogs>[0] = {};
if (actorId) filter.actorId = actorId;
if (entityType) filter.entityType = entityType;
if (entityId) filter.entityId = entityId;
if (startDate) filter.startDate = startDate;
if (endDate) filter.endDate = endDate;

const auditLogs = await AdminService.listAuditLogs(filter);

return NextResponse.json({
success: true,
data: auditLogs,
});
}

export const GET = apiWrapper(_handler_GET, { requireAdmin: true });
