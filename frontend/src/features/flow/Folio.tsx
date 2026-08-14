"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;

/**
 * The step marker that replaced the progress bars.
 *
 * Four different bar idioms used to live across these flows (three of them faking
 * their fill with a `setTimeout` after mount). None of them are here any more —
 * the movement between steps is what communicates progress now. But dropping the
 * indicator entirely would leave someone mid-flow with no idea how much is left,
 * so this keeps the orientation and throws away the machinery: a newspaper folio
 * line, set in roman numerals, over a hairline.
 *
 * The numeral is keyed so it re-stamps on each step change rather than silently
 * swapping.
 */
export default function Folio({
  step,
  total,
  label,
}: {
  step: number;
  total: number;
  /**
   * Optional. Pass it for flows whose steps have no eyebrow of their own (club
   * creation); leave it off where each step already names itself (the register
   * and join wizards) rather than printing the name twice.
   */
  label?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <div className="w-full mb-8">
      <div className="flex justify-between items-baseline gap-4 mb-1.5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={label ?? ""}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="font-mono text-[11px] uppercase tracking-[2px] text-caption-gray"
          >
            {label}
          </motion.span>
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={step}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.5, rotate: -4 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 0.84, 0.32, 1] }}
            className="font-mono text-[11px] uppercase tracking-[2px] text-black font-bold whitespace-nowrap"
          >
            {ROMAN[step] ?? step} <span className="text-caption-gray">/ {ROMAN[total] ?? total}</span>
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="w-full h-px bg-hairline-tint" />
    </div>
  );
}
