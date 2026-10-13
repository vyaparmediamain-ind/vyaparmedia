"use client";

import { Suspense } from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { useMessages } from "@/components/dashboard/messages/useMessages";
import { ConversationsSidebar } from "@/components/dashboard/messages/ConversationsSidebar";
import { ChatPanel, ReportUserModal } from "@/components/dashboard/messages/ChatPanel";
import { ToastContainer, PageContainer, PageHeader } from "@/components/ui";

function MessagesSkeleton() {
  return (
    <div
      className="flex overflow-hidden bg-card border border-border rounded-2xl shadow-sm h-[82vh] min-h-[560px] animate-pulse"
      aria-hidden="true"
    >
      {/* Sidebar Skeleton */}
      <div className="w-full sm:w-80 border-r border-border p-4 space-y-4 shrink-0 bg-card">
        <div className="h-9 w-full bg-muted rounded-xl" />
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <div className="w-11 h-11 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-3/5 bg-muted rounded" />
                <div className="h-3 w-4/5 bg-muted/60 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area Skeleton */}
      <div className="hidden sm:flex flex-1 flex-col p-4 justify-between bg-card/60">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
          <div className="space-y-1.5">
            <div className="h-4 w-36 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted/60 rounded" />
          </div>
        </div>

        <div className="space-y-4 py-6 px-2">
          <div className="flex gap-2.5 max-w-sm">
            <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
            <div className="h-12 w-60 bg-muted/80 rounded-2xl" />
          </div>
          <div className="flex justify-end">
            <div className="h-10 w-52 bg-primary/20 rounded-2xl" />
          </div>
          <div className="flex gap-2.5 max-w-sm">
            <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
            <div className="h-14 w-72 bg-muted/80 rounded-2xl" />
          </div>
        </div>

        <div className="pt-3 border-t border-border">
          <div className="h-11 rounded-xl bg-muted/60 w-full" />
        </div>
      </div>
    </div>
  );
}

function MessagesContent() {
  const state = useMessages();
  const { status, session, toasts, removeToast } = state;

  if (status === "loading" || !session) {
    return (
      <DashboardShell user={session?.user}>
        <PageContainer maxWidth="7xl" className="py-4 sm:py-6">
          <MessagesSkeleton />
        </PageContainer>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={session.user}>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <PageContainer maxWidth="7xl" className="py-4 sm:py-6 space-y-4">
        <PageHeader
          title="Direct Messages"
          subtitle="Collaborate in real-time, negotiate campaign contracts, and share deliverable links securely."
          border={false}
          className="pb-0"
        />
        <div className="flex overflow-hidden bg-card border border-border rounded-2xl shadow-sm h-[78vh] min-h-[540px]">
          <ConversationsSidebar state={state} />
          <ChatPanel state={state} />
        </div>
      </PageContainer>
      <ReportUserModal state={state} />
    </DashboardShell>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <PageContainer maxWidth="7xl" className="py-4 sm:py-6">
            <MessagesSkeleton />
          </PageContainer>
        </DashboardShell>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}
