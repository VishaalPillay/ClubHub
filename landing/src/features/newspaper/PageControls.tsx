"use client";

import { LOGIN_URL, REGISTER_URL } from "./links";
import { useNewspaper } from "./NewspaperContext";
import SectionRule from "./SectionRule";
import Wordmark from "./Wordmark";

/**
 * The persistent chrome: a strip of desk blotter along the bottom carrying the
 * wordmark, the folio, prev/next, the section rule, the reading-mode switch and
 * the auth CTAs.
 *
 * `position: fixed` and rendered OUTSIDE `.np-stage` — an ancestor with
 * `perspective` becomes the containing block for fixed descendants, which would
 * trap and skew this bar in 3D space.
 *
 * The Login/Register buttons keep MarketingNav's exact styling so the auth CTAs
 * stay visually continuous with /login and /register.
 */
export default function PageControls() {
  const { index, count, step, steps, spread, mode, stepBy } = useNewspaper();

  /* On a spread both leaves are open at once, so a single page number would be
     a lie about half of what is on screen. `index` is the recto; its verso is
     the page before it, except on the closed first and last leaves. */
  const verso = index - 1;
  const folio =
    spread && verso >= 0 && index < count
      ? `Pages ${verso + 1}–${index + 1} of ${count}`
      : `Page ${index + 1} of ${count}`;

  return (
    <div className="np-controls">
      <span className="np-controls-mark">
        <Wordmark invert />
      </span>

      {mode === "paper" && (
        <div className="np-pager">
          {/* Steps, NOT pages. On a spread the page before the recto is that
              spread's own verso, so `goTo(index - 1)` resolved to the scroll
              position we are already at and this button did nothing. */}
          <button
            type="button"
            onClick={() => stepBy(-1)}
            disabled={step === 0}
            aria-label={spread ? "Previous spread" : "Previous page"}
          >
            ‹
          </button>
          <span className="np-folio">{folio}</span>
          <button
            type="button"
            onClick={() => stepBy(1)}
            disabled={step >= steps}
            aria-label={spread ? "Next spread" : "Next page"}
          >
            ›
          </button>
        </div>
      )}

      <div className="np-controls-sections">
        <SectionRule compact />
      </div>

      {/* The reading-mode switch used to sit here and is deliberately gone from
          the bar. It still exists as a focus-revealed skip link in
          NewspaperShell — reduced-motion readers are already routed to plain
          mode automatically by readingMode.ts, but someone who can tolerate
          motion and still cannot read a rotating page needs a way out, and
          removing the last one would be a real regression rather than a
          tidier bar. */}

      <nav className="np-controls-auth" aria-label="Account">
        <a href={LOGIN_URL} className="np-authbtn">
          Login
        </a>
        <a href={REGISTER_URL} className="np-authbtn np-authbtn--solid">
          Register
        </a>
      </nav>
    </div>
  );
}
