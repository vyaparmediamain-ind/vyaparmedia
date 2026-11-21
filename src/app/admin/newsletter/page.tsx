import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { PageContainer, PageHeader } from "@/components/ui";
import NewsletterBroadcastForm from "@/components/admin/newsletter/NewsletterBroadcastForm";
import {
  Mail,
  Users,
  CheckCircle2,
  Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Send Newsletter | Admin",
  description: "Compose and broadcast newsletters to verified blog subscribers",
};

async function getSubscriberStats() {
  const total = await prisma.blogSubscriber.count();
  const verified = await prisma.blogSubscriber.count({ where: { verified: true } });
  const unverified = total - verified;
  return { total, verified, unverified };
}

export default async function AdminNewsletterPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const stats = await getSubscriberStats();

  return (
    <PageContainer maxWidth="7xl" className="space-y-6 py-2 sm:py-4">
      {/* Header */}
      <PageHeader
        icon={
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary" />
          </div>
        }
        title="Send Newsletter"
        subtitle="Compose and broadcast newsletters to verified VyaparMedia subscribers."
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Subscribers
            </span>
            <Users className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-3xl font-black text-foreground mt-2">
            {stats.total}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Registered reader base
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Verified Subscribers
            </span>
            <CheckCircle2 className="w-4 h-4 text-verified" />
          </div>
          <div className="text-3xl font-black text-verified mt-2">
            {stats.verified}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Active email recipients
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Pending Verification
            </span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div className="text-3xl font-black text-warning mt-2">
            {stats.unverified}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Awaiting email link click
          </div>
        </div>
      </div>

      {/* Interactive Broadcast Form */}
      <NewsletterBroadcastForm verifiedSubscribersCount={stats.verified} />
    </PageContainer>
  );
}
