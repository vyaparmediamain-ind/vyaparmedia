"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { SecurityProvider } from "@/components/security/SecurityProvider";
import { ErrorBoundary } from "@/components/security/ErrorBoundary";
import PWARegister from "@/components/pwa/PWARegister";
import OfflineIndicator from "@/components/pwa/OfflineIndicator";
import CustomInstallBanner from "@/components/pwa/CustomInstallBanner";
import { SWRConfig } from "swr";

export function Providers({
  children,
  nonce,
}: Readonly<{
  children: React.ReactNode;
  nonce?: string | undefined;
}>) {
  return (
    <SessionProvider
      basePath="/api/auth"
      refetchOnWindowFocus={false}
    >
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        {...(nonce ? { nonce } : {})}
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
              <OfflineIndicator />
              <CustomInstallBanner />
              {children}
            </SecurityProvider>
          </ErrorBoundary>
        </SWRConfig>
      </ThemeProvider>
    </SessionProvider>
  );
}
