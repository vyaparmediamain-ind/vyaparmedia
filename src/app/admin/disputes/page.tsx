import React from "react";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requireActiveAdmin } from "@/lib/admin-auth";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button, PageContainer, PageHeader } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils-client";
import { Scale, Clock, CheckCircle2 } from "lucide-react";
import { Prisma, DisputeStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dispute Resolution Queue | Admin",
  description: "Review open and Tier 2 mediation cases before funds move",
};

type DisputeWithDetails = Prisma.DisputeGetPayload<{
  include: {
    deal: {
      include: {
        campaign: { select: { title: true } };
        influencer: { select: { displayName: true } };
        brand: { select: { companyName: true } };
      };
    };
    raisedBy: { select: { email: true } };
  };
}>;

function DisputeItem({
  dispute,
  showHistory,
}: {
  readonly dispute: DisputeWithDetails;
  readonly showHistory: boolean;
}) {
  const campaignTitle = dispute.deal?.campaign?.title || "Untitled Campaign";
  const userEmail = dispute.raisedBy?.email || "Unknown user";
  const createdDate = formatDate(dispute.createdAt);
  const badgeVariant = showHistory ? "success" : "danger";
  const formattedAmount = formatCurrency(dispute.deal?.amount);

  return (
    <div className="flex justify-between items-center gap-4 flex-wrap p-4 rounded-xl bg-card border border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all">
      <div className="flex-1 min-w-0">
        <div className="font-bold text-base text-foreground mb-1 truncate">
          {campaignTitle}
        </div>
        <div className="text-xs text-muted-foreground">
          Raised by: {userEmail} · {createdDate}
        </div>
        <div className="mt-2 flex gap-2 text-xs flex-wrap">
          <Badge variant={badgeVariant}>{dispute.status}</Badge>
          <Badge variant="ghost">{dispute.type}</Badge>
          <span className="text-muted-foreground font-medium">Amount: {formattedAmount}</span>
        </div>
      </div>
      <Button
        href={`/admin/disputes/${dispute.id}`}
        variant="primary"
        size="sm"
        aria-label={
          showHistory
            ? `View details for dispute ${dispute.id}`
            : `Resolve dispute ${dispute.id}`
        }
      >
        {showHistory ? "View Details" : "Resolve"}
      </Button>
    </div>
  );
}

const ACTIVE_STATUSES: DisputeStatus[] = ["OPEN", "TIER2_MEDIATION", "TIER3_ARBITRATION"];
const HISTORY_STATUSES: DisputeStatus[] = ["RESOLVED", "CLOSED", "TIER1_AUTO"];

async function fetchDisputes(showHistory: boolean): Promise<{ disputes: DisputeWithDetails[]; error: boolean }> {
  try {
    const disputes = await prisma.dispute.findMany({
      where: {
        status: { in: showHistory ? HISTORY_STATUSES : ACTIVE_STATUSES },
      },
      include: {
        deal: {
          include: {
            campaign: { select: { title: true } },
            influencer: { select: { displayName: true } },
            brand: { select: { companyName: true } },
          },
        },
        raisedBy: { select: { email: true } },
      },
      take: 100,
      orderBy: { createdAt: "desc" },
    });
    return { disputes: disputes as DisputeWithDetails[], error: false };
  } catch (error) {
    logger.error("Admin dispute queue failed to load", error);
    return { disputes: [], error: true };
  }
}

function renderDisputeContent(
  disputes: DisputeWithDetails[],
  showHistory: boolean,
  loadError: boolean,
): React.ReactNode {
  if (loadError) {
    return (
      <div className="p-5 rounded-xl bg-disputed-muted border border-disputed-border text-disputed text-sm font-medium">
        Could not load disputes right now. Please retry after checking database connectivity.
      </div>
    );
  }
  if (disputes.length === 0) {
    const title = showHistory ? "No Historical Disputes" : "No Active Disputes";
    const description = showHistory
      ? "No historical disputes have been recorded."
      : "There are no active disputes at the moment.";
    return <EmptyState title={title} description={description} compact />;
  }
  return (
    <div className="space-y-3">
      {(disputes ?? []).map((dispute) => (
        <DisputeItem key={dispute.id} dispute={dispute} showHistory={showHistory} />
      ))}
    </div>
  );
}

export default async function AdminDisputeListPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  try {
    await requireActiveAdmin(session?.user);
  } catch {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const showHistory = params.history === "true";

  const { disputes, error } = await fetchDisputes(showHistory);
  const content = renderDisputeContent(disputes, showHistory, error);

  return (
    <PageContainer maxWidth="4xl" className="space-y-6 py-2 sm:py-4">
      {/* Page header */}
      <PageHeader
        icon={
          <div className="w-10 h-10 rounded-xl bg-disputed/10 border border-disputed-border flex items-center justify-center">
            <Scale className="w-5 h-5 text-disputed" />
          </div>
        }
        title="Dispute Resolution Queue"
        subtitle="Review open and Tier 2 mediation cases before funds move."
      />

      {/* Tab toggle */}
      <div className="flex gap-2" role="tablist" aria-label="Dispute queue filters">
        <Button
          href="/admin/disputes"
          variant={showHistory ? "secondary" : "primary"}
          size="sm"
          aria-label="View active disputes"
          {...(!showHistory ? { "aria-current": "page" as const } : {})}
          className="gap-1.5"
        >
          <Clock className="w-3.5 h-3.5" />
          Active Disputes
          {!showHistory && (
            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-foreground/20 text-[10px] font-extrabold">
              {disputes.length}
            </span>
          )}
        </Button>
        <Button
          href="/admin/disputes?history=true"
          variant={showHistory ? "primary" : "secondary"}
          size="sm"
          aria-label="View dispute history"
          {...(showHistory ? { "aria-current": "page" as const } : {})}
          className="gap-1.5"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Dispute History
          {showHistory && (
            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-foreground/20 text-[10px] font-extrabold">
              {disputes.length}
            </span>
          )}
        </Button>
      </div>

      {content}
    </PageContainer>
  );
}
