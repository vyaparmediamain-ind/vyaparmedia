"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { Button, Input, Select, Textarea, PageContainer, PageHeader } from "@/components/ui";
import { createSupportSchema } from "@/lib/validations/campaign";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import Link from "next/link";
import {
  Bug,
  MessageSquareDiff,
  Camera,
  Trophy,
  X,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  Banknote,
} from "lucide-react";

/* ── Quick-help category cards ───────────────────────────────────────────── */
const HELP_CATEGORIES = [
  {
    id: "bug",
    icon: <Bug className="w-5 h-5 text-disputed" />,
    bg: "bg-disputed-muted border-disputed-border",
    title: "Report a Bug",
    desc: "Something broken? Tell us and get rewarded with a badge.",
    action: "BUG",
  },
  {
    id: "payment",
    icon: <Banknote className="w-5 h-5 text-escrow" />,
    bg: "bg-escrow-muted border-escrow-border",
    title: "Billing & Escrow",
    desc: "Questions about payments, withdrawals, or escrow holds.",
    action: "FEEDBACK",
  },
  {
    id: "dispute",
    icon: <ShieldCheck className="w-5 h-5 text-verified" />,
    bg: "bg-verified-muted border-verified-border",
    title: "Dispute Help",
    desc: "Already opened a dispute? Visit the Resolution Center.",
    href: "/dashboard/disputes",
  },
  {
    id: "faq",
    icon: <HelpCircle className="w-5 h-5 text-pending" />,
    bg: "bg-pending-muted border-pending-border",
    title: "FAQ & Help Center",
    desc: "Browse categorized articles and quick answers.",
    href: "/help",
  },
] as const;

/* ── Main Page ────────────────────────────────────────────────────────────── */

