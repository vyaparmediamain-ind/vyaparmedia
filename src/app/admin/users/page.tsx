"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { banUser, unbanUser, awardBadgeAction } from "../actions";
import Image from "next/image";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button, Input, Select } from "@/components/ui";
import type { AdminService } from "@/services/admin.service";
import type { Prisma } from "@prisma/client";

type AdminUserListElement = Prisma.PromiseReturnType<typeof AdminService.listUsers>["users"][number];
type ListUsersResult = {
success: boolean;
data: {
users: AdminUserListElement[];
total: number;
};
};

interface TaxComplianceUser {
userType: string;
taxCompliance?: {
panLast4?: string | null;
eInvoiceApplicable?: boolean | null;
status?: string | null;
gstinLast4?: string | null;
} | null;
}

function taxStatusLabel(user: TaxComplianceUser) {
if (user.userType === "ADMIN") return "Not applicable";
const tax = user.taxCompliance;
if (!tax?.panLast4) return "PAN missing";
if (user.userType === "BRAND" && tax.eInvoiceApplicable) return "E-invoice";
if (tax.status === "READY") return "Ready";
return tax.status ? tax.status.toLowerCase().replaceAll("_", " ") : "Pending";
}

function taxStatusTone(user: TaxComplianceUser) {
if (user.userType === "ADMIN") return "muted";
const tax = user.taxCompliance;
if (!tax?.panLast4) return "danger";
if (tax.status === "READY") return "success";
return "warning";
}

interface UserRowProps {
readonly user: AdminUserListElement;
readonly onBan: (id: string) => void;
readonly onUnban: (id: string) => void;
readonly onAwardBadge: (e: React.FormEvent<HTMLFormElement>, id: string) => void;
readonly isActionLoading?: boolean;
}

