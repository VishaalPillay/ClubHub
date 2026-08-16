"use client";

import { LOGIN_URL, REGISTER_URL } from "./links";
import SectionRule from "./SectionRule";
import Wordmark from "./Wordmark";

/**
 * The persistent chrome: a strip of desk blotter along the bottom carrying the
 * wordmark, the section rule and the auth CTAs.
 *
 * Turning pages is SCROLL, and only scroll — there are no prev/next buttons and
 * no folio read-out. The progress bar and the live region in NewspaperShell
 * still report position, so nothing that needs the page number lost it.
 *
 * `position: fixed` and rendered OUTSIDE `.np-stage` — an ancestor with
 * `perspective` becomes the containing block for fixed descendants, which would
 * trap and skew this bar in 3D space.
 *
 * The Login/Register buttons keep MarketingNav's exact styling so the auth CTAs
 * stay visually continuous with /login and /register.
 */
export default function PageControls() {
  return (
    <div className="np-controls">
      <span className="np-controls-mark">
        <Wordmark invert />
      </span>

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
