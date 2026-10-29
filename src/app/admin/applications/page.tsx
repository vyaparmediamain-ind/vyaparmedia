import { AdminService } from "@/services/admin.service";
import { Prisma } from "@prisma/client";
import { approveFlaggedApplication, rejectFlaggedApplication } from "../actions";
import { formatCurrency, formatDate } from "@/lib/utils-client";
import { checkAdminApplicationReviewEligibility } from "@/lib/action-eligibility";
import { z } from "zod";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button, Input, PageContainer, PageHeader } from "@/components/ui";
import { FileText, AlertTriangle, DollarSign } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Flagged Applications | Admin",
  description: "Review campaign pitches flagged by the automated security risk engine",
};

type FlaggedApp = Prisma.PromiseReturnType<
  typeof AdminService.getFlaggedApplications
>[number];

function getTrustTone(score: number) {
  if (score < 30) return "danger";
  if (score < 60) return "warning";
  return "success";
}

export default async function AdminApplicationsPage() {
  // Call service directly on the server consistent with other admin pages; avoids loopback REST overhead
  const flaggedApps = await AdminService.getFlaggedApplications();
  const totalValue = flaggedApps.reduce((sum, app) => sum + (app.proposedRate || 0), 0);

  return (
    <PageContainer maxWidth="4xl" className="space-y-6 py-2 sm:py-4">
      {/* Page header */}
      <PageHeader
        backHref="/admin"
        backLabel="Admin Dashboard"
        icon={
          <div className="w-10 h-10 rounded-xl bg-disputed/10 border border-disputed-border flex items-center justify-center">
            <FileText className="w-5 h-5 text-disputed" />
          </div>
        }
        title="Flagged Applications"
        subtitle="Review campaign pitches flagged by the automated security risk engine."
      />

      {/* Summary stats strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-disputed-border shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-disputed/10 border border-disputed-border flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-disputed" />
          </div>
          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Flagged
            </div>
            <div className="text-2xl font-extrabold text-disputed tabular-nums">
              {flaggedApps.length}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-pending-border shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-pending/10 border border-pending-border flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-pending" />
          </div>
          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Value at Risk
            </div>
            <div className="text-2xl font-extrabold text-pending tabular-nums">
              {formatCurrency(totalValue)}
            </div>
          </div>
        </div>
      </div>

      {/* Application list */}
      {flaggedApps.length === 0 ? (
        <EmptyState
          emoji=""
          title="No Flagged Applications"
          description="All applications have passed the security risk check."
        />
      ) : (
        <div className="space-y-4">
          {flaggedApps.map((app: FlaggedApp) => {
            const approveAction = approveFlaggedApplication.bind(null, app.id);
            const rejectAction = async (formData: FormData) => {
              "use server";
              const rawReason = (formData.get("reason") as string) || "";
              const reason = z
                .string()
                .max(200, "Reason must be less than 200 characters")
                .default("Security check failed")
                .parse(rawReason);
              await rejectFlaggedApplication(app.id, reason);
            };

            const reviewEligibility = checkAdminApplicationReviewEligibility(app.status);

            return (
              <div
                key={app.id}
                className="p-5 rounded-2xl bg-card border border-disputed-border shadow-sm space-y-4"
              >
                {/* Header row */}
                <div className="flex justify-between flex-wrap gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="danger" className="uppercase text-[10px] tracking-wider">
                        FLAGGED
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {formatDate(app.createdAt)}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-base text-foreground">
                      {app.campaign.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Brand:{" "}
                      <strong className="text-foreground">
                        {app.campaign.brand?.companyName || "Unknown"}
                      </strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground font-semibold">Proposed Rate</div>
                    <div className="text-xl font-extrabold text-verified tabular-nums">
                      {formatCurrency(app.proposedRate || 0)}
                    </div>
                  </div>
                </div>

                {/* Influencer info */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border">
                  <div>
                    <div className="font-bold text-sm text-foreground mb-1">
                      {app.influencer.displayName}
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-4 flex-wrap">
                      <span>{app.influencer.user.email}</span>
                      <span>
                        Trust Score:{" "}
                        <strong
                          className={
                            getTrustTone(app.influencer.user.trustScore) === "danger"
                              ? "text-disputed"
                              : getTrustTone(app.influencer.user.trustScore) === "warning"
                              ? "text-pending"
                              : "text-verified"
                          }
                        >
                          {app.influencer.user.trustScore}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <Button
                    href={`/admin/users?search=${encodeURIComponent(app.influencer.user.email)}`}
                    variant="secondary"
                    aria-label={`View profile for ${app.influencer.displayName}`}
                    className="w-full sm:w-auto min-h-[44px]"
                  >
                    View User Profile
                  </Button>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3 border-t border-border pt-4">
                  {!reviewEligibility.allowed && reviewEligibility.reason && (
                    <span className="text-xs text-destructive font-semibold mr-auto">
                      {reviewEligibility.reason}
                    </span>
                  )}
                  <form action={approveAction} className="w-full sm:w-auto">
                    <Button
                      type="submit"
                      variant="success"
                      disabled={!reviewEligibility.allowed}
                      className="w-full sm:w-auto min-h-[44px] font-bold"
                    >
                      Approve Application
                    </Button>
                  </form>
                  <form action={rejectAction} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full sm:w-auto">
                    <Input
                      type="text"
                      name="reason"
                      placeholder="Rejection reason (optional)..."
                      className="text-sm min-h-[44px]"
                    />
                    <Button
                      type="submit"
                      variant="danger"
                      disabled={!reviewEligibility.allowed}
                      className="min-h-[44px] px-5 font-bold"
                    >
                      Reject
                    </Button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
