import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import DashboardShell from "@/components/dashboard/DashboardShell";
import AdminAnalyticsView from "@/components/analytics/AdminAnalyticsView";
import {
  getInfluencerAnalytics,
  getBrandAnalytics,
} from "@/lib/analytics-engine";
import { logger } from "@/lib/logger";
import { isAdmin as rbacIsAdmin, isBrand, isInfluencer } from "@/lib/rbac";
import { Button, PageContainer, PageHeader } from "@/components/ui";
import DashboardHomeClient from "@/components/dashboard/home/DashboardHomeClient";
import prisma from "@/lib/db";
import { cache } from "@/lib/cache";

export const dynamic = "force-dynamic";

async function fetchDashboardData(userId: string, userType: string, fy?: string) {
  let influencerData = null;
  let brandData = null;

  if (isInfluencer(userType)) {
    try {
      influencerData = await getInfluencerAnalytics(userId, fy);
    } catch (error) {
      logger.error("Influencer analytics fetch failed", error, { userId });
    }
  } else if (isBrand(userType)) {
    try {
      brandData = await getBrandAnalytics(userId, fy);
    } catch (error) {
      logger.error("Brand analytics fetch failed", error, { userId });
    }
  }

  return { influencerData, brandData };
}

function DashboardErrorFallback({ user }: Readonly<{ user: Session["user"] }>) {
  return (
    <DashboardShell user={user}>
      <PageContainer maxWidth="7xl" className="py-4 sm:py-6">
        <div className="text-center rounded-2xl max-w-lg mx-auto p-8 border border-disputed-border bg-card mt-12 shadow-sm">
          <div className="mb-4 text-3xl" aria-hidden="true">
            ⚠️
          </div>
          <h2 className="text-2xl mb-2 font-extrabold text-foreground">
            Workspace Connection Interrupted
          </h2>
          <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
            The dashboard could not load the latest collaboration feed. Please refresh or try again.
          </p>
          <Button
            href="/dashboard"
            variant="danger"
            aria-label="Reload dashboard"
            className="w-full sm:w-auto"
          >
            Reload Dashboard
          </Button>
        </div>
      </PageContainer>
    </DashboardShell>
  );
}

function DashboardEmptyState({ dataLoadFailed }: Readonly<{ dataLoadFailed: boolean }>) {
  return (
    <div className="text-center py-12">
      <div className="max-w-md mx-auto p-8 rounded-2xl border border-border bg-card shadow-sm">
        <div className="mb-4 text-3xl" aria-hidden="true">
          {dataLoadFailed ? "⚠️" : "⚡"}
        </div>
        <h2 className="mb-2 text-2xl font-extrabold text-foreground">
          {dataLoadFailed ? "Access Interrupted" : "Setting Up Workspace"}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
          {dataLoadFailed
            ? "We could not load your dashboard feed. Please refresh or try again after a moment."
            : "We are syncing your active campaigns, escrow balances, and collaboration milestones."}
        </p>
        <Button
          href="/dashboard"
          variant="primary"
          size="md"
          aria-label={dataLoadFailed ? "Retry dashboard data load" : "Refresh dashboard data"}
        >
          {dataLoadFailed ? "Retry" : "Refresh"}
        </Button>
      </div>
    </div>
  );
}

export default async function DashboardPage({
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
    redirect("/admin");
  }

  // Guard: Newly registered users must complete onboarding before entering the dashboard
  let isCompleted = true;
  try {
    const user = await cache(
      `user:onboarding:${userId}`,
      () =>
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            userType: true,
            influencerProfile: { select: { city: true, categories: true } },
            brandProfile: { select: { companyName: true, city: true } },
          },
        }),
      300,
    );

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
  const adminData = null;

  try {
    const data = await fetchDashboardData(userId, userType, fy);
    influencerData = data.influencerData;
    brandData = data.brandData;
  } catch (error) {
    logger.error("Dashboard critical error", error, { userId, userType });
    return <DashboardErrorFallback user={session.user} />;
  }

  const dataLoadFailed = !adminData && !influencerData && !brandData;

  const renderDashboardContent = () => {
    if (isAdmin && adminData) {
      return (
        <div className="space-y-8">
          <PageHeader
            title="Admin Ops Center"
            subtitle="Platform health, financial operations, and ecosystem monitoring."
          />
          <AdminAnalyticsView data={adminData} />
        </div>
      );
    }

    if ((isInfluencer(userType) && influencerData) || (isBrand(userType) && brandData)) {
      return (
        <DashboardHomeClient
          user={session.user}
          influencerData={influencerData}
          brandData={brandData}
          currentFY={fy || undefined}
        />
      );
    }

    return <DashboardEmptyState dataLoadFailed={dataLoadFailed} />;
  };

  return (
    <DashboardShell user={session.user}>
      <PageContainer maxWidth="7xl" className="py-4 sm:py-6">
        {renderDashboardContent()}
      </PageContainer>
    </DashboardShell>
  );
}
