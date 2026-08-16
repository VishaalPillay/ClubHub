"use client";

import { createContext, useContext } from "react";

/**
 * "plain" — the server-rendered document: eight articles in normal flow, zero JS.
 * "paper" — the 3D newspaper on a desk. Only ever set client-side, after hydration.
 *
 * Reduced-motion, print, no-JS and the explicit "read as plain page" preference
 * are all the *same* code path: stay in (or return to) plain. That is what keeps
 * the newspaper an honest progressive enhancement instead of a pile of hacks.
 */
export type ReadingMode = "plain" | "paper";

/**
 * Deliberately NARROW: only what a consumer outside the shell actually reads.
 *
 * The step vocabulary — `pos`, `step`, `steps`, `goToStep`, `stepBy` — used to
 * be published here for the prev/next pager. The pager is gone (turning is
 * scroll, and only scroll), and those all stayed as live-looking API that
 * nothing called. They still exist inside NewspaperShell, where the keyboard
 * handler needs them; they are just no longer part of the contract.
 */
export interface NewspaperCtx {
  /** Discrete current page, 0 … count-1. On a spread this is the recto, the
   *  page that leads the pair. */
  page: number;
  /** Discrete current LEAF — how many leaves have been turned. Sheets use it
   *  for depth, and therefore for the compositing budget. */
  sheet: number;
  /** Total PAGES (not leaves). */
  count: number;
  /** True when two leaves are shown side by side. False on narrow screens,
   *  where a two-page spread would be unreadable and pages are read one at a
   *  time instead. */
  spread: boolean;
  mode: ReadingMode;
  /** Takes a PAGE index. Callers never need to know about leaves or spreads —
   *  the shell converts to a scroll position for the current layout. Section
   *  jumps, teasers, dog-ears and deep links all speak pages. */
  goTo: (i: number, opts?: { behavior?: ScrollBehavior }) => void;
}

const Ctx = createContext<NewspaperCtx | null>(null);

export const NewspaperProvider = Ctx.Provider;

export function useNewspaper(): NewspaperCtx {
  const value = useContext(Ctx);
  if (!value) {
    throw new Error("useNewspaper() must be called inside <NewspaperShell>");
  }
  return value;
}
