"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * The demote pop-up's background — a continuous, looping rain rather than a one-shot
 * burst like ConfettiBurst. A promotion is a single event to celebrate; a demotion's
 * gloom is meant to read as ambient for as long as the pop-up sits on screen, so each
 * drop repeats itself indefinitely instead of firing once and settling.
 *
 * On dismiss (`dismissed=true`), drops don't just vanish. Rather than trying to
 * retarget an animation that's already mid-flight — framer-motion's behavior there
 * isn't something to depend on — each drop is handed a fresh one-shot finishing pass:
 * it remounts (new `key`) with `initial` set to wherever along the fall it plausibly
 * already was, then animates the rest of the way down once, no repeat. `onSettled`
 * fires once every drop has had time to finish that pass, the parent's cue that it's
 * finally safe to unmount this. Mirrors ConfettiBurst.
 *
 * Honors prefers-reduced-motion by rendering nothing — the pop-up message alone still
 * carries the news.
 */
const RAIN_COLOR = "#5b6b76";

export default function RainOverlay({
  count = 130,
  dismissed = false,
  onSettled,
}: {
  count?: number;
  dismissed?: boolean;
  onSettled?: () => void;
}) {
  const reduce = useReducedMotion();

  // Lazy initializer, not a render-time useMemo — see ConfettiBurst for why: it must
  // run exactly once, on mount, not be replayed by every render.
  const [drops] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 1.3 + Math.random() * 1.1,
      length: 16 + Math.random() * 26,
      peakOpacity: 0.22 + Math.random() * 0.34,
      drift: (Math.random() - 0.5) * 24,
    }))
  );

  // Captured once, the instant dismissal happens: each drop's "already partway down"
  // look for its final pass. The remaining duration is that drop's own full duration
  // scaled by how much distance is actually left — its original falling speed, just
  // for a shorter remaining trip.
  const [finishing, setFinishing] = useState<{ fromVh: number; duration: number }[] | null>(
    null
  );

  useEffect(() => {
    if (!dismissed || finishing) return;
    // Deferred to a callback rather than called synchronously in the effect body —
    // this is a one-time response to `dismissed` flipping, not a derived value.
    const id = setTimeout(() => {
      setFinishing(
        drops.map((d) => {
          const fromVh = Math.random() * 100;
          return { fromVh, duration: d.duration * (1 - fromVh / 100) };
        })
      );
    }, 0);
    return () => clearTimeout(id);
  }, [dismissed, finishing, drops]);

  // A ref, not a dependency: `onSettled` is typically a fresh inline closure from the
  // parent on every render, and depending on it directly would reset the timer below
  // on every one of those renders — this way the effect only reacts to `finishing`.
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  });

  useEffect(() => {
    if (!finishing) return;
    const settleMs = Math.max(...finishing.map((f) => f.duration)) * 1000;
    const timer = setTimeout(() => onSettledRef.current?.(), settleMs);
    return () => clearTimeout(timer);
  }, [finishing]);

  if (reduce) return null;

  return (
    <div className="fixed inset-0 z-[199] overflow-hidden pointer-events-none" aria-hidden="true">
      {drops.map((d, i) => {
        const f = finishing?.[i];
        return (
          <motion.span
            key={f ? `${d.id}-finish` : d.id}
            initial={f ? { y: `${f.fromVh}vh`, x: d.drift * (f.fromVh / 100), opacity: d.peakOpacity } : { y: "-15vh", opacity: 0 }}
            animate={
              f
                ? { y: "115vh", opacity: 0 }
                : { y: "115vh", x: d.drift, opacity: [0, d.peakOpacity, d.peakOpacity, 0] }
            }
            transition={
              f
                ? { duration: f.duration, ease: "linear" }
                : { duration: d.duration, delay: d.delay, repeat: Infinity, ease: "linear" }
            }
            style={{
              position: "absolute",
              left: `${d.left}%`,
              top: 0,
              width: 2,
              height: d.length,
              borderRadius: 2,
              backgroundColor: RAIN_COLOR,
            }}
          />
        );
      })}
    </div>
  );
}