function UserRow({ user, onBan, onUnban, onAwardBadge, isActionLoading }: UserRowProps) {
const name =
user.influencerProfile?.displayName ||
user.brandProfile?.companyName ||
(user.userType === "ADMIN"
? user.email?.split("@")[0]
: null) ||
"Unknown user";
const avatar = user.influencerProfile?.avatar || user.brandProfile?.logo;
const isBanned = user.status === "BANNED";

const getStatusVariant = (status: string) => {
if (status === "ACTIVE") return "success";
if (status === "BANNED" || status === "SUSPENDED") return "danger";
if (status === "FLAGGED") return "warning";
return "ghost";
};

const getTaxVariant = (user: TaxComplianceUser) => {
const tone = taxStatusTone(user);
if (tone === "success") return "success";
if (tone === "danger") return "danger";
return "warning";
};

return (
<tr className="border-b border-card">
<td className="p-card">
<div className="flex items-center gap-3">
<div
className="admin-user-avatar flex items-center justify-center relative overflow-hidden rounded-full font-extrabold bg-gradient-primary text-white"
>
{avatar ? (
<Image
src={avatar}
alt=""
fill
unoptimized
className="object-cover"
/>
) : (
name.charAt(0).toUpperCase()
)}
</div>
<div className="min-w-0">
<div className="font-extrabold">{name}</div>
<div className="text-muted text-xs">
{user.email}
</div>
{user.badges && user.badges.length > 0 && (
  <div className="flex gap-1 flex-wrap mt-1.5">
    {user.badges.map((b: { badgeId: string }) => (
      <span key={b.badgeId} className="text-[10px] bg-tertiary px-1.5 py-0.5 rounded text-secondary font-semibold capitalize">
        🏆 {b.badgeId.replaceAll("_", " ")}
      </span>
    ))}
  </div>
)}
</div>
</div>
</td>
<td className="p-card">
<Badge variant="primary">{user.userType}</Badge>
</td>
<td className="p-card">
<Badge variant={getStatusVariant(user.status)}>
{user.status.toLowerCase().replaceAll("_", " ")}
</Badge>
</td>
<td className="p-card">
<Badge variant={getTaxVariant(user)}>
{taxStatusLabel(user)}
</Badge>
{user.taxCompliance?.gstinLast4 && (
<div className="text-muted mt-1 text-xs">
GST ****{user.taxCompliance.gstinLast4}
</div>
)}
</td>
<td className="p-card text-center font-extrabold">
{user.trustScore}
<span className="text-muted text-xs">
/900
</span>
</td>
<td className="p-card text-muted text-sm">
{new Date(user.createdAt).toLocaleDateString("en-IN")}
</td>
<td className="p-card text-right">
<div className="flex justify-end items-center gap-2">
{user.userType !== "ADMIN" && (
<form onSubmit={(e) => onAwardBadge(e, user.id)} className="inline-flex gap-1">
<input type="hidden" name="userId" value={user.id} />
<Select
name="badgeId"
className="admin-award-select text-xs px-2 py-0.5 h-30"
defaultValue=""
required
disabled={Boolean(isActionLoading)}
>
<option value="" disabled>Award Badge...</option>
<option value="beta_tester" disabled={user.badges?.some((b: { badgeId: string }) => b.badgeId === "beta_tester")}>
  Beta Tester {user.badges?.some((b: { badgeId: string }) => b.badgeId === "beta_tester") ? " (Already Has)" : ""}
</option>
<option value="mystery_badge" disabled={user.badges?.some((b: { badgeId: string }) => b.badgeId === "mystery_badge")}>
  Mystery Badge {user.badges?.some((b: { badgeId: string }) => b.badgeId === "mystery_badge") ? " (Already Has)" : ""}
</option>
<option value="bug_reporter" disabled={user.badges?.some((b: { badgeId: string }) => b.badgeId === "bug_reporter")}>
  Bug Hunter {user.badges?.some((b: { badgeId: string }) => b.badgeId === "bug_reporter") ? " (Already Has)" : ""}
</option>
<option value="feedback_giver" disabled={user.badges?.some((b: { badgeId: string }) => b.badgeId === "feedback_giver")}>
  Idea Generator {user.badges?.some((b: { badgeId: string }) => b.badgeId === "feedback_giver") ? " (Already Has)" : ""}
</option>
</Select>
<Button
variant="primary"
size="sm"
type="submit"
className="admin-grant-btn h-30"
disabled={Boolean(isActionLoading)}
>
Grant
</Button>
</form>
)}
{user.userType !== "ADMIN" && (
<>
{user.status === "FLAGGED" && (
<Button
variant="success"
size="sm"
onClick={() => onUnban(user.id)}
className="h-30"
disabled={Boolean(isActionLoading)}
>
Approve (Activate)
</Button>
)}
{isBanned ? (
<Button
variant="secondary"
size="sm"
onClick={() => onUnban(user.id)}
className="h-30"
disabled={Boolean(isActionLoading)}
>
Unban
</Button>
) : (
<Button
variant="danger"
size="sm"
onClick={() => onBan(user.id)}
className="h-30"
disabled={Boolean(isActionLoading)}
>
Ban
</Button>
)}
</>
)}
</div>
</td>
</tr>
);
}

