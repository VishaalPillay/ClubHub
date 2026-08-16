/**
 * The collage manifest.
 *
 * Placement is data so that adding, moving or removing a piece is a one-line
 * edit here rather than a new CSS rule. Each entry becomes one `<img>` carrying
 * its geometry in custom properties (see `.flow-scrap` in `collage.css`).
 *
 * ── Everything is anchored to the SCREEN, not the card ──────────────────────
 * Corner pieces pin to a corner of the viewport; column pieces pin to its left
 * or right edge. Nothing is measured from the sheet any more.
 *
 * That is a deliberate reversal. Anchoring to the card kept the pieces tight
 * against the form, but it also pulled them inward off the screen edge as the
 * viewport widened, so the collage floated in the middle of each gutter with
 * clear paper on both sides of it. Anchored to the edge, every piece is stuck to
 * the rim of the screen and the chain reads as one continuous paste-up down each
 * side, which is the whole point of a collage.
 *
 * Corner widths use `clamp(min, Nvw, max)` so they hold their proportion of the
 * screen: modest on a 13" laptop, grown into the corner on a 27" monitor, and
 * never runaway at either end. Column pieces are fixed px stepped by
 * `--scrap-scale`.
 *
 * ── ORDER IS Z-ORDER ────────────────────────────────────────────────────────
 * This array is painted front to back, so a piece listed later sits ON TOP of
 * one listed earlier. The list is therefore grouped by stacking intent rather
 * than by category, and moving an entry up or down the list restacks it:
 *
 *   · each column runs top to bottom, so every piece overlaps the bottom edge
 *     of the one above it and no piece is left floating on its own
 *   · japan is listed BEFORE roots so the branch is drawn over the newsprint
 *   · each butterfly is listed right after the corner it's leaving (gamers,
 *     roots), so it paints on top of that corner specifically — not grouped
 *     together at the end, because they're not landing on the same surface
 *
 * ── Repeats ─────────────────────────────────────────────────────────────────
 * Only the butterfly and the Indian stamp repeat. Everything else appears once.
 *
 * ── `w` / `max` are load-bearing ────────────────────────────────────────────
 * `scripts/prep-collage.mjs` READS these and encodes each file at its largest
 * on-screen size. Change one and re-run the script.
 */

type Common = {
  /** Path under `public/`, e.g. "/collage/butterfly.avif". */
  src: string;
  /** Rotation in degrees. */
  r?: number;
  /** Opacity, for pieces that should sit further back. */
  o?: number;
  /** Saturation multiplier. The field is sepia; 0 is fully grey, 1 untouched. */
  sat?: number;
  /**
   * Fetched at high priority instead of low. Every scrap loads eagerly — the
   * layer is fixed, so all of them are on screen immediately — so this decides
   * which ones win the race, not which ones load at all.
   */
  priority?: boolean;
};

export type Scrap = Common &
  (
    | {
        /** Pinned to a viewport corner, sized against viewport width. */
        corner: "tl" | "tr" | "bl" | "br";
        /** Width as a percentage of viewport width. */
        vw: number;
        /** Floor and ceiling for that width, in px. */
        min: number;
        max: number;
        /** Offset from the corner in px. Negative bleeds off the edge. */
        dx?: number;
        dy?: number;
      }
    | {
        /** Pinned to the left or right edge of the viewport. */
        side: "left" | "right";
        /** Gap in px from that screen edge. Negative bleeds off it. */
        edge: number;
        /** Distance from the top of the viewport. */
        y: string;
        /** Display width in px at --scrap-scale: 1. */
        w: number;
      }
  );

