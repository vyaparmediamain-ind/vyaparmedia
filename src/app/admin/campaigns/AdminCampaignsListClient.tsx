"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Layers,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertCircle,
  Briefcase,
} from "lucide-react";
import { PageContainer, PageHeader, Button, Input } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils-client";

interface CampaignItem {
  id: string;
  title: string;
  status: string;
  totalBudget: number;
  fundedAmount: number;
  postingDeadline: Date;
  createdAt: Date;
  brand: {
    id: string;
    companyName: string;
    user: {
      email: string;
    } | null;
  } | null;
  _count: {
    deals: number;
    applications: number;
  };
}

interface AdminCampaignsListClientProps {
  readonly initialCampaigns: CampaignItem[];
  readonly pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  readonly currentStatus: string;
  readonly currentSearch: string;
}

export default function AdminCampaignsListClient({
  initialCampaigns,
  pagination,
  currentStatus,
  currentSearch,
}: AdminCampaignsListClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);
  const [status, setStatus] = useState(currentStatus);

  const handleFilter = (newStatus: string) => {
    setStatus(newStatus);
    const params = new URLSearchParams();
    if (newStatus) params.set("status", newStatus);
    if (search.trim()) params.set("search", search.trim());
    params.set("page", "1");
    router.push(`/admin/campaigns?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    params.set("page", "1");
    router.push(`/admin/campaigns?${params.toString()}`);
  };

  const getStatusBadge = (st: string) => {
    switch (st.toUpperCase()) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-verified/15 text-verified border border-verified/30">
            <CheckCircle2 className="w-3 h-3" /> ACTIVE
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald/15 text-emerald border border-emerald/30">
            <CheckCircle2 className="w-3 h-3" /> COMPLETED
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
            <Clock className="w-3 h-3" /> DRAFT
          </span>
        );
      case "PAUSED":
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
            <ShieldAlert className="w-3 h-3" /> {st}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30">
            <AlertCircle className="w-3 h-3" /> {st}
          </span>
        );
    }
  };

  return (
    <PageContainer maxWidth="7xl" className="space-y-6 py-4">
      <PageHeader
        icon={
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-primary" />
          </div>
        }
        title="Campaign Governance & Operations"
        subtitle="Platform-wide campaign monitoring, escrow funding health, and risk audit."
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns by title or brand..."
            className="pl-9 text-xs"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {["", "ACTIVE", "COMPLETED", "DRAFT", "PAUSED"].map((st) => (
            <Button
              key={st || "all"}
              variant={status === st ? "primary" : "secondary"}
              size="sm"
              onClick={() => handleFilter(st)}
              className="text-xs capitalize"
            >
              {st ? st.toLowerCase() : "All Status"}
            </Button>
          ))}
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-3 px-4">Campaign & Brand</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Total Budget</th>
                <th className="py-3 px-4 text-right">Escrow Funded</th>
                <th className="py-3 px-4 text-center">Deals / Apps</th>
                <th className="py-3 px-4">Deadline</th>
                <th className="py-3 px-4 text-right">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {initialCampaigns.length > 0 ? (
                initialCampaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3.5 px-4 min-w-[200px]">
                      <div className="font-bold text-foreground truncate max-w-[240px]">{c.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {c.brand?.companyName || "Unknown Brand"} {c.brand?.user?.email ? `(${c.brand.user.email})` : ""}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(c.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-foreground">
                      {formatCurrency(c.totalBudget)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-verified font-semibold">
                      {formatCurrency(c.fundedAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono tabular-nums text-muted-foreground">
                      <span className="font-bold text-foreground">{c._count.deals}</span> / {c._count.applications}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                      {formatDate(c.postingDeadline)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/campaigns/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        <span>Audit</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-sm">No campaigns match the filter</p>
                    <p className="text-xs text-muted-foreground mt-1">Try clearing your search query or status filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border text-xs text-muted-foreground">
            <div>
              Showing page <span className="font-bold text-foreground">{pagination.page}</span> of{" "}
              <span className="font-bold text-foreground">{pagination.totalPages}</span> ({pagination.total} total)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => {
                  const params = new URLSearchParams();
                  if (status) params.set("status", status);
                  if (search.trim()) params.set("search", search.trim());
                  params.set("page", String(pagination.page - 1));
                  router.push(`/admin/campaigns?${params.toString()}`);
                }}
                className="gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => {
                  const params = new URLSearchParams();
                  if (status) params.set("status", status);
                  if (search.trim()) params.set("search", search.trim());
                  params.set("page", String(pagination.page + 1));
                  router.push(`/admin/campaigns?${params.toString()}`);
                }}
                className="gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
