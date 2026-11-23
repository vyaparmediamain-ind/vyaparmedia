import React, { type ReactElement } from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { SWRConfig, type SWRConfiguration } from "swr";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

export interface ProviderRenderOptions extends Omit<RenderOptions, "wrapper"> {
  session?: (Session | null) | undefined;
  swrConfig?: SWRConfiguration | undefined;
}

const mockDefaultSession: Session = {
  user: {
    id: "usr_default_test",
    email: "test@example.com",
    name: "Test User",
    userType: "BRAND",
    status: "ACTIVE",
    verificationLevel: "TIER_2",
    trustScore: 800,
    xp: 1000,
    level: 2,
  } as any,
  expires: new Date(Date.now() + 86400000).toISOString(),
};

/**
 * Test wrapper providing SWR cache isolation and clean provider context for component tests.
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: ProviderRenderOptions,
): RenderResult {
  const { swrConfig, session = mockDefaultSession, ...renderOptions } = options ?? {};

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <SessionProvider session={session}>
        <SWRConfig
          value={{
            provider: () => new Map(),
            dedupingInterval: 0,
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            shouldRetryOnError: false,
            ...swrConfig,
          }}
        >
          {children}
        </SWRConfig>
      </SessionProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
