import { WORDMARK_LETTERS, WORDMARK_TILES, WORDMARK_VIEW } from "./wordmarkPaths";

interface WordmarkProps {
  /** Rendered width. The mark scales from this — height follows the aspect. */
  className?: string;
  /**
   * Flip the palette for dark surfaces (the ink footers): the scraps become
   * pale and the letters go dark, so the mark keeps its figure/ground instead
   * of dissolving into the background.
   */
  invert?: boolean;
  title?: string;
}

/**
 * The Club-Hub wordmark: a ransom-note collage, every letter cut from a
 * different typeface and pasted on its own scrap of black paper at its own
 * angle.
 *
 * Mirrored by landing/src/features/newspaper/Wordmark.tsx, which draws the same
 * geometry against `.np-*` classes because that project carries no Tailwind.
 * Regenerate both copies of wordmarkPaths.ts together with
 * scripts/gen-wordmark.mjs.
 *
 * **Two layers, and they are not a path with holes.** `WORDMARK_TILES` is every
 * scrap as a solid silhouette — drop shadows included — and `WORDMARK_LETTERS`
 * is drawn on top of it. Holes would be less path data, but the letters would
 * then be whatever happens to be behind the mark, and `invert` would have
 * nothing to flip.
 *
 * Pure SVG outlines traced from the artwork — no webfont and no image request,
 * so it renders identically on first paint and can never flash. That matters
 * here: the mark sits in the header of every signed-in page.
 *
 * ── The colours are inline, and that is the fix for a real failure ───────────
 * They used to come from `--wm-ink` / `--wm-knock` in globals.css. When that
 * stylesheet is missing or stale — a dev server that has not picked the file up
 * yet is enough — both paths fall back to the SVG default of black, the letters
 * disappear into their own scraps, and all that is left is the fragments of
 * letter that overhang a tile. A logo that renders as a row of black slabs when
 * one file is late is a logo with a dependency it should not have, so the two
 * colours are set here. The `var()` keeps each project's ink token in charge
 * where it exists; the literal is what the mark falls back to when nothing does.
 */
export function Wordmark({
  className = "",
  invert = false,
  title = "Club-Hub",
}: WordmarkProps) {
  const { x, y, w, h } = WORDMARK_VIEW;
  const tile = invert ? "var(--color-paper, #f5f2ec)" : "var(--color-black, #000000)";
  /* Not pure black on the ink surfaces: the letterforms should read as printed
     on a pale scrap, not punched through it to the footer behind. */
  const letter = invert ? "#24221d" : "#f7f4ed";

  return (
    <svg
      viewBox={`${x} ${y} ${w} ${h}`}
      className={`wired-wordmark ${className}`}
      role="img"
      aria-label={title}
      /* `evenodd` is potrace's own fill rule, and the letters need it: the bowls
         of B and the counter of U are separate subpaths inside their outlines,
         not reversed windings. Inherited by both paths from here. */
      fillRule="evenodd"
    >
      <path d={WORDMARK_TILES} style={{ fill: tile }} />
      <path d={WORDMARK_LETTERS} style={{ fill: letter }} />
    </svg>
  );
}
