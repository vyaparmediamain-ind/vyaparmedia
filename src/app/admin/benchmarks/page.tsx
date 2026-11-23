import { auth } from "@/lib/auth";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { MatchingService } from "@/services/matching.service";
import { PricingConfigService } from "@/services/pricing-config.service";
import CategoryBenchmarksClient from "./CategoryBenchmarksClient";
import { PageContainer, PageHeader } from "@/components/ui";
import { Target } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Fair Pricing & Category Benchmarks | VyaparMedia Admin",
  description: "Tune market Cost-Per-View (CPV) benchmarks, follower tier factors, add-on percentages, range widths, and reach-rate bands",
};

export default async function AdminBenchmarksPage() {
  const session = await auth();
  await requireActiveAdmin(session?.user);

  const [benchmarks, pricingConfig] = await Promise.all([
    MatchingService.getAllCategoryBenchmarks(),
    PricingConfigService.getActivePricingConfig(),
  ]);

  return (
    <PageContainer maxWidth="7xl" className="space-y-6 py-2 sm:py-4">
      <PageHeader
        backHref="/admin"
        backLabel="Admin Operations"
        icon={
          <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Target className="w-5 h-5" />
          </div>
        }
        title="Fair Pricing Engine & Category Benchmarks"
        subtitle="Manage cost baselines, tier factors, add-on percentages, range widths, and reach bands. Changes version-bump the valuation engine."
      />

      <CategoryBenchmarksClient
        initialBenchmarks={benchmarks}
        initialConfig={pricingConfig.config}
        initialVersion={pricingConfig.version}
        {...(pricingConfig.updatedAt ? { updatedAt: pricingConfig.updatedAt.toISOString() } : {})}
      />
    </PageContainer>
  );
}
