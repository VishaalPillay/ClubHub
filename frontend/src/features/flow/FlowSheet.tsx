"use client";

/**
 * A single torn sheet of paper.
 *
 * The deckled edge is procedural — `feTurbulence` feeding a `feDisplacementMap`,
 * defined once by `DeckleDefs` in `FlowShell` and referenced from
 * `collage.css`. No asset, no fixed resolution, and swapping it for a scanned
 * edge later is a change to one CSS rule rather than to any layout.
 *
 * One sheet per step: these are rendered *inside* `StepDeck`, so the whole sheet
 * lifts away and a new one drops in on each step. That is what keeps the deckle
 * cheap — a sheet never changes size while it is on screen, so the filter is
 * rasterized once per step instead of on every frame of a height animation.
 */
export default function FlowSheet({
  children,
  className = "",
  tape = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Masking tape across the top edge. */
  tape?: boolean;
}) {
  return (
    <div className={`flow-sheet ${className}`}>
      <div className="flow-sheet__ground" aria-hidden />
      {tape && <span className="flow-sheet__tape" aria-hidden />}
      <div className="flow-sheet__body">{children}</div>
    </div>
  );
}

/**
 * The filter definition the sheets reference. Rendered once per page by
 * `FlowShell`; `filter: url(#flow-deckle)` resolves against the same document.
 *
 * `scale` is the amplitude of the tear in pixels — the sheet body's padding has
 * to stay comfortably clear of it (see `.flow-sheet__body`).
 */
export function DeckleDefs() {
  return (
    <svg
      aria-hidden
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", pointerEvents: "none" }}
    >
      <defs>
        <filter id="flow-deckle" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.03"
            numOctaves={3}
            seed={7}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={9}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
