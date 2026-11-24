"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Input, Select, PageContainer, PageHeader, Modal } from "@/components/ui";
import { formatDateTime } from "@/lib/utils-client";
import { formatAuditLogDetails } from "@/lib/audit-formatters";
import type { AdminService } from "@/services/admin.service";
import type { Prisma } from "@prisma/client";
import { ScrollText, Filter, AlertCircle, Code2, Copy, Check } from "lucide-react";

type AdminAuditLogElement = Prisma.PromiseReturnType<typeof AdminService.listAuditLogs>[number];
type ListAuditLogsResult = {
  success: boolean;
  data: AdminAuditLogElement[];
};

export default function AdminAuditLogsPage() {
  const [actorId, setActorId] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [selectedLog, setSelectedLog] = useState<AdminAuditLogElement | null>(null);
  const [copied, setCopied] = useState(false);

  const queryParams = new URLSearchParams();
  if (actorId.trim()) queryParams.set("actorId", actorId.trim());
  if (entityType) queryParams.set("entityType", entityType);
  if (entityId.trim()) queryParams.set("entityId", entityId.trim());

  const { data, error, isLoading } = useSWR<ListAuditLogsResult>(
    `/api/admin/audit-logs?${queryParams.toString()}`,
    fetcher
  );

  const rawData = data?.data;
  const auditLogs: AdminAuditLogElement[] = useMemo(() => {
    if (Array.isArray(rawData)) return rawData;
    const rawObj = rawData as unknown as Record<string, unknown> | undefined;
    if (Array.isArray(rawObj?.data)) {
      return rawObj.data as AdminAuditLogElement[];
    }
    const dataObj = data as unknown as Record<string, unknown> | undefined;
    if (Array.isArray(dataObj?.auditLogs)) {
      return dataObj.auditLogs as AdminAuditLogElement[];
    }
    if (Array.isArray(data)) {
      return data as unknown as AdminAuditLogElement[];
    }
    return [];
  }, [rawData, data]);

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
        guideId="admin-immutable-audit-logs"
        guideLabel="Audit Logs Guide"
      />
    );
  } else {
    content = (
      <>
        {/* Mobile Card Layout (sm:hidden) */}
        <div className="space-y-3 sm:hidden">
          {auditLogs.map((log: AdminAuditLogElement) => {
            const detailsText = formatAuditLogDetails(log);
            const hasRawData = Boolean(log.beforeJSON || log.afterJSON);

            return (
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

                {/* English Details */}
                <div className="pt-1.5 border-t border-border/60 space-y-0.5">
                  <span className="block text-[10px] uppercase font-bold text-muted-foreground">Details</span>
                  <p className="text-xs text-foreground font-medium leading-relaxed">
                    {detailsText}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                  <span>{formatDateTime(log.timestamp)}</span>
                  {hasRawData ? (
                    <button
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>View JSON</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">No diff</span>
                  )}
                </div>
              </div>
            );
          })}
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
                {auditLogs.map((log: AdminAuditLogElement) => {
                  const detailsText = formatAuditLogDetails(log);
                  const hasRawData = Boolean(log.beforeJSON || log.afterJSON);

                  return (
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
                        <div className="flex items-center gap-2 max-w-[340px] lg:max-w-[440px] overflow-hidden">
                          <span
                            className="text-xs text-foreground font-medium truncate"
                            title={detailsText}
                          >
                            {detailsText}
                          </span>
                          {hasRawData && (
                            <button
                              type="button"
                              onClick={() => setSelectedLog(log)}
                              className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer"
                              title="Inspect full raw JSON payload"
                              aria-label="Inspect raw JSON"
                            >
                              <Code2 className="w-3 h-3" />
                              <span>JSON</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  return (
    <PageContainer maxWidth="7xl" className="space-y-6 py-2 sm:py-4">
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

      {/* JSON Inspection Modal */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title={
            <div className="flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-primary shrink-0" />
              <span>Audit Event Details</span>
            </div>
          }
          maxWidth="640px"
        >
          <div className="space-y-4 pt-1">
            {/* Event Header Summary */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">{selectedLog.actionType}</span>
                  <Badge variant={getEntityBadgeVariant(selectedLog.entityType)} className="uppercase text-[10px]">
                    {selectedLog.entityType}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">{formatDateTime(selectedLog.timestamp)}</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {formatAuditLogDetails(selectedLog)}
              </p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-card border border-border">
                <span className="block text-[10px] uppercase font-bold text-muted-foreground">Actor ID</span>
                <span className="font-mono text-foreground break-all">{selectedLog.actorId}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border">
                <span className="block text-[10px] uppercase font-bold text-muted-foreground">Entity ID</span>
                <span className="font-mono text-foreground break-all">{selectedLog.entityId || "—"}</span>
              </div>
              {selectedLog.ipAddress && (
                <div className="col-span-2 p-2.5 rounded-lg bg-card border border-border">
                  <span className="block text-[10px] uppercase font-bold text-muted-foreground">IP Address</span>
                  <span className="font-mono text-foreground">{selectedLog.ipAddress}</span>
                </div>
              )}
            </div>

            {/* Raw JSON Payload */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Raw Payload
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const fullPayload = JSON.stringify(
                      { before: selectedLog.beforeJSON, after: selectedLog.afterJSON },
                      null,
                      2
                    );
                    navigator.clipboard.writeText(fullPayload);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied!" : "Copy JSON"}</span>
                </button>
              </div>

              {selectedLog.beforeJSON !== null && selectedLog.beforeJSON !== undefined && (
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">Before State:</span>
                  <pre className="p-3 rounded-xl bg-background/90 border border-border text-[11px] font-mono text-foreground overflow-x-auto max-h-[160px] whitespace-pre-wrap">
                    {JSON.stringify(selectedLog.beforeJSON, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.afterJSON !== null && selectedLog.afterJSON !== undefined && (
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {selectedLog.beforeJSON ? "After State:" : "Event Data:"}
                  </span>
                  <pre className="p-3 rounded-xl bg-background/90 border border-border text-[11px] font-mono text-foreground overflow-x-auto max-h-[220px] whitespace-pre-wrap">
                    {JSON.stringify(selectedLog.afterJSON, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
