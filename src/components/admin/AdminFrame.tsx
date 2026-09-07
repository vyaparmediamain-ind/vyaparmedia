"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import Logo from "@/components/Logo";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui";

type AdminFrameProps = {
children: ReactNode;
user: {
name?: string | null;
email?: string | null;
};
};

const navItems = [
{ icon: "OV", label: "Overview", href: "/admin" },
{ icon: "FN", label: "Financials", href: "/admin/financial" },
{ icon: "KY", label: "Verifications", href: "/admin/verifications" },
{ icon: "AP", label: "Applications", href: "/admin/applications" },
{ icon: "DR", label: "Disputes", href: "/admin/disputes" },
{ icon: "US", label: "Users", href: "/admin/users" },
{ icon: "PY", label: "Payouts", href: "/admin/payouts" },
{ icon: "AL", label: "Audit Logs", href: "/admin/audit-logs" },
{ icon: "VL", label: "Violations", href: "/admin/violations" },
{ icon: "NL", label: "Newsletter", href: "/admin/newsletter" },
];

function getInitials(name?: string | null, email?: string | null) {
const source = (name || email || "Admin").trim();
return (
source
.split(/\s+/)
.slice(0, 2)
.map((part) => part[0]?.toUpperCase())
.join("") || "A"
);
}

export default function AdminFrame({ children, user }: Readonly<AdminFrameProps>) {
const pathname = usePathname();
const [sidebarOpen, setSidebarOpen] = useState(false);

const closeSidebar = () => setSidebarOpen(false);

return (
<div className="admin-shell">
{sidebarOpen && (
<Button
type="button"
aria-label="Close admin navigation"
className="admin-sidebar-backdrop"
onClick={closeSidebar}
/>
)}

<aside className={`admin-sidebar ${sidebarOpen ? "is-open" : ""}`}>
<div className="admin-brand">
<Logo />
<div className="admin-role-pill">System Administrator</div>
</div>

<nav className="admin-nav" aria-label="Admin navigation">
{navItems.map((item) => {
const active =
item.href === "/admin"
? pathname === "/admin"
: pathname?.startsWith(item.href);

return (
<Link
key={item.href}
href={item.href}
className={`admin-nav-link ${active ? "is-active" : ""}`}
onClick={closeSidebar}
>
<span className="admin-nav-icon" aria-hidden="true">
{item.icon}
</span>
<span>{item.label}</span>
</Link>
);
})}
</nav>

<div className="admin-sidebar-footer">
<div className="admin-user-card">
<div className="admin-user-avatar">{getInitials(user.name, user.email)}</div>
<div className="admin-user-copy">
<div className="admin-user-name">{user.name || "Admin"}</div>
<div className="admin-user-email">{user.email || "Admin access"}</div>
</div>
</div>
<Button
onClick={() => signOut({ callbackUrl: "/login" })}
className="admin-logout-button"
>
<svg
width="16"
height="16"
viewBox="0 0 24 24"
fill="none"
stroke="currentColor"
strokeWidth="2"
strokeLinecap="round"
strokeLinejoin="round"
aria-hidden="true"
>
<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
<polyline points="16 17 21 12 16 7" />
<line x1="21" y1="12" x2="9" y2="12" />
</svg>
Logout
</Button>
</div>
</aside>

<div className="admin-main">
<header className="admin-topbar">
<Button
type="button"
className="admin-menu-button"
onClick={() => setSidebarOpen(true)}
aria-label="Open admin navigation"
>
Menu
</Button>
<div>
<div className="admin-topbar-title">Admin Console</div>
<div className="admin-topbar-subtitle">Live operations workspace</div>
</div>
</header>

<main className="admin-content">{children}</main>
</div>
</div>
);
}