export default function SupportPage() {
  const { data: session } = useSession();
  const [type, setType] = useState<"BUG" | "FEEDBACK">("FEEDBACK");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [badgeAwarded, setBadgeAwarded] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingScreenshot(true);
    setErrorMsg("");
    setStatusMsg("");

    try {
      const data = await apiClient.upload.file(file, "feedback");
      setScreenshotUrl(data.data?.url || data.url || "");
    } catch (err: unknown) {
      setErrorMsg(formatUserError(err, "Screenshot upload failed. Please try again."));
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg("");
    setErrorMsg("");
    setBadgeAwarded(null);

    const validation = createSupportSchema.safeParse({
      type,
      title: title.trim(),
      description: description.trim(),
      screenshotUrl: screenshotUrl || undefined,
    });

    if (!validation.success) {
      setErrorMsg(validation.error.issues[0]?.message || "Invalid input details.");
      return;
    }

    setLoading(true);
    try {
      const data = (await apiClient.users.submitFeedback({
        type,
        title,
        description,
        screenshotUrl: screenshotUrl || undefined,
      })) as { message?: string; data?: { badgeAwarded?: string } };

      setStatusMsg(data?.message || "Submitted successfully. Thank you for your feedback!");
      setTitle("");
      setDescription("");
      setScreenshotUrl("");
      if (data?.data?.badgeAwarded) {
        setBadgeAwarded(data.data.badgeAwarded);
      }
    } catch (err: unknown) {
      setErrorMsg(formatUserError(err, "Failed to submit feedback. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell user={session?.user}>
      <PageContainer maxWidth="3xl" className="space-y-6 pb-12 py-4 sm:py-6">

        {/* ── Page Header ── */}
        <PageHeader
          title="Support & Feedback Hub"
          icon={
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <MessageSquareDiff className="w-5 h-5 text-primary" />
            </div>
          }
          subtitle="Submit bug reports or platform feedback — verified submissions earn badges!"
          border={false}
        />

        {/* ── Quick Help Category Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {HELP_CATEGORIES.map((cat) => {
            const inner = (
              <div
                className={`group flex items-start gap-3 p-4 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 ${cat.bg}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-card/60`}>
                  {cat.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{cat.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                    {cat.desc}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            );

            if ("href" in cat) {
              return (
                <Link key={cat.id} href={cat.href}>
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={cat.id}
                type="button"
                className="text-left w-full"
                onClick={() => setType(cat.action)}
              >
                {inner}
              </button>
            );
          })}
        </div>

        {/* ── Submission Form ── */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          {/* Form header */}
          <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center gap-2">
            <MessageSquareDiff className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Submit a Report</span>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {/* Type selector */}
            <Select
              id="type"
              label="Submission Type"
              value={type}
              onChange={(e) => setType(e.target.value as "BUG" | "FEEDBACK")}
              fullWidth
            >
              <option value="FEEDBACK">Give Platform Feedback</option>
              <option value="BUG">Report a Bug</option>
            </Select>

            {/* Title */}
            <Input
              type="text"
              id="title"
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "BUG"
                  ? "e.g., OTP login verification fails on step 2"
                  : "e.g., Feature request for YouTube analytics graphs"
              }
              required
              fullWidth
            />

            {/* Description */}
            <Textarea
              id="description"
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                type === "BUG"
                  ? "Describe the issue, steps to reproduce, and what you expected to happen..."
                  : "Share your ideas, suggestions, or comments about the platform experience..."
              }
              required
              rows={5}
              fullWidth
            />

            {/* Screenshot upload */}
            <div>
              <label htmlFor="screenshot-file-input" className="block text-sm font-semibold text-foreground mb-2">
                Screenshot{" "}
                <span className="text-muted-foreground font-normal">(Optional)</span>
              </label>

              {screenshotUrl ? (
                <div className="flex items-center gap-3 p-3 bg-verified-muted border border-verified-border rounded-xl">
                  <Image
                    src={screenshotUrl}
                    alt="Uploaded screenshot"
                    width={48}
                    height={48}
                    unoptimized
                    className="object-cover rounded-lg"
                  />
                  <div className="flex-1 min-w-0 text-sm text-foreground font-medium">
                    Screenshot uploaded
                  </div>
                  <Button
                    type="button"
                    aria-label="Remove uploaded screenshot"
                    onClick={() => setScreenshotUrl("")}
                    variant="ghost"
                    size="sm"
                    className="text-disputed hover:text-disputed gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Remove
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  aria-label="Upload screenshot for your report"
                  disabled={uploadingScreenshot}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border bg-muted/20 text-muted-foreground text-sm font-medium hover:bg-muted/40 hover:border-primary/40 hover:text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera className="w-4 h-4" />
                  {uploadingScreenshot ? "Uploading screenshot..." : "Upload Screenshot (Max 5MB)"}
                </button>
              )}

              <Input
                type="file"
                id="screenshot-file-input"
                ref={fileInputRef}
                onChange={handleScreenshotUpload}
                accept="image/png, image/jpeg, image/webp, image/gif"
                className="hidden"
              />
            </div>

            {/* Error message */}
            {errorMsg && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2 p-3 rounded-xl bg-disputed-muted border border-disputed-border text-disputed text-sm"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {errorMsg}
              </div>
            )}

            {/* Success message */}
            {statusMsg && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-start gap-2 p-3 rounded-xl bg-verified-muted border border-verified-border text-verified text-sm"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                {statusMsg}
              </div>
            )}

            {/* Badge awarded celebration */}
            {badgeAwarded && (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-pending-muted border border-pending-border">
                <Trophy className="w-8 h-8 text-pending shrink-0" />
                <div>
                  <h4 className="text-sm font-extrabold text-pending">New Badge Earned! 🎉</h4>
                  <p className="text-xs text-foreground mt-0.5">
                    You earned the{" "}
                    <strong>
                      {badgeAwarded === "bug_reporter" ? "Bug Reporter" : "Feedback Giver"}
                    </strong>{" "}
                    badge! Check it in your{" "}
                    <Link href="/dashboard/badges" className="text-primary underline underline-offset-2">
                      Badges tab
                    </Link>
                    .
                  </p>
                </div>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading || uploadingScreenshot}
              variant="primary"
              className="w-full justify-center font-bold"
            >
              {loading ? "Submitting..." : "Submit to Support"}
            </Button>
          </form>
        </div>
      </PageContainer>
    </DashboardShell>
  );
}
