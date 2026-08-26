"use client";

import Link from "next/link";
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
  fill = false,
  logoHref = LANDING_URL,
  children,
}: {
  /** Masthead right-hand slot — an avatar badge when signed in, a link when not. */
  right?: React.ReactNode;
  /**
   * Where the wordmark goes. Defaults to the marketing site — right for a
   * signed-out visitor (auth pages), wrong for someone already signed in: the
   * onboarding and join-flow wizards pass `/portal` instead, so the one
   * navigation element in their header doesn't strand a signed-in user on the
   * marketing site. A leading `/` renders as a `next/link` (client-side,
   * in-app); anything else renders as a plain `<a>`, same as the hardcoded
   * landing link this replaced — leaving the app's origin shouldn't go through
   * the router.
   */
  logoHref?: string;
  /**
   * Pin the flow to exactly one screen: the shell is `100dvh`, nothing scrolls,
   * and `children` gets the leftover box between the masthead and the bottom
   * edge to fill (see `.flow-stage` in collage.css).
   *
   * Opt-in rather than the default, because it changes the contract for the
   * content: in fill mode a step MUST fit the box instead of the page growing
   * to fit the step. Every full-page flow (onboarding, join, and the register/
   * login wizards behind `AuthShell`) is built for that now; a shell that isn't
   * — nothing currently — would keep the flowing `min-h-screen` layout by
   * leaving this off.
   */
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`text-black flex flex-col ${
        fill ? "h-[100dvh] overflow-hidden" : "min-h-screen"
      }`}
    >
      <CollageBackdrop />

      {/* The masthead is opaque paper: it sits ON the collage rather than in it,
          which is what keeps the wordmark legible at any scrap density. */}
      <header className="relative z-10 flex justify-between items-center w-full px-6 py-4 bg-paper border-b-2 border-black shrink-0">
        {logoHref.startsWith("/") ? (
          <Link href={logoHref} className="no-underline block">
            <Wordmark className="w-[185px]" />
          </Link>
        ) : (
          // Leaves this origin for the marketing site — a plain <a>, not next/link.
          <a href={logoHref} className="no-underline block">
            <Wordmark className="w-[185px]" />
          </a>
        )}
        {right}
      </header>

      {/* items-center keeps the sheet vertically centred, so the size difference
          between two steps expands symmetrically instead of yanking the page up.
          In fill mode there is no size difference left to absorb — the sheet is
          the box — but the centring is what keeps a capped sheet (`.flow-stage`
          stops growing at 780px) sitting in the middle of a tall window.

          There is deliberately NO footer here. Footers belong to the app proper;
          a flow is one uninterrupted surface, and the collage runs to the bottom
          edge of the viewport. */}
      <main
        className={`relative z-10 flex items-center justify-center w-full max-w-[1600px] mx-auto px-6 ${
          fill
            ? // The minimum is the reach of a fill sheet's drop shadow (8px down,
              // 16px blur), which `overflow-hidden` on the shell would otherwise
              // crop in a straight line across the collage.
              "flex-1 min-h-0 py-[clamp(24px,3vh,40px)]"
            : "flex-grow py-12"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
