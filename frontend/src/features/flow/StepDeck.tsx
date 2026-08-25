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

/** The 3D depth of the vanishing point. Lower = more exaggerated foreshortening. */
const PERSPECTIVE = 1400;

/**
 * The step transition: a calendar-leaf flip.
 *
 * Continuing replaces the outgoing step with a rotation around its own
 * horizontal centre line — the same motion as a desk flip-calendar or a flip
 * clock's digit, not a page sliding across. `mode="wait"` means the outgoing
 * leaf finishes rotating to edge-on (and away) before the next one starts from
 * edge-on and rotates flat, so the two read as one continuous turn rather than
 * a cut: forward carries the same rotational sense all the way through, and
 * going back reverses it — the leaf turns the other way and settles back into
 * place, mirroring the direction it flipped forward in.
 *
 * The brightness dip at the edge-on midpoint is doing real work, not just
 * decoration: a flat 2D rotation with no shading reads as a stretch, not a
 * turn, because there's nothing marking the moment the leaf is perpendicular to
 * the screen. A real flipped card darkens there because it's catching the light
 * edge-on; this borrows that cue.
 *
 * `perspective` has to live on a wrapper that survives the swap — AnimatePresence
 * unmounts the outgoing motion.div the instant its exit finishes, so if the
 * rotating element carried its own `perspective` the vanishing point would reset
 * between the two halves of the flip and the leaf would look like it changed
 * geometry mid-turn.
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
    // Vestibular-safe: cross-fade only, no rotation and no depth.
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

  // Forward and back are mirror-image rotations, not the same motion run in
  // reverse — "flipped back" needs to read as a distinct, opposite turn, the
  // way flipping a real calendar leaf forward vs. lifting it back does.
  const sign = direction === "forward" ? 1 : -1;

  const settle: Transition = { duration: 0.46, ease: [0.16, 0.84, 0.32, 1] };
  const lift: Transition = { duration: 0.3, ease: [0.4, 0, 1, 1] };

  return (
    <div className={className} style={{ perspective: PERSPECTIVE }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={stepKey}
          initial={{ opacity: 0, rotateX: sign * 92, filter: "brightness(0.78)" }}
          animate={{
            opacity: 1,
            rotateX: 0,
            filter: "brightness(1)",
            transition: settle,
          }}
          exit={{
            opacity: 0,
            rotateX: sign * -92,
            filter: "brightness(0.78)",
            transition: lift,
          }}
          className="h-full"
          style={{ transformOrigin: "50% 50%", backfaceVisibility: "hidden" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
