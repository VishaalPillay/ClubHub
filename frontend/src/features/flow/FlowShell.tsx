"use client";

import { Wordmark } from "@/components/ui/Wordmark";
import { LANDING_URL } from "@/lib/urls";
import CollageBackdrop from "@/features/flow/CollageBackdrop";

// The collage treatment. Every rule in it is scoped to a `.flow-*` or
// `.mobile-gate` class, so although the root layout now pulls it in too (the
// small-screen gate needs it on every route), nothing it contains can reach a
// page that does not opt in by using those classes.
import "@/features/flow/collage.css";

/**
 * The one masthead for every full-page flow: the (public) auth pages, club
 * onboarding, and the join flow.
 *
 * Before this existed, the same <header> was pasted into eight files — the five
 * onboarding steps, join-flow, and AuthShell — which had already drifted into
 * three different wordmark widths (210 / 225 / 240px) and two different
 * copyright years. `right` is the only thing that legitimately differs between
 * them: a signed-out flow puts a Login/Register link there, a signed-in one puts
 * the avatar badge.
 *
 * The shell deliberately does NOT constrain content width. The steps it wraps
 * want genuinely different measures (a two-card chooser wants ~1024px, a single
 * text field wants ~600px), so each one declares its own inside `children`.
 */
export default function FlowShell({
  right,
  children,
}: {
  /** Masthead right-hand slot — an avatar badge when signed in, a link when not. */
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="text-black min-h-screen flex flex-col">
      <CollageBackdrop />

      {/* The masthead is opaque paper: it sits ON the collage rather than in it,
          which is what keeps the wordmark legible at any scrap density. */}
      <header className="relative z-10 flex justify-between items-center w-full px-6 py-4 bg-paper border-b-2 border-black">
        {/* Leaves this origin for the marketing site — a plain <a>, not next/link. */}
        <a href={LANDING_URL} className="no-underline block">
          <Wordmark className="w-[210px]" />
        </a>
        {right}
      </header>

      {/* items-center keeps the sheet vertically centred, so the size difference
          between two steps expands symmetrically instead of yanking the page up.

          There is deliberately NO footer here. Footers belong to the app proper;
          a flow is one uninterrupted surface, and the collage runs to the bottom
          edge of the viewport. */}
      <main className="relative z-10 flex-grow flex items-center justify-center w-full max-w-[1600px] mx-auto px-6 py-12">
        {children}
      </main>
    </div>
  );
}
