import Link from "next/link";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { Button, PageContainer } from "@/components/ui";
import { Home, Compass, Wallet, FileText, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Dashboard Page Not Found | VyaparMedia",
  description: "The dashboard subroute you requested could not be found.",
};

export default function DashboardNotFound() {
  return (
    <DashboardShell>
      <PageContainer maxWidth="4xl" className="py-12 flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full text-center space-y-6 bg-card border border-border p-8 rounded-2xl shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary font-mono text-2xl font-black flex items-center justify-center mx-auto">
            404
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold font-heading text-foreground">
              Dashboard View Not Found
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              This dashboard section doesn&apos;t exist or has moved. Pick a verified destination below to continue.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border hover:bg-muted transition-colors text-xs font-semibold text-foreground"
            >
              <Home className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 truncate">
                <span className="block font-bold">Overview</span>
                <span className="text-[11px] text-muted-foreground">Main workspace</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            </Link>

            <Link
              href="/dashboard/campaigns"
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border hover:bg-muted transition-colors text-xs font-semibold text-foreground"
            >
              <Compass className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 truncate">
                <span className="block font-bold">Campaigns</span>
                <span className="text-[11px] text-muted-foreground">Active briefs &amp; discovery</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            </Link>

            <Link
              href="/dashboard/deals"
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border hover:bg-muted transition-colors text-xs font-semibold text-foreground"
            >
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 truncate">
                <span className="block font-bold">My Deals</span>
                <span className="text-[11px] text-muted-foreground">Active milestones</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            </Link>

            <Link
              href="/dashboard/wallet"
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border hover:bg-muted transition-colors text-xs font-semibold text-foreground"
            >
              <Wallet className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 truncate">
                <span className="block font-bold">Escrow Wallet</span>
                <span className="text-[11px] text-muted-foreground">Ledger &amp; payouts</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            </Link>
          </div>

          <div className="pt-2">
            <Button href="/dashboard" variant="primary" className="w-full text-xs font-bold">
              Return to Dashboard
            </Button>
          </div>
        </div>
      </PageContainer>
    </DashboardShell>
  );
}
