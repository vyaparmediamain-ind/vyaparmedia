"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import EmptyState from "@/components/ui/EmptyState";
import { Button } from "@/components/ui";
import { useState, useMemo } from "react";

interface LoginActivity {
device: string;
location: string;
time: string;
success: boolean;
active?: boolean;
}

interface LoginActivityPanelProps {
showToast: (message: string, type?: "success" | "error" | "info") => void;
}

interface ActivityResponse {
activity?: LoginActivity[];
}

export default function LoginActivityPanel({ showToast: _showToast }: Readonly<LoginActivityPanelProps>) {
const [showAllLogins, setShowAllLogins] = useState(false);

const { data } = useSWR<ActivityResponse>("/api/user/activity", fetcher);

const loginActivity = useMemo(() => {
if (!data?.activity) return [];
const uniqueDevices = new Map<string, LoginActivity>();
data.activity.forEach((login: LoginActivity) => {
if (!uniqueDevices.has(login.device)) {
uniqueDevices.set(login.device, login);
}
});
return Array.from(uniqueDevices.values());
}, [data]);

const visibleLogins = showAllLogins ? loginActivity : loginActivity.slice(0, 3);

return (
<div className="card">
<div className="flex justify-between items-center mb-4">
<h2 className="text-lg font-bold">
Recent Login Activity
</h2>
{loginActivity.length > 3 && (
<span className="text-xs text-muted">
{loginActivity.length} total sessions
</span>
)}
</div>
<div
className="flex flex-col gap-3"
>
{loginActivity.length === 0 ? (
<EmptyState emoji="" title="No Login Activity" description="No recent login sessions found." compact />
) : (
visibleLogins.map((login) => (
<div
key={`${login.device}-${login.time}`}
className={`flex justify-between items-center p-3 bg-tertiary rounded-sm ${login.active ? "border-active-login" : "border-inactive-login"}`}
>
<div
className="flex items-center gap-3"
>
<div className="text-xl flex items-center justify-center">
{login.device.includes("Android") ||
login.device.includes("iPhone") ? (
<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-blue-500">
<rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
<path d="M12 18h.01" />
</svg>
) : (
<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-blue-500">
<rect width="18" height="12" x="3" y="4" rx="2" ry="2" />
<line x1="2" y1="20" x2="22" y2="20" />
<line x1="12" y1="16" x2="12" y2="20" />
</svg>
)}
</div>
<div>
<div className="text-sm font-semibold">
{login.device}{" "}
<span
className="font-normal text-muted"
>
 {login.location}
</span>
</div>
<div
className={`text-xs ${login.success ? "text-secondary" : "text-rose"}`}
>
{new Date(login.time).toLocaleString()}{" "}
{login.success ? "" : "(Failed Attempt)"}
</div>
</div>
</div>
{login.active && (
<div
className="font-bold text-emerald bg-emerald-subtle rounded-sm text-2xs px-2 py-0.5"
>
ACTIVE
</div>
)}
</div>
))
)}
</div>
{loginActivity.length > 3 && (
<Button
variant="secondary"
onClick={() => setShowAllLogins(!showAllLogins)}
className="flex items-center justify-center w-full mt-3 text-sm font-semibold cursor-pointer bg-tertiary border-card rounded-sm text-primary-light gap-1.5 login-activity-btn-more"
>
{showAllLogins ? "▲ Show Less" : `▼ View All (${loginActivity.length})`}
</Button>
)}
</div>
);
}
