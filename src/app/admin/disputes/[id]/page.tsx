import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { resolveDispute } from "../../dispute-actions";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button, PageContainer, PageHeader } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils-client";
import { checkDisputeResolutionEligibility } from "@/lib/action-eligibility";
import {
  Scale,
  FileText,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  History,
  AlertTriangle,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dispute Resolution | Admin",
  description: "Administrative arbitration and final verdict for escrow dispute",
};

function StatusBadge({ status }: { readonly status: string }) {
  let variant: "success" | "danger" | "warning" | "ghost" = "ghost";
  if (status === "COMPLETED" || status === "VERIFIED") {
    variant = "success";
  } else if (status === "DISPUTED") {
    variant = "danger";
  } else if (status === "CANCELLED") {
    variant = "warning";
  }
  return (
    <Badge variant={variant} className="text-[10px] uppercase">
      {status}
    </Badge>
  );
}

function DealHistoryList({
  deals,
}: {
  readonly deals: Array<{
    id: string;
    status: string;
    amount: number;
    createdAt: Date;
    campaign: { title: string } | null;
  }>;
}) {
  if (deals.length === 0) {
    return (
      <EmptyState
        emoji="📜"
        title="No Previous Deals"
        description="No previous deal history found for this party."
        compact
      />
    );
  }
  return (
    <div className="space-y-2">
      {deals.map((d) => (
        <div
          key={d.id}
          className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/60 text-xs"
        >
          <div className="min-w-0 flex-1 pr-3">
            <div className="font-bold text-foreground truncate">
              {d.campaign?.title || "Direct Campaign Deal"}
            </div>
            <div className="text-muted-foreground mt-0.5">
              {formatDate(d.createdAt)} &bull; {formatCurrency(d.amount)}
            </div>
          </div>
          <StatusBadge status={d.status} />
        </div>
      ))}
    </div>
  );
}

