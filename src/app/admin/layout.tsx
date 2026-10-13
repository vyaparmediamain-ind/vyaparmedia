import React from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminFrame from "@/components/admin/AdminFrame";
import { requireActiveAdmin } from "@/lib/admin-auth";

export default async function AdminLayout({
children,
}: {
readonly children: React.ReactNode;
}) {
const session = await auth();

let adminEmail: string;
try {
const admin = await requireActiveAdmin(session?.user);
adminEmail = admin.email;
} catch {
redirect(session?.user ? "/dashboard" : "/login?callbackUrl=/admin");
}

return (
<AdminFrame
user={{
name: session?.user?.name ?? null,
email: adminEmail,
}}
>
{children}
</AdminFrame>
);
}
