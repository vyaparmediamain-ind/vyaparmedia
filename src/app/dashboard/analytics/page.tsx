import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import DashboardShell from "@/components/dashboard/DashboardShell";
import {
  getInfluencerAnalytics,
  getBrandAnalytics,
} from "@/lib/analytics-engine";
import { logger } from "@/lib/logger";
import { isAdmin as rbacIsAdmin, isBrand, isInfluencer } from "@/lib/rbac";
import { Button, PageContainer, PageHeader } from "@/components/ui";
import prisma from "@/lib/db";
import AnalyticsPageClient from "./AnalyticsPageClient";
import { BarChart3, ChevronRight, Wallet, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Analytics & FY Reports | VyaparMedia",
  description: "Performance metrics, revenue analytics, escrow ledger history, and Indian Financial Year compliance reports.",
};

async function fetchAnalyticsData(userId: string, userType: string, fy?: string) {
  let influencerData = null;
  let brandData = null;

  if (isInfluencer(userType)) {
    try {
      influencerData = await getInfluencerAnalytics(userId, fy);
    } catch (error) {
      logger.error("Influencer analytics fetch failed", error, { userId, fy });
    }
  } else if (isBrand(userType)) {
    try {
      brandData = await getBrandAnalytics(userId, fy);
    } catch (error) {
      logger.error("Brand analytics fetch failed", error, { userId, fy });
    }
  }

  return { influencerData, brandData };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ fy?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const { userType, id: userId } = session.user;
  const isAdmin = rbacIsAdmin(userType);
  const fy = resolvedSearchParams?.fy;

  if (isAdmin) {
    redirect("/admin/analytics");
  }

  // Guard: Newly registered users must complete onboarding before entering the dashboard
  let isCompleted = true;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        userType: true,
        influencerProfile: { select: { city: true, categories: true } },
        brandProfile: { select: { companyName: true, city: true } },
      },
    });

    const isInfluencerUser = user?.userType === "INFLUENCER";
    isCompleted = isInfluencerUser
      ? Boolean(user?.influencerProfile?.city && user?.influencerProfile?.categories && user?.influencerProfile?.categories !== "General")
      : Boolean(user?.brandProfile?.companyName && user?.brandProfile?.city);
  } catch (err) {
    logger.error("Failed to verify user onboarding status", err, { userId });
  }

  if (!isCompleted) {
    redirect("/onboarding");
  }

  let influencerData = null;
  let brandData = null;

  try {
    const data = await fetchAnalyticsData(userId, userType, fy);
    influencerData = data.influencerData;
    brandData = data.brandData;
  } catch (error) {
    logger.error("Analytics page critical error", error, { userId, userType });
  }

  const isBrandUser = isBrand(userType);
  const isInfluencerUser = isInfluencer(userType);

  return (
    <DashboardShell user={session.user}>
      <PageContainer maxWidth="7xl" className="space-y-6 sm:space-y-8 pb-12 py-4 sm:py-6">
        {/* Navigation Breadcrumb & Quick Actions Header */}
        <PageHeader
          breadcrumbs={
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Link href="/dashboard" className="hover:text-foreground transition-colors flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span className="text-foreground font-semibold">Analytics &amp; FY Reports</span>
            </div>
          }
          icon={
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <BarChart3 className="w-5 h-5" />
            </div>
          }
          title={isInfluencerUser ? "Performance & Financial Analytics" : "Campaign & Spend Analytics"}
          subtitle={
            isInfluencerUser
              ? "Track verified earnings, delivery metrics, trust score, and official Indian FY tax statements."
              : "Track campaign ROI, escrow expenditures, creator deliverables, and GST compliance reports."
          }
          actions={
            <Button
              href="/dashboard/wallet"
              variant="secondary"
              size="sm"
              className="flex items-center gap-1.5 text-xs font-semibold"
            >
              <Wallet className="w-3.5 h-3.5" />
              Wallet Ledger
            </Button>
          }
        />

        {/* Dynamic Analytics Client View */}
        {isInfluencerUser && influencerData && (
          <AnalyticsPageClient
            userType="INFLUENCER"
            initialData={influencerData}
            currentFY={fy}
          />
        )}

        {isBrandUser && brandData && (
          <AnalyticsPageClient
            userType="BRAND"
            initialData={brandData}
            currentFY={fy}
          />
        )}

        {!influencerData && !brandData && (
          <div className="text-center py-16 px-4 rounded-2xl border border-border bg-card shadow-sm max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4 text-2xl">
              📊
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Analytics Synchronizing</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Your performance records and financial history are syncing with the escrow ledger.
            </p>
            <Button href="/dashboard/analytics" variant="primary" size="sm">
              Refresh Analytics
            </Button>
          </div>
        )}
      </PageContainer>
    </DashboardShell>
  );
}
