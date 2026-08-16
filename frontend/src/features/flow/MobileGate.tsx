"use client";

import { Wordmark } from "@/components/ui/Wordmark";
import FlowSheet from "@/features/flow/FlowSheet";

import "@/features/flow/collage.css";

/**
 * The small-screen notice.
 *
 * Club-Hub is a laptop application for now, so below the breakpoint the app is
 * hidden entirely and this stands in its place — a torn sheet with a late-edition
 * notice on it, rather than a broken layout the visitor has to fight.
 *
 * ── The breakpoint is one number ────────────────────────────────────────────
 * `--gate-below` in collage.css. It is set to 1023px, which is "laptops only" as
 * asked: it turns away phones AND tablets in portrait. If the intent is only to
 * stop phones, move it to 767px and tablets get the app back. Nothing else has
 * to change — the visibility rules key off that one media query.
 *
 * ── Why CSS and not JS ──────────────────────────────────────────────────────
 * A width check in React cannot run until hydration, so a phone would render the
 * full app, paint it, and only then replace it — a visible flash of an interface
 * the visitor cannot use. The swap is a media query, so it is correct in the
 * very first frame the browser paints, before any JavaScript arrives.
 */
export default function MobileGate() {
  return (
    <div className="mobile-gate">
      <div className="flow-ground" aria-hidden />
      <div className="mobile-gate__inner">
        <FlowSheet tape>
          <div className="text-center">
            <Wordmark className="w-[150px] mx-auto mb-8" />
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-caption-gray mb-3">
              Late Edition
            </p>
            <h1 className="font-display text-[30px] leading-[1.05] tracking-[-0.5px] font-bold uppercase mb-4">
              Best read on a bigger desk.
            </h1>
            <div className="w-full h-px bg-hairline-tint mb-4" />
            <p className="font-body text-[15px] leading-[1.5] text-caption-gray">
              Club-Hub is built for a laptop screen while we lay out the small-screen
              edition. Come back on something wider and everything will be waiting.
            </p>
          </div>
        </FlowSheet>
      </div>
    </div>
  );
}
