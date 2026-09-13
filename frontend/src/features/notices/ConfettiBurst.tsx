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
 * On dismiss (`dismissed=true`), pieces don't just vanish. Each one's *actual*
 * position is reconstructed from wall-clock time elapsed since mount (`mountedAt`)
 * — not guessed — so its one-shot finishing pass picks up exactly where the loop
 * left off instead of jumping to a random new spot before falling the rest of the
 * way. `onSettled` fires once every piece has had time to finish that pass, the
 * parent's cue that it's finally safe to unmount this for real.
 *
 * Honors prefers-reduced-motion by rendering nothing — the pop-up message alone still
 * carries the news.
 */
const COLORS = ["#057DBC", "#dc2626", "#f5b400", "#1a1a1a", "#16a34a"];

type FinishState = { y: number; x: number; rotate: number; opacity: number; remaining: number };

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

  // Wall-clock mount time — lets a piece's exact position at any later instant be
  // reconstructed (elapsed time modulo its cycle) instead of guessed at. A lazy
  // `useState` initializer, not `useRef(Date.now())` — `useRef` has no lazy form,
  // so its argument is evaluated (impurely) on every render even though only the
  // first result is kept.
  const [mountedAt] = useState(() => Date.now());

  const [finishing, setFinishing] = useState<FinishState[] | null>(null);

  useEffect(() => {
    if (!dismissed || finishing) return;
    // Deferred to a callback rather than called synchronously in the effect body —
    // this is a one-time response to `dismissed` flipping, not a derived value.
    const id = setTimeout(() => {
      const elapsed = (Date.now() - mountedAt) / 1000;
      setFinishing(
        pieces.map((p) => {
          if (elapsed < p.delay) {
            // Hasn't started its first fall yet — still waiting at the top.
            return { y: -10, x: 0, rotate: 0, opacity: 1, remaining: 0.3 };
          }
          const timeInLoop = (elapsed - p.delay) % p.duration;
          const linearT = timeInLoop / p.duration;
          const eased = linearT * linearT; // approximates the loop's own "easeIn"
          const opacity = linearT < 0.5 ? 1 : 1 - (linearT - 0.5) / 0.5;
          return {
            y: -10 + eased * 120,
            x: eased * p.drift,
            rotate: eased * p.spin,
            opacity,
            remaining: Math.max(p.duration * (1 - linearT), 0.2),
          };
        })
      );
    }, 0);
    return () => clearTimeout(id);
  }, [dismissed, finishing, pieces, mountedAt]);

  // A ref, not a dependency: `onSettled` is typically a fresh inline closure from the
  // parent on every render, and depending on it directly would reset the timer below
  // on every one of those renders — this way the effect only reacts to `finishing`.
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  });

  useEffect(() => {
    if (!finishing) return;
    const settleMs = Math.max(...finishing.map((f) => f.remaining)) * 1000;
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
                ? { y: `${f.y}vh`, x: f.x, rotate: f.rotate, opacity: f.opacity }
                : { y: "-10vh", x: 0, rotate: 0, opacity: 1 }
            }
            animate={
              f
                ? { y: "110vh", x: p.drift, rotate: p.spin, opacity: 0 }
                : { y: "110vh", x: p.drift, rotate: p.spin, opacity: [1, 1, 0] }
            }
            transition={
              // Linear for the finishing pass, not "easeIn" again — restarting an
              // ease-in curve partway through would decelerate then reaccelerate
              // right at the handoff, a little hitch on top of an already-short trip.
              f
                ? { duration: f.remaining, ease: "linear" }
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
