/**
 * The edition — single source of truth for page count, deep-link slugs, nav
 * labels and folios.
 *
 * Server-safe (no "use client"): imported by app/page.tsx to compose the sheets
 * and by the client shell for navigation. Everything here is a plain
 * string/number so it crosses the RSC boundary without complaint.
 */

export interface EditionPage {
  /** Stable react key. */
  id: string;
  /** URL fragment — `/#the-league-table` deep-links to this page. */
  slug: string;
  /** Announced to screen readers on turn, and shown in the page indicator. */
  title: string;
  /** The section rule this page belongs to. */
  section: SectionKey;
}

export type SectionKey = "culture" | "connections" | "collaboration" | "campus";

export const PAGES: readonly EditionPage[] = [
  { id: "front", slug: "front-page", title: "The Front Page", section: "culture" },
  { id: "situation", slug: "the-situation", title: "The Situation", section: "culture" },
  {
    id: "governance",
    slug: "governance",
    title: "Governance & Structure",
    section: "connections",
  },
  {
    id: "league",
    slug: "the-league-table",
    title: "The League Table",
    section: "collaboration",
  },
  {
    id: "listings",
    slug: "listings-and-notices",
    title: "Listings & Notices",
    section: "collaboration",
  },
  { id: "masthead", slug: "the-masthead-box", title: "The Masthead Box", section: "campus" },
  { id: "letters", slug: "letters", title: "Letters & How To File", section: "campus" },
  { id: "colophon", slug: "the-back-page", title: "The Back Page", section: "campus" },
] as const;

/**
 * ── PAGES vs SHEETS ─────────────────────────────────────────────────────────
 *
 * A sheet is a physical leaf and carries TWO pages, one per side, exactly like
 * newsprint: sheet k is page 2k on the front and page 2k+1 on the back. Eight
 * pages therefore bind into four leaves.
 *
 * With the spine at the centre of the stage, that produces the real pagination
 * of a bound publication — the odd leaf out at each end is the closed cover:
 *
 *     leaves turned   left leaf   right leaf
 *          0             —          page 1     (closed, front cover)
 *          1           page 2       page 3
 *          2           page 4       page 5
 *          3           page 6       page 7
 *          4           page 8         —        (closed, back cover)
 */
export const PAGES_PER_SHEET = 2;

export const SHEET_COUNT = Math.ceil(PAGES.length / PAGES_PER_SHEET);

/** Which leaf carries a given page, and on which side. */
export function sheetForPage(page: number) {
  return { sheet: Math.floor(page / PAGES_PER_SHEET), back: page % PAGES_PER_SHEET === 1 };
}

/**
 * How many leaves must be turned for a page to be visible.
 *
 * Page 0 needs none. Every other page p needs `floor((p + 1) / 2)` — its own
 * leaf if it is a recto, or its leaf turned over if it is a verso. This is the
 * spread index on a wide screen, and it is what `goTo` scrolls to.
 */
export function spreadForPage(page: number) {
  return Math.floor((page + 1) / PAGES_PER_SHEET);
}

/** The recto of a spread — the page that leads it, and the one whose title and
 *  section are announced. The final spread has only a verso. */
export function rectoForSpread(spread: number) {
  return Math.min(spread * PAGES_PER_SHEET, PAGES.length - 1);
}

/**
 * The section rule from the masthead — `CULTURE • CONNECTIONS • COLLABORATION •
 * CAMPUS`. Each label jumps to the first page of its section, so the rule is
 * real navigation rather than decoration.
 */
export const SECTIONS: readonly { key: SectionKey; label: string; page: number }[] = [
  { key: "culture", label: "Culture", page: 1 },
  { key: "connections", label: "Connections", page: 2 },
  { key: "collaboration", label: "Collaboration", page: 3 },
  { key: "campus", label: "Campus", page: 5 },
] as const;

/**
 * Standing masthead copy, carried over from the old utility strip.
 * The hyphens are U+2011 (non-breaking) — a plain "-" lets the browser break
 * "Multi-tenant" across lines in the narrow masthead gutter.
 */
export const DATELINE = "Est. 2026 · The Club Operations Paper";
export const SLUGLINE = "Student‑run · Multi‑tenant · Open for enrolment";
export const EDITION_LINE = "Vol. II · Edition 01 · Authored by Vishaal Pillay";
