import { auth } from "@/lib/auth";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { MatchingService } from "@/services/matching.service";
import CategoryBenchmarksClient from "./CategoryBenchmarksClient";
import { PageContainer, PageHeader } from "@/components/ui";
import { Target } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Category CPV Benchmarks | VyaparMedia Admin",
  description: "Tune market Cost-Per-View (CPV) benchmarks for relative ROI matching across creator categories",
};

export default async function AdminBenchmarksPage() {
  const session = await auth();
  await requireActiveAdmin(session?.user);

  const benchmarks = await MatchingService.getAllCategoryBenchmarks();

  return (
    <PageContainer maxWidth="6xl" className="space-y-6 py-2 sm:py-4">
      <PageHeader
        backHref="/admin"
        backLabel="Admin Operations"
        icon={
          <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Target className="w-5 h-5" />
          </div>
        }
        title="Category CPV Benchmarks & Relative ROI"
        subtitle="Manage industry cost baselines. High-ticket niches (Finance, Tech) convert at higher CPVs than viral entertainment."
      />

      <CategoryBenchmarksClient initialBenchmarks={benchmarks} />
    </PageContainer>
  );
}
