"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Input, Select, PageContainer, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils-client";
import type { AdminService } from "@/services/admin.service";
import type { Prisma } from "@prisma/client";
import { ScrollText, Filter, AlertCircle } from "lucide-react";

type AdminAuditLogElement = Prisma.PromiseReturnType<typeof AdminService.listAuditLogs>[number];
type ListAuditLogsResult = {
  success: boolean;
  data: AdminAuditLogElement[];
};

export default function AdminAuditLogsPage() {
  const [actorId, setActorId] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");

  const queryParams = new URLSearchParams();
  if (actorId.trim()) queryParams.set("actorId", actorId.trim());
  if (entityType) queryParams.set("entityType", entityType);
  if (entityId.trim()) queryParams.set("entityId", entityId.trim());

  const { data, error, isLoading } = useSWR<ListAuditLogsResult>(
    `/api/admin/audit-logs?${queryParams.toString()}`,
    fetcher
  );

  const auditLogs = data?.data || [];

  const getEntityBadgeVariant = (type: string | null) => {
    if (type === "USER") return "primary";
    if (type === "DEAL") return "success";
    if (type === "CAMPAIGN") return "warning";
    if (type === "FEEDBACK") return "primary";
    if (type === "BUG") return "danger";
    return "ghost";
  };

  let content;
  if (isLoading) {
    content = (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-muted/40 border border-border animate-pulse" />
        ))}
      </div>
    );
  } else if (error) {
    content = (
      <div className="flex items-center gap-2 p-4 rounded-xl bg-disputed-muted border border-disputed-border text-disputed text-sm font-medium">
        <AlertCircle className="w-4 h-4 shrink-0" />
        Failed to load audit logs.
      </div>
    );
  } else if (auditLogs.length === 0) {
    content = (
      <EmptyState
        emoji=""
        title="No Audit Logs"
        description="No activity matches your filters."
      />
    );
  } else {
    content = (
      <>
        {/* Mobile Card Layout (sm:hidden) */}
        <div className="space-y-3 sm:hidden">
          {auditLogs.map((log: AdminAuditLogElement) => (
            <div key={log.id} className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-foreground">{log.actionType}</span>
                <Badge
                  variant={getEntityBadgeVariant(log.entityType)}
                  className="uppercase text-[10px]"
                >
                  {log.entityType}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-border/60">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-muted-foreground">Actor ID</span>
                  <span className="font-mono text-foreground truncate block">{log.actorId}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-muted-foreground">Entity ID</span>
                  <span className="font-mono text-foreground truncate block">{log.entityId || "—"}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                <span>{formatDateTime(log.timestamp)}</span>
                {log.beforeJSON || log.afterJSON ? (
                  <span
                    className="font-mono text-[10px] text-primary truncate max-w-[140px]"
                    title={JSON.stringify({ before: log.beforeJSON, after: log.afterJSON })}
                  >
                    Details available
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">No diff</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table (hidden sm:block) */}
        <div className="hidden sm:block rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" aria-label="Audit log entries">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  {["Actor ID", "Action Type", "Entity Type", "Entity ID", "Timestamp", "Details"].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="text-left px-4 py-3 text-xs font-extrabold text-muted-foreground uppercase tracking-wider"
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditLogs.map((log: AdminAuditLogElement) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono truncate max-w-[120px]">
                      {log.actorId}
                    </td>
                    <td className="px-4 py-3 font-bold text-sm text-foreground whitespace-nowrap">
                      {log.actionType}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={getEntityBadgeVariant(log.entityType)}
                        className="uppercase text-xs"
                      >
                        {log.entityType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono truncate max-w-[100px]">
                      {log.entityId || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="text-xs text-foreground overflow-hidden whitespace-nowrap max-w-[200px] text-ellipsis font-mono"
                        title={
                          log.beforeJSON || log.afterJSON
                            ? JSON.stringify({ before: log.beforeJSON, after: log.afterJSON })
                            : ""
                        }
                      >
                        {log.beforeJSON || log.afterJSON
                          ? JSON.stringify({ before: log.beforeJSON, after: log.afterJSON })
                          : "—"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  return (
    <PageContainer maxWidth="6xl" className="space-y-6 py-2 sm:py-4">
      {/* Page header */}
      <PageHeader
        icon={
          <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-muted-foreground" />
          </div>
        }
        title="Audit Logs"
        subtitle="View all system activity and administrative actions."
      />

      {/* Filters */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5" />
          Filters
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-stretch sm:items-end">
          <div className="w-full sm:flex-1 sm:min-w-[180px]">
            <Input
              label="Actor ID"
              id="filter-actor-id"
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              placeholder="Search by Actor ID..."
              fullWidth
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              label="Entity Type"
              id="filter-entity-type"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              fullWidth
            >
              <option value="">All Types</option>
              <option value="USER">User</option>
              <option value="DEAL">Deal</option>
              <option value="CAMPAIGN">Campaign</option>
              <option value="APPLICATION">Application</option>
              <option value="WALLET">Wallet</option>
              <option value="FEEDBACK">Feedback</option>
              <option value="BUG">Bug Report</option>
            </Select>
          </div>
          <div className="w-full sm:flex-1 sm:min-w-[180px]">
            <Input
              label="Entity ID"
              id="filter-entity-id"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="Search by Entity ID..."
              fullWidth
            />
          </div>
        </div>
      </div>

      {/* Results count */}
      {!isLoading && !error && auditLogs.length > 0 && (
        <div className="text-xs text-muted-foreground font-medium">
          Showing {auditLogs.length} log{auditLogs.length !== 1 ? "s" : ""}
        </div>
      )}

      {content}
    </PageContainer>
  );
}
