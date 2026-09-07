"use client";

import { SessionProvider } from "next-auth/react";
import { SecurityProvider } from "@/components/security/SecurityProvider";
import { ErrorBoundary } from "@/components/security/ErrorBoundary";
import PWARegister from "@/components/pwa/PWARegister";
import { SWRConfig } from "swr";

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
return (
<SessionProvider
basePath="/api/auth"
refetchOnWindowFocus={false}
>
<SWRConfig
value={{
revalidateOnFocus: false,
dedupingInterval: 5000,
}}
>
<ErrorBoundary componentName="RootLayout">
<SecurityProvider>
<PWARegister />
{children}
</SecurityProvider>
</ErrorBoundary>
</SWRConfig>
</SessionProvider>
);
}
