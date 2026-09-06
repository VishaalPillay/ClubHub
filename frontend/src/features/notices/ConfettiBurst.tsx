"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * The promotion pop-up's background. Plain divs + framer-motion rather than a canvas
 * library — a hundred-odd falling rectangles is cheap enough that a real confetti
 * engine would be overkill.
 *
 * Loops for as long as the pop-up is mounted (like RainOverlay) rather than firing
 * once and settling. The per-piece `delay` spans a full cycle's worth of time (not
 * just a fraction of one), so pieces are already spread across every phase of the
 * fall from the very first frame — without that, everything starts within the same
 * fraction of a second and reads as one synchronized "burst" that only settles into
 * a natural continuous rain once pieces start drifting out of sync on their own,
 * several seconds in.
 *
 * On dismiss (`dismissed=true`), pieces don't just vanish. Rather than trying to
 * retarget an animation that's already mid-flight — framer-motion's behavior there
 * isn't something to depend on — each piece is handed a fresh one-shot finishing pass:
 * it remounts (new `key`) with `initial` set to wherever along the fall it plausibly
 * already was, then animates the rest of the way down once, no repeat. `onSettled`
 * fires once every piece has had time to finish that pass, the parent's cue that it's
 * finally safe to unmount this for real.
 *
 * Honors prefers-reduced-motion by rendering nothing — the pop-up message alone still
 * carries the news.
 */
const COLORS = ["#057DBC", "#dc2626", "#f5b400", "#1a1a1a", "#16a34a"];

export default function ConfettiBurst({
  count = 130,
  dismissed = false,
  onSettled,
}: {
  count?: number;
  dismissed?: boolean;
  onSettled?: () => void;
}) {
  const reduce = useReducedMotion();

  // Randomized once via a lazy initializer, not during render itself — a plain
  // `useMemo(() => ...Math.random()...)` runs its factory on every render React
  // Compiler might replay, which is exactly what a lazy `useState` initializer is
  // built to avoid (it's guaranteed to run exactly once, on mount).
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 4.5,
      duration: 3.6 + Math.random() * 2.2,
      spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360),
      drift: (Math.random() - 0.5) * 220,
      width: 6 + Math.random() * 6,
      height: 10 + Math.random() * 8,
      color: COLORS[i % COLORS.length],
    }))
  );

  // Captured once, the instant dismissal happens: each piece's "already partway down"
  // look for its final pass. The remaining duration is that piece's own full duration
  // scaled by how much distance is actually left (`p.duration * (1 - fromVh/100)`) —
  // its original falling speed, just for a shorter remaining trip — not an arbitrary
  // fixed number, so a piece near the top still takes a while and one near the bottom
  // finishes almost immediately, same as it would have mid-loop.
  const [finishing, setFinishing] = useState<{ fromVh: number; duration: number }[] | null>(
    null
  );

  useEffect(() => {
    if (!dismissed || finishing) return;
    // Deferred to a callback rather than called synchronously in the effect body —
    // this is a one-time response to `dismissed` flipping, not a derived value.
    const id = setTimeout(() => {
      setFinishing(
        pieces.map((p) => {
          const fromVh = Math.random() * 100;
          return { fromVh, duration: p.duration * (1 - fromVh / 100) };
        })
      );
    }, 0);
    return () => clearTimeout(id);
  }, [dismissed, finishing, pieces]);

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
      {pieces.map((p, i) => {
        const f = finishing?.[i];
        return (
          <motion.span
            key={f ? `${p.id}-finish` : p.id}
            initial={
              f
                ? { y: `${f.fromVh}vh`, x: p.drift * (f.fromVh / 100), rotate: p.spin * (f.fromVh / 100), opacity: 1 }
                : { y: "-10vh", x: 0, rotate: 0, opacity: 1 }
            }
            animate={
              f
                ? { y: "110vh", opacity: 0 }
                : { y: "110vh", x: p.drift, rotate: p.spin, opacity: [1, 1, 0] }
            }
            transition={
              f
                ? { duration: f.duration, ease: "easeIn" }
                : { duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeIn" }
            }
            style={{
              position: "absolute",
              left: `${p.left}%`,
              top: 0,
              width: p.width,
              height: p.height,
              backgroundColor: p.color,
            }}
          />
        );
      })}
    </div>
  );
}