export default async function AdminDisputeDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      deal: {
        include: {
          campaign: true,
          influencer: {
            include: {
              user: { select: { id: true, email: true } },
            },
          },
          brand: {
            include: {
              user: { select: { id: true, email: true } },
            },
          },
        },
      },
      raisedBy: true,
      evidence: true,
    },
  });

  if (!dispute) notFound();

  // Fetch deal histories for both parties with null-safety guards
  const [influencerDeals, brandDeals] = await Promise.all([
    dispute.deal.influencerId
      ? prisma.deal.findMany({
          where: {
            influencerId: dispute.deal.influencerId,
            id: { not: dispute.dealId },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            amount: true,
            createdAt: true,
            campaign: { select: { title: true } },
          },
        })
      : Promise.resolve([]),
    dispute.deal.brandId
      ? prisma.deal.findMany({
          where: {
            brandId: dispute.deal.brandId,
            id: { not: dispute.dealId },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            amount: true,
            createdAt: true,
            campaign: { select: { title: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const dealAmount =
    typeof dispute.deal.totalAmount === "number" && dispute.deal.totalAmount > 0
      ? dispute.deal.totalAmount
      : (dispute.deal.amount || 0);

  const session = await auth();
  const resolutionEligibility = checkDisputeResolutionEligibility(
    {
      status: dispute.status,
      deal: {
        status: dispute.deal.status,
        influencer: { userId: dispute.deal.influencer?.userId || dispute.deal.influencer?.user?.id || "" },
        brand: { userId: dispute.deal.brand?.userId || dispute.deal.brand?.user?.id || "" },
      },
    },
    session?.user?.id
  );

  return (
    <PageContainer maxWidth="5xl" className="space-y-6 py-2 sm:py-4">
      {/* Header */}
      <PageHeader
        backHref="/admin/disputes"
        backLabel="Back to Disputes Queue"
        icon={
          <div className="w-12 h-12 rounded-2xl bg-disputed/10 border border-disputed-border flex items-center justify-center">
            <Scale className="w-6 h-6 text-disputed" />
          </div>
        }
        title="Dispute Mediation"
        badge={
          <Badge
            variant={dispute.status === "OPEN" ? "warning" : "success"}
            className="text-xs uppercase"
          >
            {dispute.status}
          </Badge>
        }
        subtitle={
          <span>
            Case ID: <code className="font-mono">{dispute.id}</code> &bull; Deal:{" "}
            <strong>{dispute.deal.campaign?.title || "Campaign Deal"}</strong>
          </span>
        }
        actions={
          <div className="px-4 py-2.5 rounded-xl bg-muted/40 border border-border text-right shrink-0">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Escrow in Dispute
            </div>
            <div className="text-xl font-black text-disputed">
              {formatCurrency(dealAmount)}
            </div>
          </div>
        }
      />

      {/* Details & Evidence Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Case Details */}
        <section className="p-6 rounded-2xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              Case Information
            </h2>
          </div>

          <div className="space-y-2.5">
            {[
              { label: "Dispute Reason", value: dispute.type },
              { label: "Raised By", value: dispute.raisedBy?.email || "Participant" },
              { label: "Campaign", value: dispute.deal.campaign?.title || "N/A" },
              { label: "Total Escrow", value: formatCurrency(dealAmount) },
              { label: "Date Lodged", value: formatDate(dispute.createdAt) },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/60 text-sm"
              >
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {item.label}
                </span>
                <span className="font-bold text-foreground truncate max-w-[240px]">
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Statement of Claim
            </span>
            <div className="p-3.5 rounded-xl bg-muted/20 border border-border text-xs leading-relaxed text-foreground">
              {dispute.description || "No description provided."}
            </div>
          </div>
        </section>

        {/* Evidence Log */}
        <section className="p-6 rounded-2xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h2 className="text-base font-bold text-foreground">
              Submitted Evidence ({dispute.evidence.length})
            </h2>
          </div>

          {dispute.evidence.length === 0 ? (
            <EmptyState
              emoji="📭"
              title="No Evidence Filed"
              description="Neither party has uploaded supporting screenshots or files yet."
              compact
            />
          ) : (
            <div className="space-y-3">
              {dispute.evidence.map((ev) => (
                <div
                  key={ev.id}
                  className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-2"
                >
                  <div className="font-semibold text-xs text-foreground">
                    {ev.description}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                    <span>
                      Uploaded {formatDate(ev.submittedAt)}
                    </span>
                    {ev.url && (
                      <Button
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="secondary"
                        size="sm"
                        className="gap-1 h-7 text-[11px] font-bold"
                      >
                        <span>View Attachment</span>
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Past Party Deal Timelines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Influencer History */}
        <section className="p-6 rounded-2xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <History className="w-4 h-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              Influencer History
            </h2>
            <span className="text-xs text-muted-foreground ml-auto">
              Last 10 deals
            </span>
          </div>
          <DealHistoryList deals={influencerDeals} />
        </section>

        {/* Brand History */}
        <section className="p-6 rounded-2xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <History className="w-4 h-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              Brand History
            </h2>
            <span className="text-xs text-muted-foreground ml-auto">
              Last 10 deals
            </span>
          </div>
          <DealHistoryList deals={brandDeals} />
        </section>
      </div>

      {/* Global Verdict Action Panel */}
      <footer className="p-6 sm:p-8 rounded-2xl bg-card border border-border space-y-4">
        <div>
          <h3 className="text-lg font-black text-foreground">
            Administrative Final Verdict
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Render a binding decision. This executes irrevocable escrow transfers and notifies all parties.
          </p>
        </div>

        {!resolutionEligibility.allowed && (
          <div className="p-3.5 rounded-xl bg-destructive/10 text-destructive text-xs border border-destructive/20 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-destructive" />
            <span>{resolutionEligibility.reason}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <form
            action={resolveDispute.bind(
              null,
              dispute.id,
              "REFUND_BRAND",
              "Admin Decision: Full Refund to Brand"
            )}
            className="flex-1"
          >
            <Button
              type="submit"
              variant="danger"
              size="lg"
              disabled={!resolutionEligibility.allowed}
              title={!resolutionEligibility.allowed ? resolutionEligibility.reason : undefined}
              className="w-full justify-center gap-2 font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4" />
              Refund Escrow to Brand ({formatCurrency(dealAmount)})
            </Button>
          </form>

          <form
            action={resolveDispute.bind(
              null,
              dispute.id,
              "RELEASE_INFLUENCER",
              "Admin Decision: Release to Influencer"
            )}
            className="flex-1"
          >
            <Button
              type="submit"
              variant="success"
              size="lg"
              disabled={!resolutionEligibility.allowed}
              title={!resolutionEligibility.allowed ? resolutionEligibility.reason : undefined}
              className="w-full justify-center gap-2 font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              Release Escrow to Influencer ({formatCurrency(dealAmount)})
            </Button>
          </form>
        </div>
      </footer>
    </PageContainer>
  );
}
