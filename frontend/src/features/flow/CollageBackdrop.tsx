"use client";

import { useEffect, useState } from "react";

import { SCRAPS, type Scrap } from "@/features/flow/scraps";

/** 1×1 transparent GIF. What a phone downloads instead of a 35KB engraving. */
const BLANK =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * The fixed layer behind every flow page: the paper ground, its tooth, and the
 * collage scraps.
 *
 * It renders correctly with an empty manifest — the ground and the procedural
 * grain are all CSS — so the treatment shipped before the artwork did, and the
 * artwork lands as a data change in `scraps.ts` plus a run of
 * `scripts/prep-collage.mjs`.
 *
 * Entirely decorative: `aria-hidden` and `pointer-events: none` throughout, so
 * none of it reaches the accessibility tree or eats a click meant for the form.
 *
 * ── Nothing here is lazy ────────────────────────────────────────────────────
 * `loading="lazy"` looked right and was measurably broken: this layer is
 * `position: fixed` and fills the viewport, so every scrap is on screen at first
 * paint and none of them are ever "below the fold". Marked lazy, six of eight
 * never loaded at all. Priority is expressed through the fetch queue instead.
 *
 * ── How the small-screen saving works, and why not <picture> ────────────────
 * Below 1023px `MobileGate` hides the entire app — except `display: none` does
 * not stop a download. Measured on a phone-sized viewport, every hidden piece
 * was still fetched AND decoded: the whole collage pulled over the connection
 * least able to afford it, to sit behind a screen nobody can see.
 *
 * The obvious fix is `<picture>` with a `<source media>`, and it does not work
 * under React. React creates the `<img>` and assigns its `src` before the
 * `<source>` siblings are attached, so the browser resolves the image
 * immediately — to the placeholder — and never re-runs selection. It happens to
 * work on the server-rendered HTML, where the parser sees `<source>` first,
 * which makes it look correct until a client render replaces the tree. A window
 * that starts narrow and is widened then shows a page missing most of its
 * collage, permanently, until reload.
 *
 * So the width is tracked in state and the `src` is chosen directly. `wide`
 * starts false, which is what the server renders, so a phone never requests the
 * full-size art at all and there is no hydration mismatch. On a wide viewport
 * the effect flips it and the real files load a beat after hydration — which for
 * background decoration is the right time anyway, since it no longer competes
 * with the page's own resources.
 *
 * The threshold matches the gate exactly: anything showing the gate downloads no
 * collage at all.
 */
export default function CollageBackdrop() {
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(mq.matches);
    sync();
    /* Both, deliberately. `change` is the correct signal and is what fires in a
       real browser; it was observed NOT firing when the viewport was driven
       programmatically, which left the page stuck showing placeholders after a
       widen. `resize` re-reads the same query, so whichever arrives wins. It is
       free when nothing changed — setState with an identical value does not
       re-render. */
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  const markFailed = (src: string) =>
    setFailed((prev) => (prev.has(src) ? prev : new Set(prev).add(src)));

  /**
   * Geometry for one scrap, as custom properties.
   *
   * Corner pieces pin to two viewport edges and size with `clamp(min, vw, max)`,
   * so they hold their proportion of the screen instead of being a fixed size
   * that only suits one monitor. Column pieces pin to one screen edge — left
   * pieces from the left, right pieces from the right, so both columns stay
   * stuck to the rim of the screen at any width — and step with `--scrap-scale`.
   */
  const place = (s: Scrap): Record<string, string> => {
    if ("corner" in s) {
      const dx = `${s.dx ?? 0}px`;
      const dy = `${s.dy ?? 0}px`;
      return {
        "--w": `clamp(${s.min}px, ${s.vw}vw, ${s.max}px)`,
        [s.corner === "tl" || s.corner === "bl" ? "--x" : "--right"]: dx,
        [s.corner === "tl" || s.corner === "tr" ? "--y" : "--bottom"]: dy,
      };
    }
    return {
      "--w": `calc(${s.w}px * var(--scrap-scale))`,
      [s.side === "left" ? "--x" : "--right"]: `${s.edge}px`,
      "--y": s.y,
    };
  };

  return (
    <div className="flow-ground" aria-hidden>
      <div className="flow-collage">
        {SCRAPS.filter((s) => !failed.has(s.src)).map((s, i) => {
          const shown = wide;
          return (
            // Decorative, pre-encoded AVIF at a fixed display width: next/image
            // would re-encode an already-optimised asset and fight the absolute
            // positioning, for no bandwidth win.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              /* Index, not src: a piece may be placed more than once — the
                 butterfly and the stamp are reused small on both sides — and two
                 children keyed by the same string is a duplicate-key bug that
                 drops all but one of them. */
              key={i}
              src={shown ? s.src : BLANK}
              alt=""
              className="flow-scrap"
              fetchPriority={s.priority ? "high" : "low"}
              decoding="async"
              onError={() => markFailed(s.src)}
              /* `onError` alone cannot cover a server-rendered image that fails
                 before React hydrates — the event is gone before anything is
                 listening. A failed image reports `complete` with a
                 `naturalWidth` of zero; the 1×1 placeholder decodes to 1, so it
                 never trips this. */
              ref={(el) => {
                if (shown && el && el.complete && el.naturalWidth === 0) markFailed(s.src);
              }}
              style={
                {
                  ...place(s),
                  "--r": `${s.r ?? 0}deg`,
                  "--o": s.o ?? 1,
                  "--sat": s.sat ?? 1,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>
    </div>
  );
}
