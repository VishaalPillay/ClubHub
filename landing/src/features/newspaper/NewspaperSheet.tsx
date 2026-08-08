"use client";

import { motion } from "framer-motion";
import { useNewspaper } from "./NewspaperContext";
import { useSheetMotion } from "./useSheetMotion";
import type { EditionPage } from "./edition";

/**
 * One LEAF of the newspaper — two pages, one per side, the way newsprint
 * actually works.
 *
 * The recto is the right-hand leaf of the open spread. Turn it and it swings
 * across the spine to become the left-hand leaf, showing the verso: a real page
 * with real copy, not the faked show-through this used to carry.
 *
 * ☠ HARD RULE: `front` and `back` are BOTH rendered UNCONDITIONALLY, in every
 * mode. Making either conditional would omit half the edition from the SSR HTML
 * — the RSC payload would still carry it, but the crawlable document would not.
 * Every performance affordance that could hurt indexing (`inert`, `will-change`)
 * is gated on paper mode instead, which only ever exists after hydration.
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
  const { pos, sheet: current, page, count, mode, spread, goTo } = useNewspaper();
  const depth = index - current;

  /** Where this leaf's turn sits on the scroll. One step is a spread on a wide
   *  screen and a single page on a narrow one — see useSheetMotion. */
  const turnStart = spread ? index : index * 2;

  /**
   * The layer budget. Each sheet at ~604×820 CSS px on a DPR-2 display is ~8 MB
   * of GPU texture; four leaves with two live faces each is well inside what a
   * mid-range phone will hold, but only because just the three leaves around
   * the current one are ever composited.
   */
  const live = mode === "paper" && Math.abs(depth) <= 1;

  /**
   * Leaves more than one back are parked, and a parked leaf gets
   * `transform: none` — which would spring it back upright onto the unread
   * stack. They keep their turned pose from a STATIC inline transform instead:
   * static transforms cost nothing per frame, unlike the motion-driven ones.
   */
  const turned = mode === "paper" && depth < -1;

  const m = useSheetMotion(pos, turnStart, depth);

  /** Page numbers for the folio and the accessible label. */
  const frontNo = index * 2;
  const backNo = frontNo + 1;

  /**
   * Which of this leaf's two pages a reader can actually see — and therefore
   * reach with Tab.
   *
   * On a spread, both leaves of the open pair are on screen at once: the recto
   * of the top unturned leaf (depth 0) and the verso of the one just turned
   * (depth -1). On a narrow screen only ever ONE page is centred, so depth is
   * not enough to tell recto from verso and the current page number decides.
   */
  const frontVisible = spread ? depth === 0 : page === frontNo;
  const backVisible = spread ? depth === -1 : page === backNo;

  return (
    <div className="np-sheet-slot" style={{ "--np-i": index } as React.CSSProperties}>
      {/* Sibling of the sheet, NOT a child — it must not rotate with it. */}
      {live && (
        <motion.div
          className="np-cast"
          aria-hidden="true"
          style={{ scaleX: m.castScaleX, opacity: m.castOpacity }}
        />
      )}

      <motion.div
        className="np-sheet"
        data-live={live ? "" : undefined}
        data-turned={turned ? "" : undefined}
        /**
         * Transform order is guaranteed by motion-dom's `transformPropOrder`:
         * z/translateZ is emitted BEFORE rotate/rotateY, giving
         * `translateZ(64px) rotate(-0.6deg) rotateY(-90deg)`. So the lift applies
         * in the stage's coordinate space, not the rotated sheet's. The other
         * way round, the sheet slides sideways as it turns.
         *
         * Parked sheets pass `undefined`, which makes motion emit the literal
         * `transform: none` — and an element at `transform: none` is not
         * layer-promoted. That is what keeps the budget flat.
         */
        style={
          live
            ? { z: m.z, rotate: m.rotate, rotateY: m.rotateY }
            : turned
              ? /* Plain numbers, not motion values: written once, never per
                   frame. This CANNOT be a CSS rule — framer-motion writes
                   `transform` inline on every motion element (including the
                   literal `transform: none` for parked sheets), and an inline
                   style always beats an author stylesheet.

                   The per-index jitter matters: with every turned sheet at the
                   same angle the pile lands pixel-perfect and reads as one flat
                   slab rather than a stack of paper. */
                {
                  z: 2,
                  rotate: -1.4 - (index % 4) * 0.55,
                  rotateY: -180,
                  x: -(index % 3) * 3,
                  y: (index % 5) * 2,
                }
              : undefined
        }
      >
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

          {live && (
            <motion.div
              className="np-shade np-shade--front"
              aria-hidden="true"
              style={{ opacity: m.frontShade }}
            />
          )}

          {/* "Grab the corner" — the free edge of the right-hand leaf is its
              outer edge, so this sits bottom-right, where your hand would go.
              Turning it reveals this same leaf's verso. */}
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

            {live && (
              <motion.div
                className="np-shade np-shade--back"
                aria-hidden="true"
                style={{ opacity: m.backShade }}
              />
            )}

            {/* The way back. This face is doubly mirrored — rotateY(180) inside a
                leaf that is itself at rotateY(-180) — so its local bottom-LEFT
                lands on the screen's far left, which is precisely the free edge
                of the left-hand leaf. */}
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
      </motion.div>
    </div>
  );
}
