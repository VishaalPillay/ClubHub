"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";

export type FlowDirection = "forward" | "back";

/**
 * Step state for a single-route wizard, tracking which way the last move went so
 * the deck can mirror its animation.
 *
 * The direction is kept in a ref as well as state because `go` is a stable
 * callback: reading `step` from the closure would compare against a stale value
 * the first time a step handler is reused across renders.
 */
export function useFlowStep<T extends number>(initial: T) {
  const [step, setStep] = useState<T>(initial);
  const [direction, setDirection] = useState<FlowDirection>("forward");
  const current = useRef<T>(initial);

  const go = useCallback((next: T) => {
    setDirection(next >= current.current ? "forward" : "back");
    current.current = next;
    setStep(next);
  }, []);

  /** Jump without animating — for restoring a resumed session on mount. */
  const jump = useCallback((next: T) => {
    current.current = next;
    setStep(next);
  }, []);

  return { step, direction, go, jump };
}

/**
 * The step transition: a sheet lifted off a pad.
 *
 * The outgoing step tilts, rises and fades; the incoming one drops in from the
 * other side and settles flat. It replaces the four different progress-bar
 * idioms the flows used to carry — the movement itself is the progress
 * indicator, with `Folio` supplying the numbers for orientation.
 *
 * `mode="wait"` (matching the register wizard's existing behaviour) means the
 * outgoing sheet finishes leaving before the next arrives, so the two never
 * overlap and neither needs to be absolutely positioned.
 *
 * Rotation is deliberately tiny — a degree either way. Paper on a desk shifts;
 * it doesn't spin.
 */
export default function StepDeck({
  stepKey,
  direction,
  children,
  className = "",
}: {
  /** Changing this key is what triggers the transition. */
  stepKey: string | number;
  direction: FlowDirection;
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    // Vestibular-safe: cross-fade only, no travel and no rotation.
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={stepKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className={className}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    );
  }

  const away = direction === "forward" ? -1 : 1;

  const settle: Transition = { duration: 0.38, ease: [0.16, 0.84, 0.32, 1] };
  const lift: Transition = { duration: 0.24, ease: [0.4, 0, 1, 1] };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, y: -away * 26, rotate: -away * 0.8, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, rotate: 0, scale: 1, transition: settle }}
        exit={{ opacity: 0, y: away * 18, rotate: away * 1.2, scale: 1.015, transition: lift }}
        className={className}
        style={{ transformOrigin: "50% 50%" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
