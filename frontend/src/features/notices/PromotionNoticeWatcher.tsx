"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ackNotice, listNotices } from "@/lib/api/notices";
import { humanizeRole } from "@/lib/roles";
import type { PromotionNotice } from "@/types/api";
import ConfettiBurst from "@/features/notices/ConfettiBurst";
import RainOverlay from "@/features/notices/RainOverlay";

/**
 * Mounted once, inside AuthProvider, so it's alive on every page of the app — a
 * promotion can land while the recipient is anywhere, not just on the members page
 * of the club that promoted them.
 *
 * Polls like the portal's pending-requests list (10s), but pauses while a notice is
 * on screen so a second one can't queue up behind it and pop immediately after —
 * `ackNotice` clears the one just shown, and the next poll picks up whatever's next.
 */
export default function PromotionNoticeWatcher() {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<PromotionNotice | null>(null);
  // Outlives `active` by design: the modal closes the instant "Nice!"/"Got It" is
  // clicked (that's `active` going null), but the confetti/rain shouldn't just cut
  // out at the same moment — it keeps rendering, told to wind down via `dismissed`,
  // until its own onSettled says the last piece has actually finished falling.
  const [overlayKind, setOverlayKind] = useState<"promote" | "demote" | null>(null);
  // Guards against showing the same notice twice — e.g. a window-focus refetch landing
  // a split second after the interval one, both still seeing the row because the first
  // ack's DELETE hasn't committed yet, each independently trying to surface it. A ref
  // (not state) so it survives without triggering a re-render, and — same reason —
  // survives React's dev-mode double-invoke of this effect on mount.
  const shownIds = useRef<Set<number>>(new Set());

  const { data: notices = [] } = useQuery({
    queryKey: ["promotion-notices"],
    queryFn: listNotices,
    refetchInterval: 10_000,
    enabled: !active,
  });

  useEffect(() => {
    if (active) return;
    const next = notices.find((n) => !shownIds.current.has(n.id));
    if (!next) return;
    shownIds.current.add(next.id);
    // Ack right away — this is a one-shot hand-off, not an inbox entry, so there's
    // nothing to gain by waiting for the user to dismiss it first. Surfacing it is
    // the callback off that external call, not a synchronous set in the effect body.
    ackNotice(next.id)
      .catch(() => {})
      .finally(() => {
        setActive(next);
        setOverlayKind(next.kind);
      });
  }, [notices, active]);

  const dismiss = () => {
    setActive(null);
    queryClient.invalidateQueries({ queryKey: ["promotion-notices"] });
  };

  const isDemote = active?.kind === "demote";
  // Amber for demote (matches the Demote button's color elsewhere in the app) vs the
  // existing promote blue — kept off red, which the winged-letter flight already owns
  // for "kick" specifically, so demote reads as its own, milder tone.
  const accent = isDemote ? "#d97706" : "#057DBC";

  return (
    <>
      {overlayKind === "demote" && (
        <RainOverlay dismissed={!active} onSettled={() => setOverlayKind(null)} />
      )}
      {overlayKind === "promote" && (
        <ConfettiBurst dismissed={!active} onSettled={() => setOverlayKind(null)} />
      )}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] } }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
          >
            {/* Entrance keeps a slight overshoot for pop; exit is a plain fast fade —
                reusing the bouncy entrance curve on the way out read as a hesitation
                right at the moment of dismissal instead of a clean, immediate close. */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: { duration: 0.22, ease: [0.34, 1.4, 0.64, 1] } }}
              exit={{ scale: 0.92, opacity: 0, transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] } }}
              className="bg-paper border-2 border-black w-full max-w-md flex flex-col"
            >
              <div className="bg-black px-4 py-3">
                <span className="text-paper font-mono text-12 uppercase tracking-widest">
                  {isDemote ? "Demotion" : "Promotion"}
                </span>
              </div>
              <div className="p-8 flex flex-col items-center text-center gap-4">
                <span
                  className="material-symbols-outlined text-[48px]"
                  style={{ color: accent }}
                >
                  {isDemote ? "trending_down" : "military_tech"}
                </span>
                <h2 className="font-display text-[32px] font-bold leading-[0.95]">
                  {isDemote ? "You’ve been demoted." : "You’ve been promoted!"}
                </h2>
                <p className="font-ui text-16">
                  You are now <strong>{humanizeRole(active.new_role)}</strong> in{" "}
                  <strong>{active.club_name}</strong>.
                </p>
                {active.message && (
                  <p className="font-ui text-14 text-caption-gray border-t border-[#e0d0b6] pt-4 w-full italic">
                    &ldquo;{active.message}&rdquo;
                  </p>
                )}
                <button
                  onClick={dismiss}
                  className="mt-2 font-ui text-14 font-bold border-2 border-black bg-black text-paper px-8 py-3 uppercase hover:bg-paper hover:text-black transition-colors w-full"
                >
                  {isDemote ? "Got It" : "Nice!"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
