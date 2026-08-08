"use client";

import { createContext, useContext } from "react";
import type { MotionValue } from "framer-motion";

/**
 * "plain" — the server-rendered document: eight articles in normal flow, zero JS.
 * "paper" — the 3D newspaper on a desk. Only ever set client-side, after hydration.
 *
 * Reduced-motion, print, no-JS and the explicit "read as plain page" preference
 * are all the *same* code path: stay in (or return to) plain. That is what keeps
 * the newspaper an honest progressive enhancement instead of a pile of hacks.
 */
export type ReadingMode = "plain" | "paper";

export interface NewspaperCtx {
  /** Continuous scroll position in STEPS — one step is a spread on a wide
   *  screen and a single page on a narrow one. Sheets subscribe to this and
   *  therefore re-render zero times during a turn. */
  pos: MotionValue<number>;
  /** Discrete current page, 0 … count-1. On a spread this is the recto, the
   *  page that leads the pair. Aliased as `index` for the nav components. */
  page: number;
  /** @deprecated alias of `page`, kept because SectionRule and PageControls
   *  both read it and both mean "the page we are on". */
  index: number;
  /** Discrete current LEAF — how many leaves have been turned. Sheets use it
   *  for depth, and therefore for the compositing budget. */
  sheet: number;
  /** Discrete scroll position, 0 … steps. One step is a spread on a wide screen
   *  and a page on a narrow one. */
  step: number;
  /** Highest valid `step`. */
  steps: number;
  /** Total PAGES (not leaves). */
  count: number;
  /** True when two leaves are shown side by side. False on narrow screens,
   *  where a two-page spread would be unreadable and pages are read one at a
   *  time instead. */
  spread: boolean;
  mode: ReadingMode;
  /** Takes a PAGE index. Callers never need to know about leaves or spreads —
   *  the shell converts to a scroll position for the current layout.
   *
   *  Use this only when you genuinely mean a specific page: a section jump, a
   *  teaser, a dog-ear, a deep link. For "one more" / "one back" use `goToStep`,
   *  because on a spread the page BEFORE the recto is that same spread's own
   *  verso — `goTo(page - 1)` resolves to where you already are and nothing
   *  moves. That was a real bug in the pager. */
  goTo: (i: number, opts?: { behavior?: ScrollBehavior }) => void;
  /** Moves by whole steps, which is what "previous"/"next" actually mean. */
  goToStep: (i: number, opts?: { behavior?: ScrollBehavior }) => void;
  /** `goToStep` relative to the PENDING target, so repeated presses accumulate
   *  instead of re-issuing the jump already in flight. Use this for prev/next. */
  stepBy: (delta: number) => void;
  setMode: (m: ReadingMode) => void;
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
