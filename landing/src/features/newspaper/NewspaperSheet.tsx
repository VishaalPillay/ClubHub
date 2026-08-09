"use client";

import { useNewspaper } from "./NewspaperContext";
import type { EditionPage } from "./edition";

/**
 * One LEAF of the newspaper — two pages, one per side, the way newsprint
 * actually works. Leaf k prints page 2k on the front and page 2k+1 on the back.
 *
 * ── What this is now, and what it used to be ────────────────────────────────
 * This was the CSS-3D page turn: framer-motion transforms, a cast shadow, face
 * shading, a compositing budget. All of that visual machinery moved into the
 * WebGL scene, and for a while this component kept animating anyway — driving
 * per-frame inline styles and GPU layer promotion on content that sits inside
 * `.np-sr`, clipped to one pixel, where nobody could ever see it. It is now
 * exactly what it renders as:
 *
 *   · in PLAIN mode, two static articles of the crawlable document;
 *   · in PAPER mode, the same two articles as the accessibility surface for a
 *     canvas that cannot be read by a screen reader, searched, or selected.
 *
 * ☠ HARD RULE: `front` and `back` are BOTH rendered UNCONDITIONALLY, in every
 * mode. Making either conditional would omit half the edition from the SSR HTML
 * — the RSC payload would still carry it, but the crawlable document would not.
 */
export default function NewspaperSheet({
  index,
  frontPage,
  backPage,
  front,
  back,
}: {
  /** Leaf index, 0…SHEET_COUNT-1 — NOT a page number. */
  index: number;
  frontPage: EditionPage;
  backPage?: EditionPage;
  front: React.ReactNode;
  back?: React.ReactNode;
}) {
  const { sheet: current, page, count, mode, spread, goTo } = useNewspaper();
  const depth = index - current;

  /** Page numbers for the folio and the accessible label. */
  const frontNo = index * 2;
  const backNo = frontNo + 1;

  /**
   * Which of this leaf's two pages is the CURRENT one — and therefore live for
   * assistive tech rather than `inert`.
   *
   * On a spread, both leaves of the open pair count at once: the recto of the
   * top unturned leaf (depth 0) and the verso of the one just turned (depth -1).
   * On a narrow screen only one page is current at a time, so depth alone cannot
   * tell recto from verso and the page number decides.
   */
  const frontVisible = spread ? depth === 0 : page === frontNo;
  const backVisible = spread ? depth === -1 : page === backNo;

  return (
    <div className="np-sheet-slot">
      <div className="np-sheet">
        <div className="np-face np-face--front">
          <article
            id={frontPage.slug}
            className="np-page-body"
            tabIndex={-1}
            aria-roledescription="newspaper page"
            aria-label={`Page ${frontNo + 1} of ${count} — ${frontPage.title}`}
            /* React 19 treats `inert` as a real boolean prop. Passing the empty
               string (the HTML form) is falsy here and gets dropped silently. */
            inert={mode === "paper" && !frontVisible}
          >
            {/* Carries the page's em base — see .np-page-inner in newspaper.css
                for why it cannot live on the container element itself. */}
            <div className="np-page-inner">{front}</div>

            {/* Pins the page to the foot of the sheet. Without it, a page whose
                content runs short leaves dead paper below and reads unfinished
                rather than composed. */}
            <div className="np-page-foot" aria-hidden="true">
              <hr className="np-rule-thin" />
              <div className="np-page-foot-row">
                <span className="np-micro">Club-Hub · The Club Operations Paper</span>
                <span className="np-micro">
                  {frontPage.title} · {frontNo + 1}/{count}
                </span>
              </div>
            </div>
          </article>

          {/* Page-turn affordance for the reader who is IN the hidden document —
              a screen-reader or keyboard user for whom the canvas does not
              exist. It drives the same goTo the visible chrome uses. */}
          {mode === "paper" && frontVisible && backPage && (
            <button
              type="button"
              className="np-corner"
              onClick={() => goTo(backNo)}
              aria-label={`Turn to page ${backNo + 1}`}
            />
          )}
        </div>

        {backPage && (
          <div className="np-face np-face--back">
            <article
              id={backPage.slug}
              className="np-page-body"
              tabIndex={-1}
              aria-roledescription="newspaper page"
              aria-label={`Page ${backNo + 1} of ${count} — ${backPage.title}`}
              inert={mode === "paper" && !backVisible}
            >
              <div className="np-page-inner">{back}</div>

              <div className="np-page-foot" aria-hidden="true">
                <hr className="np-rule-thin" />
                <div className="np-page-foot-row">
                  <span className="np-micro">Club-Hub · The Club Operations Paper</span>
                  <span className="np-micro">
                    {backPage.title} · {backNo + 1}/{count}
                  </span>
                </div>
              </div>
            </article>

            {mode === "paper" && backVisible && (
              <button
                type="button"
                className="np-corner np-corner--prev"
                onClick={() => goTo(frontNo)}
                aria-label={`Turn back to page ${frontNo + 1}`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
