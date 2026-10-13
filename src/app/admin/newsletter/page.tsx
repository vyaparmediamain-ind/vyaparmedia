import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Button, Input, Textarea, PageContainer, PageHeader } from "@/components/ui";
import {
  Mail,
  Users,
  CheckCircle2,
  Clock,
  Send,
  AlertTriangle,
  FileCode,
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
    <PageContainer maxWidth="4xl" className="space-y-6 py-2 sm:py-4">
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

      {/* Form Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border space-y-6">
        <form action="/api/admin/newsletter" method="POST" className="space-y-6">
          <div className="space-y-2">
            <Input
              type="text"
              id="subject"
              name="subject"
              label="Subject Line"
              required
              placeholder="e.g., New Guide: TDS & GST Compliance for Influencers"
              fullWidth
            />
          </div>

          <div className="space-y-2">
            <Textarea
              id="content"
              name="content"
              label="Newsletter Content (HTML supported)"
              required
              rows={12}
              className="text-sm font-mono resize-y"
              placeholder="<h1>Hello Creators,</h1><p>Here is your weekly roundup of brand deals and legal escrow insights...</p>"
              fullWidth
            />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <FileCode className="w-3.5 h-3.5" />
              <span>
                Tip: Standard HTML tags like &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;a&gt;, &lt;ul&gt;, and &lt;li&gt; are supported.
              </span>
            </div>
          </div>

          {/* Broadcast Confirmation / Warning Alert */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning-border text-foreground">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold text-warning block mb-0.5">
                Production Broadcast Notice
              </span>
              This action will dispatch transactional emails immediately to all{" "}
              <strong>{stats.verified}</strong> verified subscribers via Resend/SMTP. Please proofread thoroughly before broadcasting.
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full justify-center gap-2 font-black shadow-md"
            disabled={stats.verified === 0}
          >
            <Send className="w-4 h-4" />
            Broadcast Newsletter to {stats.verified} Subscribers
          </Button>
        </form>
      </div>
    </PageContainer>
  );
}
