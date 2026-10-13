import type { Prisma } from "@prisma/client";
import type { AdminService } from "@/services/admin.service";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button } from "@/components/ui";
import { ArrowRight, FileText, ShieldAlert, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/utils-client";

type PendingUserElement = Prisma.PromiseReturnType<typeof AdminService.getVerificationQueue>[number];

interface VerificationQueueProps {
  pendingUsers: PendingUserElement[];
  isNarrow?: boolean;
}

export default function VerificationQueue({ pendingUsers, isNarrow = false }: Readonly<VerificationQueueProps>) {
  if (pendingUsers.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
        <EmptyState
          emoji="🛡️"
          title="All Caught Up!"
          description="There are no pending verification requests waiting in the queue right now."
          compact={!isNarrow}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingUsers.map((user) => {
        const name =
          user.influencerProfile?.displayName ||
          user.brandProfile?.companyName ||
          user.email ||
          "Unknown User";

        const hasPan = Boolean(user.taxCompliance?.panLast4);
        const docsCount = user.verificationDocs?.length || user._count?.verificationDocs || 0;

        return (
          <div
            key={user.id}
            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-md transition-all duration-200"
          >
            {/* User Identity */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-base shrink-0">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base text-foreground truncate">
                    {name}
                  </h3>
                  <Badge variant="primary" className="text-[10px] px-2 py-0.5 uppercase tracking-wide">
                    {user.userType}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {user.email} &bull; Joined {formatDate(user.createdAt)}
                </div>
              </div>
            </div>

            {/* Verification Readiness Indicators & CTA */}
            <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-border/60">
              {/* PAN Status */}
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Tax / PAN
                </span>
                <span className="text-xs font-bold inline-flex items-center gap-1 mt-0.5">
                  {hasPan ? (
                    <span className="text-verified flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      PAN ****{user.taxCompliance?.panLast4}
                    </span>
                  ) : (
                    <span className="text-disputed flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Missing PAN
                    </span>
                  )}
                </span>
              </div>

              {/* Documents */}
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Docs
                </span>
                <span className="text-xs font-bold inline-flex items-center gap-1 mt-0.5 text-foreground">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  {docsCount > 0 ? (
                    <span className="text-verified font-bold">{docsCount} attached</span>
                  ) : (
                    <span className="text-warning">0 files</span>
                  )}
                </span>
              </div>

              {/* Review CTA */}
              <Button
                href={`/admin/verifications/${user.id}`}
                variant="primary"
                size="sm"
                className="gap-1.5 font-bold shadow-sm"
                aria-label={`Review verification for ${name}`}
              >
                Review
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