export default function AdminUsersPage() {
const [search, setSearch] = useState("");
const [type, setType] = useState("ALL");
const [status, setStatus] = useState("ALL");
const [page, setPage] = useState(1);
const [loadingAction, setLoadingAction] = useState<string | null>(null);
const limit = 50;

const queryParams = new URLSearchParams();
queryParams.set("page", String(page));
queryParams.set("limit", String(limit));
if (search.trim()) queryParams.set("search", search.trim());
if (type !== "ALL") queryParams.set("type", type);
if (status !== "ALL") queryParams.set("status", status);

const { data, error, isLoading, mutate } = useSWR<ListUsersResult>(
`/api/admin/users?${queryParams.toString()}`,
fetcher
);

const users = data?.data?.users || [];
const total = data?.data?.total || 0;
const totalPages = Math.max(1, Math.ceil(total / (limit || 1)));

const handleBan = async (userId: string) => {
if (!confirm("Are you sure you want to ban this user?")) return;
setLoadingAction(userId);
try {
await banUser(userId);
mutate();
} catch (err) {
alert(err instanceof Error ? err.message : "Failed to ban user");
} finally {
setLoadingAction(null);
}
};

const handleUnban = async (userId: string) => {
setLoadingAction(userId);
try {
await unbanUser(userId);
mutate();
} catch (err) {
alert(err instanceof Error ? err.message : "Failed to unban user");
} finally {
setLoadingAction(null);
}
};

const handleAwardBadge = async (e: React.FormEvent<HTMLFormElement>, userId: string) => {
e.preventDefault();
const formData = new FormData(e.currentTarget);
setLoadingAction(userId);
try {
await awardBadgeAction(formData);
alert("Badge awarded successfully!");
mutate();
} catch (err) {
alert(err instanceof Error ? err.message : "Failed to award badge");
} finally {
setLoadingAction(null);
}
};

let content;
if (isLoading) {
content = (
<div className="flex justify-center p-12">
<span className="loading w-16 h-16" />
</div>
);
} else if (error) {
content = (
<div className="text-center text-rose p-6">Failed to load users.</div>
);
} else if (users.length === 0) {
content = (
<EmptyState
emoji=""
title="No Users Found"
description="Try changing the search query or status filters."
/>
);
} else {
content = (
<div className="admin-table-wrap overflow-x-auto w-full">
<table className="admin-users-table w-full border-collapse" aria-label="Platform users">
<thead>
<tr className="bg-secondary">
{["User", "Role", "Status", "Tax", "Trust", "Joined", "Action"].map(
(heading) => (
<th
key={heading}
scope="col"
className="admin-users-th border-b border-card text-muted text-xs font-extrabold uppercase"
>
{heading}
</th>
)
)}
</tr>
</thead>
<tbody>
{(users ?? []).map((user: AdminUserListElement) => (
<UserRow
key={user.id}
user={user}
isActionLoading={loadingAction === user.id}
onBan={handleBan}
onUnban={handleUnban}
onAwardBadge={handleAwardBadge}
/>
))}
</tbody>
</table>
</div>
);
}

return (
<div className="admin-page">
<div className="admin-toolbar">
<div>
<h1 className="text-3xl font-extrabold mb-1">
User Management
</h1>
<p className="text-secondary text-sm">
Search, review, ban, and reactivate platform accounts.
</p>
</div>
<div className="card px-4 py-3 min-w-180">
<div className="text-muted text-xs">
Matching users
</div>
<div className="font-extrabold text-2xl">{total}</div>
</div>
</div>

<div className="card admin-filter-row p-3.5 mb-4 flex flex-wrap gap-3">
<Input
name="search"
placeholder="Search name, email, or phone"
value={search}
onChange={(e) => {
setSearch(e.target.value);
setPage(1);
}}
className="admin-user-search flex-1 min-w-200"
/>
<Select
name="type"
value={type}
onChange={(e) => {
setType(e.target.value);
setPage(1);
}}
className="w-180"
>
<option value="ALL">All roles</option>
<option value="INFLUENCER">Influencers</option>
<option value="BRAND">Brands</option>
</Select>
<Select
name="status"
value={status}
onChange={(e) => {
setStatus(e.target.value);
setPage(1);
}}
className="admin-status-select w-180"
>
<option value="ALL">All statuses</option>
<option value="ACTIVE">Active</option>
<option value="PENDING_VERIFICATION">Pending verification</option>
<option value="SUSPENDED">Suspended</option>
<option value="BANNED">Banned</option>
<option value="FLAGGED">Flagged</option>
</Select>
</div>

<div className="card overflow-hidden p-0">
{content}
</div>

<div className="flex justify-between items-center mt-4 text-muted text-sm">
<div className="flex gap-2">
<Button
onClick={() => setPage((p) => Math.max(1, p - 1))}
variant="secondary"
size="sm"
aria-label="Previous page"
aria-disabled={page <= 1}
disabled={page <= 1}
>
Previous
</Button>
<Button
onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
variant="secondary"
size="sm"
aria-label="Next page"
aria-disabled={page >= totalPages}
disabled={page >= totalPages}
>
Next
</Button>
</div>
<span>
Page {page} of {totalPages} &bull; Showing {users.length} of {total}
</span>
</div>
</div>
);
}
