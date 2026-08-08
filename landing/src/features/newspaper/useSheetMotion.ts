"use client";

import { useTransform, type MotionValue } from "framer-motion";

/**
 * All MotionValue maths for one sheet, kept out of the component so the curves
 * are readable and tweakable in one place.
 *
 * Everything derives from `pos` (the continuous page position owned by
 * NewspaperShell). MotionValue subscriptions bypass React entirely, so nothing
 * here causes a render — the sheets re-render only when the discrete page index
 * changes, at most seven times over the whole scroll.
 */

/** Dead-linear across the middle 88% — that's the "1:1 with my scroll" feel —
 *  with a short ease at each end so the sheet peels off the stack and settles
 *  onto the pile rather than snapping flat.
 *  Do NOT wrap any of this in useSpring: it introduces lag against the scrubbing
 *  finger, which reads as the paper being detached from the scroll. */
const ROT_IN = [0, 0.06, 0.94, 1];
const ROT_OUT = [0, -3, -177, -180];

/**
 * @param turnStart `pos` at which this leaf begins to turn. On a wide screen one
 *   step is one spread, so leaf k turns over [k, k+1]. On a narrow screen one
 *   step is one PAGE — you read the verso before panning to the next recto — so
 *   leaf k turns over [2k, 2k+1] and then nothing turns for a step.
 */
export function useSheetMotion(pos: MotionValue<number>, turnStart: number, depth: number) {
  /** Local turn progress: 0 = flat and unread, 1 = fully turned onto the pile.
   *  useTransform clamps to the output range by default, which also absorbs
   *  iOS rubber-band overscroll driving `pos` outside [0, steps]. */
  const p = useTransform(pos, [turnStart, turnStart + 1], [0, 1]);

  const rotateY = useTransform(p, ROT_IN, ROT_OUT);

  /** Asymmetric lift. Paper leaves the stack fast (you pinch the corner), peaks
   *  just past the midpoint, then settles slowly. The resting value is +2, not
   *  0 — a turned sheet lies ON the discard pile, not back in the stack. */
  const lift = useTransform(p, [0, 0.18, 0.52, 0.82, 1], [0, 46, 64, 34, 2]);

  /**
   * Stack seat.
   *
   * Unread sheets MUST rest at exactly z=0 — coplanar with the parked sheets
   * behind them, so `z-index` breaks the tie in DOM order. Seating them at a
   * negative z instead put the live sheet *behind* its parked neighbours (which
   * have `transform: none`, i.e. z=0), so page 3 showed through under page 1.
   *
   * Turned sheets sit at +2, above the whole unread stack — and the one that
   * just turned ends at +4, so it lands on top of the pile rather than under it.
   */
  const seat = depth < 0 ? 2 : 0;
  const z = useTransform(lift, (v) => v + seat);

  /** Hand-turned jitter. A real dropped sheet never lands square. */
  const rotate = useTransform(p, [0, 0.5, 1], [0, -0.6, -1.4]);

  /** Recto shading — only meaningful below p=0.5; past that `backface-visibility`
   *  hides this face entirely and the curve stops mattering. */
  const frontShade = useTransform(p, [0, 0.18, 0.5], [0, 0.08, 0.46]);

  /** Verso shading — the back has been face-down against the desk, so it enters
   *  almost black and lightens. Never returns to 0: piled sheets stay "in
   *  shadow" relative to the lit top sheet. */
  const backShade = useTransform(p, [0.5, 0.74, 1], [0.86, 0.34, 0.14]);

  /** Cast shadow sweeping RIGHT across the page beneath. Longest at ~35° of
   *  turn, gone by the time the sheet is edge-on. scaleX + opacity only —
   *  never width, never filter, both of which would force paint every frame. */
  const castScaleX = useTransform(p, [0, 0.06, 0.3, 0.5, 0.58], [0, 0.18, 0.92, 0.3, 0]);
  const castOpacity = useTransform(p, [0, 0.06, 0.4, 0.56], [0, 0.5, 0.44, 0]);

  return { p, rotateY, z, rotate, frontShade, backShade, castScaleX, castOpacity };
}
