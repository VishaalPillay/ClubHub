"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";

/**
 * The send-off animation for a member action: the confirmation folds into a sealed
 * letter, sprouts wings, flaps, and flies off-screen.
 *
 *   tone="angel" → paper feathered wings + blue seal  (promote / good news)
 *   tone="devil" → red jagged bat wings + red seal    (kick / bad news)
 *
 * Everything is inline SVG — no image assets, no animation library beyond
 * framer-motion (already a dependency). Wings are separate elements precisely so
 * each can flap on its own transform.
 *
 * Motion is tween-only per the design system (DESIGN-wired: no springs). The two
 * eases below are plain cubic-beziers; EASE_BACK overshoots slightly, which gives the
 * wing-sprout its pop without reaching for a spring.
 *
 * Honors prefers-reduced-motion: skips the flight entirely and calls onDone at once,
 * so the parent still advances its state machine.
 */

const EASE_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1];
const EASE_BACK: [number, number, number, number] = [0.34, 1.4, 0.64, 1];

/** Total time from mount to onDone, in seconds (fold is handled by the parent). */
const SPROUT = 0.26;
const FLIGHT = 1.0;

type Tone = "angel" | "devil";

/**
 * One right-facing wing, drawn in a 76x52 box with the shoulder at the left edge so a
 * scaleX(-1) mirror produces the left wing.
 *
 * Angel: four tapered feathers fanned from a common shoulder pivot — reads unmistakably
 * as a wing while staying soft and rounded.
 * Devil: a single angular membrane with clawed finger points — sharp where the angel
 * is smooth, which is what carries the "bad news" read.
 */
function Wing({ tone }: { tone: Tone }) {
  if (tone === "devil") {
    return (
      <svg width="76" height="52" viewBox="0 0 76 52" fill="none" aria-hidden="true">
        {/* Jagged bat membrane: out to the tip, then scalloped back along the fingers. */}
        <path
          d="M2 30 L70 6 L56 22 L72 26 L48 34 L56 48 L30 39 L26 50 L4 34 Z"
          fill="#dc2626"
          stroke="#7f1d1d"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Finger struts — the internal bat-wing bones. */}
        <path
          d="M6 31 L62 12 M8 33 L54 31 M10 35 L44 41"
          stroke="#7f1d1d"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
    );
  }

  // Angel: fan of feathers, longest on top. Each is the same tapered petal, rotated
  // about the shoulder (2, 30) and scaled by length.
  const feathers: { rotate: number; length: number }[] = [
    { rotate: -26, length: 1.0 },
    { rotate: -9, length: 0.92 },
    { rotate: 8, length: 0.8 },
    { rotate: 24, length: 0.66 },
  ];
  return (
    <svg width="76" height="52" viewBox="0 0 76 52" fill="none" aria-hidden="true">
      {feathers.map((f, i) => (
        <path
          key={i}
          d="M0 0 Q34 -7 66 -2 Q36 7 0 6 Z"
          fill="#f5f2ec"
          stroke="#1a1a1a"
          strokeWidth="2"
          strokeLinejoin="round"
          transform={`translate(4 30) rotate(${f.rotate}) scale(${f.length} 1)`}
        />
      ))}
    </svg>
  );
}

/** The sealed letter itself — WIRED-square envelope, wax seal tinted by tone. */
function Envelope({ tone }: { tone: Tone }) {
  const seal = tone === "angel" ? "#057DBC" : "#dc2626";
  return (
    <svg width="132" height="86" viewBox="0 0 132 86" fill="none" aria-hidden="true">
      <rect
        x="2"
        y="2"
        width="128"
        height="82"
        fill="#f5f2ec"
        stroke="#1a1a1a"
        strokeWidth="3"
      />
      {/* Flap crease */}
      <path d="M2 2 L66 50 L130 2" stroke="#1a1a1a" strokeWidth="3" fill="none" />
      {/* Lower folds, lighter — depth without a shadow (the system forbids shadows). */}
      <path d="M2 84 L48 44 M130 84 L84 44" stroke="#1a1a1a" strokeWidth="1.5" opacity="0.35" />
      {/* Wax seal + direction glyph: up for a promotion, down for a removal. */}
      <circle cx="66" cy="56" r="13" fill={seal} stroke="#1a1a1a" strokeWidth="2.5" />
      <path
        d={tone === "angel" ? "M66 62 L66 50 M61 55 L66 50 L71 55" : "M66 50 L66 62 M61 57 L66 62 L71 57"}
        stroke="#f5f2ec"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default function WingedLetter({
  tone,
  onDone,
}: {
  tone: Tone;
  /** Fired once the letter has flown off, so the parent can close + toast. */
  onDone: () => void;
}) {
  const reduce = useReducedMotion();

  // Reduced motion: no flight at all — hand control straight back to the parent.
  useEffect(() => {
    if (reduce) onDone();
  }, [reduce, onDone]);
  if (reduce) return null;

  // The wings beat while the letter climbs; angel flaps a touch slower than devil.
  const beat = tone === "angel" ? 0.34 : 0.26;
  const wingFlap = {
    rotate: [0, -22, 6, -18, 2, -14],
    transition: {
      duration: beat * 5,
      times: [0, 0.2, 0.4, 0.6, 0.8, 1],
      ease: EASE_OUT,
      delay: SPROUT * 0.6,
    },
  };

  return (
    <motion.div
      className="relative flex items-center justify-center pointer-events-none"
      // Flight: a small anticipatory dip, then up-and-away with a lean into the turn.
      animate={{
        y: [0, 14, -140, -680],
        x: [0, 0, 26, 150],
        rotate: [0, -3, 8, 20],
        scale: [1, 1.05, 0.92, 0.4],
        opacity: [1, 1, 1, 0],
      }}
      transition={{
        duration: FLIGHT,
        times: [0, 0.12, 0.45, 1],
        ease: EASE_OUT,
        delay: SPROUT * 0.5,
      }}
      onAnimationComplete={onDone}
    >
      {/* Left wing (mirrored) */}
      <motion.div
        className="absolute right-[74%] origin-bottom-right"
        style={{ scaleX: -1 }}
        initial={{ opacity: 0, scale: 0.3, rotate: 8 }}
        animate={{ opacity: 1, scale: 1, ...wingFlap }}
        transition={{ duration: SPROUT, ease: EASE_BACK }}
      >
        <Wing tone={tone} />
      </motion.div>

      {/* Right wing */}
      <motion.div
        className="absolute left-[74%] origin-bottom-left"
        initial={{ opacity: 0, scale: 0.3, rotate: 8 }}
        animate={{ opacity: 1, scale: 1, ...wingFlap }}
        transition={{ duration: SPROUT, ease: EASE_BACK }}
      >
        <Wing tone={tone} />
      </motion.div>

      <Envelope tone={tone} />
    </motion.div>
  );
}

/** How long the parent should wait before treating the flight as finished (ms). */
export const FLIGHT_TOTAL_MS = Math.round((SPROUT * 0.5 + FLIGHT) * 1000);
