"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * TanStack Query (React Query v5) client provider.
 * Wrap your app or individual pages that need server-state caching.
 *
 * Config:
 * - staleTime: 60s — avoids re-fetching on every mount for stable reference data
 * - retry: 1 — one retry on failure, then surface the error
 * - refetchOnWindowFocus: false — editorial app, not real-time dashboard
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
