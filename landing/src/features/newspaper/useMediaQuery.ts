"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A media query as an external store — same reasoning as readingMode.ts: this is
 * state React cannot know while rendering, so it is subscribed to rather than
 * synced into `useState` from an effect.
 *
 * The server snapshot is always `false`. That is safe here because every caller
 * is inside paper mode, which only ever exists after hydration; nothing in the
 * crawlable document depends on it.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
