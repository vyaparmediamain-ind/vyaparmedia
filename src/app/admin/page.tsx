import prisma from "@/lib/db";
import { AdminService } from "@/services/admin.service";
import VerificationQueue from "@/components/admin/VerificationQueue";
import { PageContainer, PageHeader } from "@/components/ui";
import Link from "next/link";
import {
  ShieldCheck,
  Scale,
  Banknote,
  FileWarning,
  Wallet,
  Users,
  ScrollText,
  AlertTriangle,
  ArrowRight,
  LayoutDashboard,
  Target,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Overview | VyaparMedia",
  description: "Platform operations overview, quick actions, and high-priority queues",
};

export default async function AdminOverviewPage() {
  const [
    pendingUsers,
    pendingVerificationsCount,
    openDisputesCount,
    pendingPayoutsCount,
    flaggedAppsCount,
  ] = await Promise.all([
    AdminService.getVerificationQueue(),
    prisma.user.count({ where: { status: "PENDING_VERIFICATION" } }),
    prisma.dispute.count({ where: { status: "OPEN" } }),
    prisma.withdrawal.count({ where: { status: { in: ["PENDING", "PENDING_REVIEW", "PROCESSING"] } } }),
    prisma.application.count({ where: { status: "FLAGGED" } }),
  ]);

  const kpis = [
    {
      title: "Pending KYC",
      count: pendingVerificationsCount,
      href: "/admin/verifications",
      icon: ShieldCheck,
      color: "text-verified",
      bg: "bg-verified/10",
      border: "border-verified-border",
      subtext: "Influencer & brand identity reviews",
    },
    {
      title: "Open Disputes",
      count: openDisputesCount,
      href: "/admin/disputes",
      icon: Scale,
      color: "text-disputed",
      bg: "bg-disputed/10",
      border: "border-disputed-border",
      subtext: "Escrow funds under mediation",
    },
    {
      title: "Pending Payouts",
      count: pendingPayoutsCount,
      href: "/admin/payouts",
      icon: Banknote,
      color: "text-warning",
      bg: "bg-warning/10",
      border: "border-warning-border",
      subtext: "Bank & UPI withdrawal releases",
    },
    {
      title: "Flagged Apps",
      count: flaggedAppsCount,
      href: "/admin/applications",
      icon: FileWarning,
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
      subtext: "Suspected non-compliant applications",
    },
  ];

  const quickNav = [
    {
      title: "Financials & Escrow",
      desc: "Escrow TVL, fee revenue, refunds, and bank settlements.",
      href: "/admin/financial",
      icon: Wallet,
    },
    {
      title: "User Management",
      desc: "Search, verify, award badges, and manage suspensions.",
      href: "/admin/users",
      icon: Users,
    },
    {
      title: "Audit Trail",
      desc: "Immutable system logs, financial actions, and login events.",
      href: "/admin/audit-logs",
      icon: ScrollText,
    },
    {
      title: "Platform Violations",
      desc: "Off-platform circumvention detection and penalty history.",
      href: "/admin/violations",
      icon: AlertTriangle,
    },
    {
      title: "Category CPV Benchmarks",
      desc: "Tune dynamic & database baselines for relative ROI matching across creator niches.",
      href: "/admin/benchmarks",
      icon: Target,
    },
  ];

  return (
    <PageContainer maxWidth="6xl" className="space-y-8 py-2 sm:py-4">
      {/* Header */}
      <PageHeader
        icon={
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-primary" />
          </div>
        }
        title="Operations Overview"
        subtitle="Live moderation, queue monitoring, and back-office management."
      />

      {/* Priority Action Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={kpi.title}
              href={kpi.href}
              className="group flex flex-col justify-between p-5 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {kpi.title}
                </span>
                <div className={`w-8 h-8 rounded-lg ${kpi.bg} border ${kpi.border} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-black text-foreground">
                  {kpi.count}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                  <span>{kpi.subtext}</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-primary" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Navigation Cards */}
      <div className="space-y-3">
        <h2 className="text-base font-extrabold text-foreground tracking-tight">
          Admin Hub Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickNav.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.title}
                href={module.href}
                className="group flex flex-col p-4 rounded-xl bg-card border border-border hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-muted/60 border border-border flex items-center justify-center text-foreground group-hover:text-primary transition-colors">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    {module.title}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                  {module.desc}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* High-Priority Verification Queue */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-foreground tracking-tight">
              KYC & Verification Queue
            </h2>
            <p className="text-xs text-muted-foreground">
              Influencers and brands waiting for identity and GST/PAN approval.
            </p>
          </div>
          <Link
            href="/admin/verifications"
            className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
          >
            View All ({pendingVerificationsCount})
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <VerificationQueue pendingUsers={pendingUsers.slice(0, 10)} isNarrow={false} />
      </div>
    </PageContainer>
  );
}
