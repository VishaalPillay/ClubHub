"use client";

import Link from "next/link";

import { Wordmark } from "@/components/ui/Wordmark";
import { LANDING_URL } from "@/lib/urls";

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
    <div className="bg-paper text-black min-h-screen flex flex-col">
      <header className="flex justify-between items-center w-full px-6 py-4 bg-paper border-b-2 border-black">
        {/* Leaves this origin for the marketing site — a plain <a>, not next/link. */}
        <a href={LANDING_URL} className="no-underline block">
          <Wordmark className="w-[210px]" />
        </a>
        {right}
      </header>

      {/* items-center keeps the deck vertically centred, so the height change
          between two steps expands symmetrically instead of yanking the page up. */}
      <main className="flex-grow flex items-center justify-center w-full max-w-[1600px] mx-auto px-6 py-12">
        {children}
      </main>

      <footer className="bg-ink text-paper font-mono text-xs uppercase w-full flex flex-col md:flex-row justify-between items-center gap-4 px-8 py-10 mt-auto">
        <div className="text-paper font-black tracking-widest text-center md:text-left">
          © 2026 CLUB-HUB EDITORIAL. ALL RIGHTS RESERVED.
        </div>
        <div className="flex flex-wrap justify-center gap-6 tracking-widest">
          <Link href="#" className="text-ink-dim hover:text-paper underline">Privacy</Link>
          <Link href="#" className="text-ink-dim hover:text-paper underline">Terms</Link>
          <Link href="#" className="text-ink-dim hover:text-paper underline">Contact</Link>
        </div>
      </footer>
    </div>
  );
}
