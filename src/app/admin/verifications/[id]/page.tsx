import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { checkAdminVerificationReviewEligibility } from "@/lib/action-eligibility";
import {
  approveUser,
  rejectUser,
  approveDocument,
  rejectDocument,
} from "../../actions";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button, Input, PageContainer, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils-client";
import { z } from "zod";
import {
  ShieldCheck,
  User,
  Receipt,
  FileText,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

const verificationRejectSchema = z.object({
  reason: z.string().min(5, "Reason must be at least 5 characters").max(100),
});

export const dynamic = "force-dynamic";

function getDocBadgeVariant(status: string): "success" | "danger" | "warning" {
  if (status === "VERIFIED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

export default async function VerificationDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      influencerProfile: true,
      brandProfile: true,
      taxCompliance: true,
      verificationDocs: true,
      badges: { include: { badge: true } },
    },
  });

  if (!user) notFound();

  const adminEligibility = checkAdminVerificationReviewEligibility(
    user.id,
    session?.user?.id,
    user.status
  );

  // Regenerate presigned URLs for all KYC documents on load.
  const docsWithRefreshedUrls = await Promise.all(
    user.verificationDocs.map(async (doc: typeof user.verificationDocs[number]) => {
      if (!doc.documentUrl) return doc;
      if (doc.documentUrl.startsWith("/uploads/")) {
        return doc;
      }
      let key = doc.documentUrl;
      const verificationIdx = key.indexOf("verification/");
      if (verificationIdx !== -1) {
        key = key.substring(verificationIdx);
        const queryIdx = key.indexOf("?");
        if (queryIdx !== -1) {
          key = key.substring(0, queryIdx);
        }
      }
      try {
        const { getSignedUrl } = await import("@/lib/storage");
        const freshUrl = await getSignedUrl(key, 900); // 15 mins short TTL
        return { ...doc, documentUrl: freshUrl };
      } catch {
        return doc;
      }
    })
  );

  // Audit log admin access to sensitive KYC documentation
  if (session?.user?.id && user.verificationDocs.length > 0) {
    try {
      const { createActivityLog } = await import("@/lib/audit");
      await createActivityLog({
        userId: session.user.id,
        action: "ADMIN_VIEW_KYC_DOCUMENTS",
        entityType: "User",
        entityId: user.id,
        metadata: {
          targetUserId: user.id,
          documentsCount: user.verificationDocs.length,
        },
      });
    } catch {
      // Non-fatal audit log failure
    }
  }

  const activeSince = formatDate(user.createdAt);
  const displayName =
    user.influencerProfile?.displayName ||
    user.brandProfile?.companyName ||
    user.email ||
    "User Profile";

  return (
    <PageContainer maxWidth="5xl" className="space-y-6 py-2 sm:py-4">
      {/* Header */}
      <PageHeader
        backHref="/admin/verifications"
        backLabel="Back to Verification Queue"
        icon={
          <div className="w-12 h-12 rounded-2xl bg-verified/10 border border-verified-border flex items-center justify-center font-black text-verified text-lg">
            {displayName.charAt(0).toUpperCase()}
          </div>
        }
        title={displayName}
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="primary" className="text-xs uppercase">
              {user.userType}
            </Badge>
            <Badge
              variant={
                user.status === "ACTIVE"
                  ? "success"
                  : user.status === "PENDING_VERIFICATION"
                  ? "warning"
                  : "danger"
              }
              className="text-xs"
            >
              {user.status.replaceAll("_", " ")}
            </Badge>
          </div>
        }
        subtitle={
          <span>
            User ID: <code className="text-xs font-mono">{user.id}</code> &bull; Registered {activeSince}
          </span>
        }
        actions={
          <div className="px-4 py-2 rounded-xl bg-muted/40 border border-border text-right">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              DRS Rating (CIBIL 300-900)
            </div>
            <div className={`text-lg font-black ${user.trustScore >= 650 ? "text-verified" : user.trustScore >= 550 ? "text-warning" : "text-destructive"}`}>
              {user.trustScore} / 900
            </div>
          </div>
        }
      />

      {/* Information Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Info */}
        <section className="p-6 rounded-2xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border">
            <User className="w-4 h-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              Profile Details
            </h2>
          </div>

          <div className="space-y-2.5">
            {[
              { label: "Email Address", value: user.email },
              { label: "Phone Contact", value: user.phone || "Not provided" },
              { label: "Account Role", value: user.userType },
              { label: "Member Since", value: activeSince },
              {
                label: "Verification Status",
                value: user.status.replaceAll("_", " "),
              },
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
        </section>

        {/* Tax Readiness */}
        <section className="p-6 rounded-2xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border">
            <Receipt className="w-4 h-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              India Tax Compliance
            </h2>
          </div>

          <div className="space-y-2.5">
            {[
              {
                label: "PAN",
                value: user.taxCompliance?.panLast4
                  ? `****${user.taxCompliance.panLast4}`
                  : "Missing",
                status: user.taxCompliance?.panLast4 ? "verified" : "missing",
              },
              {
                label: "GSTIN",
                value: user.taxCompliance?.gstinLast4
                  ? `****${user.taxCompliance.gstinLast4}`
                  : user.taxCompliance?.gstRegistrationType || "Not declared",
                status: user.taxCompliance?.gstinLast4 ? "verified" : "neutral",
              },
              {
                label: "ITR Ack",
                value: user.taxCompliance?.itrAcknowledgementLast4
                  ? `****${user.taxCompliance.itrAcknowledgementLast4}`
                  : "Not provided",
                status: "neutral",
              },
              {
                label: "E-Invoice Applicable",
                value: user.taxCompliance?.eInvoiceApplicable ? "Yes" : "No",
                status: "neutral",
              },
              {
                label: "Compliance Status",
                value: user.taxCompliance?.status || "ACTION_REQUIRED",
                status: user.taxCompliance?.status === "READY" ? "verified" : "warning",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/60 text-sm"
              >
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {item.label}
                </span>
                <span
                  className={`font-bold ${
                    item.status === "verified"
                      ? "text-verified"
                      : item.status === "missing"
                      ? "text-disputed"
                      : item.status === "warning"
                      ? "text-warning"
                      : "text-foreground"
                  }`}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* KYC Proof Documents */}
      <section className="p-6 rounded-2xl bg-card border border-border space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              Submitted KYC Documents ({docsWithRefreshedUrls.length})
            </h2>
          </div>
        </div>

        {docsWithRefreshedUrls.length === 0 ? (
          <EmptyState
            emoji="📄"
            title="No Documents Uploaded"
            description="No verification documents have been submitted by this user yet."
            compact
          />
        ) : (
          <div className="space-y-4">
            {docsWithRefreshedUrls.map((doc) => (
              <div
                key={doc.id}
                className="p-5 rounded-xl bg-muted/20 border border-border space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground uppercase tracking-wide">
                          {doc.type.replaceAll("_", " ")}
                        </span>
                        <Badge variant={getDocBadgeVariant(doc.status)} className="text-[10px] uppercase">
                          {doc.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                        Doc ID: {doc.id.slice(0, 12)}... &bull; {formatDate(doc.createdAt)}
                      </div>
                    </div>
                  </div>

                  {doc.documentUrl && (
                    <Button
                      href={doc.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="secondary"
                      size="sm"
                      className="gap-1.5"
                    >
                      <span>View Document</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                {doc.status === "PENDING" && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-3 border-t border-border">
                    <form action={approveDocument.bind(null, doc.id, user.id)} className="sm:w-auto">
                      <Button
                        type="submit"
                        variant="success"
                        size="sm"
                        disabled={!adminEligibility.allowed}
                        className="w-full gap-1 font-bold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve Document
                      </Button>
                    </form>
                    <form
                      action={async (formData) => {
                        "use server";
                        const rawReason = formData.get("reason") as string;
                        const { reason } = verificationRejectSchema.parse({ reason: rawReason });
                        await rejectDocument(doc.id, user.id, reason);
                      }}
                      className="flex-1 flex gap-2 items-center"
                    >
                      <Input
                        name="reason"
                        placeholder="Rejection reason for this doc..."
                        required
                        className="flex-1 text-xs"
                      />
                      <Button
                        type="submit"
                        variant="danger"
                        size="sm"
                        disabled={!adminEligibility.allowed}
                        className="gap-1 shrink-0 font-bold"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Global Decision Engine Bar */}
      <footer className="p-6 sm:p-8 rounded-2xl bg-card border border-border space-y-4">
        <div>
          <h3 className="text-lg font-black text-foreground">
            Verification Decision Engine
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Finalize user status. Passing verification enables escrow withdrawals, deal bidding, and public listing.
          </p>
          {!adminEligibility.allowed && adminEligibility.reason && (
            <p className="text-xs text-destructive font-semibold mt-2">
              {adminEligibility.reason}
            </p>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 pt-2">
          <form action={approveUser.bind(null, user.id)} className="shrink-0">
            <Button
              type="submit"
              variant="success"
              size="lg"
              disabled={!adminEligibility.allowed}
              className="w-full md:w-auto gap-2 font-bold px-6 shadow-sm"
            >
              <ShieldCheck className="w-5 h-5" />
              Approve & Verify Account
            </Button>
          </form>

          <div className="hidden md:block w-px h-10 bg-border" />

          <form
            action={async (formData) => {
              "use server";
              const rawReason = formData.get("reason") as string;
              const { reason } = verificationRejectSchema.parse({ reason: rawReason });
              await rejectUser(user.id, reason);
            }}
            className="flex-1 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center"
          >
            <Input
              name="reason"
              placeholder="Provide reason for account rejection..."
              required
              className="flex-1"
            />
            <Button
              type="submit"
              variant="danger"
              size="lg"
              disabled={!adminEligibility.allowed}
              className="shrink-0 gap-2 font-bold px-6"
            >
              <AlertCircle className="w-4 h-4" />
              Reject Account
            </Button>
          </form>
        </div>
      </footer>
    </PageContainer>
  );
}
