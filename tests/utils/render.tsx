import React, { type ReactElement } from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { SWRConfig, type SWRConfiguration } from "swr";
import type { Session } from "next-auth";

export interface ProviderRenderOptions extends Omit<RenderOptions, "wrapper"> {
  session?: (Session | null) | undefined;
  swrConfig?: SWRConfiguration | undefined;
}

/**
 * Test wrapper providing SWR cache isolation and clean provider context for component tests.
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: ProviderRenderOptions,
): RenderResult {
  const { swrConfig, ...renderOptions } = options ?? {};

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
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
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
