"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isRouteAllowedForRole } from "@/config/navigation";

interface RoleGuardProps {
  userType?: string | null | undefined;
  children: React.ReactNode;
}

/**
 * Client-side UX route guard:
 * Prevents flashing role-incompatible views and immediately redirects to /dashboard.
 * Note: Edge Middleware enforces true cryptographic & session-level security on the server.
 */
export default function RoleGuard({
  userType,
  children,
}: Readonly<RoleGuardProps>) {
  const pathname = usePathname();
  const router = useRouter();

  const isAllowed = isRouteAllowedForRole(pathname, userType);

  useEffect(() => {
    if (!isAllowed) {
      router.replace("/dashboard");
    }
  }, [isAllowed, router]);

  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-muted-foreground font-medium">
          Redirecting to authorized dashboard...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
