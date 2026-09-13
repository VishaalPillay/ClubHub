"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * The demote pop-up's background — a continuous, looping rain rather than a one-shot
 * burst like ConfettiBurst. A promotion is a single event to celebrate; a demotion's
 * gloom is meant to read as ambient for as long as the pop-up sits on screen, so each
 * drop repeats itself indefinitely instead of firing once and settling.
 *
 * On dismiss (`dismissed=true`), drops don't just vanish. Each one's *actual*
 * position is reconstructed from wall-clock time elapsed since mount (`mountedAt`)
 * — not guessed — so its one-shot finishing pass picks up exactly where the loop
 * left off instead of jumping to a random new spot before falling the rest of the
 * way. `onSettled` fires once every drop has had time to finish that pass, the
 * parent's cue that it's finally safe to unmount this. Mirrors ConfettiBurst.
 *
 * Honors prefers-reduced-motion by rendering nothing — the pop-up message alone still
 * carries the news.
 */
const RAIN_COLOR = "#5b6b76";

type FinishState = { y: number; x: number; opacity: number; remaining: number };

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

  // Wall-clock mount time — lets a drop's exact position at any later instant be
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
        drops.map((d) => {
          if (elapsed < d.delay) {
            // Hasn't started its first fall yet — still waiting at the top.
            return { y: -15, x: 0, opacity: 0, remaining: 0.2 };
          }
          const timeInLoop = (elapsed - d.delay) % d.duration;
          const linearT = timeInLoop / d.duration; // the loop itself eases linearly
          // Opacity keyframes are [0, peak, peak, 0] over evenly-spaced thirds.
          let opacity: number;
          if (linearT < 1 / 3) opacity = (linearT / (1 / 3)) * d.peakOpacity;
          else if (linearT < 2 / 3) opacity = d.peakOpacity;
          else opacity = d.peakOpacity * (1 - (linearT - 2 / 3) / (1 / 3));
          return {
            y: -15 + linearT * 130,
            x: linearT * d.drift,
            opacity,
            remaining: Math.max(d.duration * (1 - linearT), 0.15),
          };
        })
      );
    }, 0);
    return () => clearTimeout(id);
  }, [dismissed, finishing, drops, mountedAt]);

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
      {drops.map((d, i) => {
        const f = finishing?.[i];
        return (
          <motion.span
            key={f ? `${d.id}-finish` : d.id}
            initial={f ? { y: `${f.y}vh`, x: f.x, opacity: f.opacity } : { y: "-15vh", opacity: 0 }}
            animate={
              f
                ? { y: "115vh", x: d.drift, opacity: 0 }
                : { y: "115vh", x: d.drift, opacity: [0, d.peakOpacity, d.peakOpacity, 0] }
            }
            transition={
              f
                ? { duration: f.remaining, ease: "linear" }
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