export const SCRAPS: Scrap[] = [
  // ── The four corners, and nothing else for now ───────────────────────────
  // Columns and fillers are being added back one at a time; see git history for
  // the previous full manifest if it needs to be restored wholesale.
  //
  // maths / gamers / swiss: bigger, and less bled off their own two edges. `dx`
  // and `dy` are the amount that bleeds PAST the viewport edge and is clipped by
  // `.flow-collage`'s overflow:hidden — that clipping is what was eating each
  // piece's torn (deckled) border. Pulling the bleed in from ~-25/-30px to
  // ~-10/-12px keeps them anchored at the corner but leaves the torn edge inside
  // the viewport, where it's actually visible.
  { src: "/collage/maths.avif", corner: "tl", vw: 18, min: 175, max: 300, dx: -14, dy: -8, r: -2, priority: true },
  { src: "/collage/gamers.avif", corner: "bl", vw: 31, min: 315, max: 520, dx: -14, dy: -12 },
  // The backing sheet behind the head-and-stamp cluster, stretched to bridge the
  // two left corners: it starts overlapping into maths' lower-left and now runs
  // down far enough to overlap into gamers' upper edge too, so the strip down
  // the left side reads as continuous rather than three separate cuttings. It
  // has to be listed AFTER both maths and gamers to paint over them — and still
  // BEFORE greekman/stamp below, so those two stay on top of it in turn. Pushed
  // further out past the left screen edge than its first pass, so more of the
  // botanical print — the part that was sitting behind the head — shows in the
  // visible margin to the head's left instead of being fully hidden behind it.
  // y raised from 27% to 30% — at 27%, botanics' top edge sat 12px ABOVE
  // greekman's own top edge, and that sliver happened to land right on
  // botanics' postage-stamp/newsprint corner (verified against the source
  // art). Poking out above the head with nothing else around it, it read as a
  // stray blank flap. Raised so botanics no longer starts above greekman at
  // all — everything of it that shows is now behind the head or beside it,
  // where it has content (the flower, the masthead) to read as, rather than a
  // bare corner floating alone. Tilted further too (-3 → -14), and pushed
  // further left again per instruction.
  { src: "/collage/botanics.avif", side: "left", edge: -120, y: "31%", w: 250, r: -14 },
  // Listed right after maths so it paints ON TOP — just a sliver of the head
  // catches maths' lower-left corner. `edge: 0` (not negative) is deliberate: a
  // negative edge bleeds the RECTANGULAR bounding box off-screen, and
  // `.flow-collage`'s overflow:hidden clips it with a straight vertical line —
  // which, cutting through an actual face, reads as an ugly hard crop rather
  // than a torn edge. At edge:0 nothing is clipped: the piece's own silhouette
  // (already trimmed to its irregular torn-paper outline by prep-collage) is
  // what touches the screen edge, so the boundary you see is the natural torn
  // border, not an artificial rectangle.
  // edge: 6, not 0 — the 2° rotation swings the rendered bounding box a few px
  // further left than its CSS position alone, so a literal 0 still let 5px hang
  // off the screen. This small positive offset absorbs that and keeps the whole
  // silhouette on screen.
  { src: "/collage/greekman.avif", side: "left", edge: -20, y: "28%", w: 170, r: 2 },
  // Flying up out of gamers, just above the headphones — same headphones
  // location established earlier (~32% across, ~79% down the gamers box), but
  // this sits noticeably HIGHER than that (fy≈0.60 vs 0.79) so it clears the
  // artwork and reads as already airborne, not perched on it. Listed right
  // after gamers so it paints on top of the corner it's leaving.
  { src: "/collage/butterfly.avif", side: "left", edge: 77, y: "84%", w: 85, r: -12 },
  { src: "/collage/swiss.avif", corner: "br", vw: 21, min: 215, max: 370, dx: -12, dy: -12 },

  // roots: shrunk, and pushed down below the masthead. The masthead is 78px of
  // OPAQUE paper sitting above this layer (z-index), so `dy` less than that just
  // gets covered rather than clipped — but the vine's first flower is right at
  // its own trimmed top edge, so with the old dy:-55 it started well above the
  // masthead and had already opened out past it by the time the masthead ended,
  // reading as touching it with no breathing room. dy: 92 starts the piece
  // ~14px below the masthead's bottom edge instead.
  { src: "/collage/roots.avif", corner: "tr", vw: 10, min: 115, max: 185, dx: -10, dy: 92, priority: true },
  // Small, and just off the vine's upper flowers — reads as having taken off
  // from roots rather than perched on it, mirroring the one leaving gamers on
  // the other side of the page. Listed right after roots so it paints on top.
  { src: "/collage/butterfly.avif", side: "right", edge: 150, y: "21%", w: 90, r: -18 },
];
