"use client";

import { useCallback, useEffect, useRef } from "react";
import { cancelFrame, frame, type MotionValue } from "framer-motion";
import Lenis from "lenis";

/**
 * Inertial scrolling for paper mode.
 *
 * Lenis is used in its NATIVE-SCROLL mode: it intercepts wheel input, applies a
 * lerp, and writes the result to the real `scrollTop`. That is the whole reason
 * it is the right tool here and a transform-based smooth-scroll (Locomotive v4
 * and friends) is not — `.np-stage` is `position: sticky`, which a translated
 * scroll container breaks outright, and `useScroll` keeps reading true scroll
 * position, so `pos` and every sheet curve in useSheetMotion.ts are untouched.
 *
 * Only ever constructed in paper mode. Plain mode is where reduced-motion,
 * print and no-JS land, and none of them should get momentum scrolling.
 */

/** No scroll movement for this long counts as "the reader stopped pushing". */
const SETTLE_IDLE_MS = 140;

/** Closer to flat than this and settling would be visible work for no gain. */
const SETTLE_EPSILON = 0.02;

/** How long a settle takes, seconds. Long enough to read as a fall, short
 *  enough that a reader who immediately scrolls again does not fight it. */
const SETTLE_DURATION = 0.5;

/** Default duration for goTo/corner/keyboard jumps, seconds. */
const JUMP_DURATION = 0.9;

export interface ScrollToOpts {
  /** Skip the animation. Used for the boot-time deep link, where any animation
   *  would be a scroll the reader did not ask for. */
  immediate?: boolean;
  duration?: number;
}

export interface UseLenisArgs {
  enabled: boolean;
  /** Freeze the scroll without tearing Lenis down — used while the delivery
   *  animation is playing. Toggling `enabled` instead would destroy and rebuild
   *  the instance, losing the scroll position with it. */
  paused?: boolean;
  /** Continuous page position. The settle rounds this to the nearest page. */
  pos: MotionValue<number>;
  /** Highest valid page index. */
  steps: number;
  /** Document Y for a whole page index. Reads live layout every call, so it
   *  must be a stable callback over refs rather than a snapshot. */
  topForIndex: (i: number) => number;
}

export function useLenis({ enabled, paused = false, pos, steps, topForIndex }: UseLenisArgs) {
  const lenisRef = useRef<Lenis | null>(null);

  /**
   * Timestamp until which scrolling is OURS, not the reader's.
   *
   * A boolean flag would be the obvious choice and is the wrong one: Lenis
   * cancels a programmatic `scrollTo` the moment the reader touches the wheel,
   * so `onComplete` is not guaranteed to fire and the flag can stick on
   * forever — which silently kills the settle for the rest of the session.
   * A deadline cannot stick; `onComplete` just clears it early when it does fire.
   */
  const ownUntil = useRef(0);

  const scrollTo = useCallback((top: number, opts?: ScrollToOpts) => {
    const lenis = lenisRef.current;

    // Paper mode is set during render; this effect runs after it. A jump fired
    // in that gap still has to land.
    if (!lenis) {
      window.scrollTo({
        top,
        behavior: (opts?.immediate ? "instant" : "smooth") as ScrollBehavior,
      });
      return;
    }

    const duration = opts?.duration ?? JUMP_DURATION;
    ownUntil.current = performance.now() + (opts?.immediate ? 0 : duration * 1000 + 80);

    lenis.scrollTo(top, {
      duration,
      immediate: opts?.immediate ?? false,
      onComplete: () => {
        ownUntil.current = 0;
      },
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      /* Synthesised touch scrolling fights iOS's own momentum and rubber-band
         and is the single most common source of "this site feels broken on my
         phone". Native touch already has inertia; only the wheel needs help. */
      syncTouch: false,
    });
    lenisRef.current = lenis;

    /* Driven from framer's scheduler rather than a second requestAnimationFrame:
       one loop for the whole page, and Lenis writes scrollTop in `update` before
       anything downstream reads it back. `keepAlive` re-queues it every frame. */
    const tick = ({ timestamp }: { timestamp: number }) => lenis.raf(timestamp);
    frame.update(tick, true);

    /**
     * The settle — what replaces CSS `scroll-snap-type: y proximity`, which
     * cannot coexist with Lenis (the snap engine and the lerp both try to own
     * the same scrollTop and the page judders at every boundary).
     *
     * Rounding is unconditionally correct here in a way snap never was: there is
     * no readable state between pages. At pos 3.5 the sheet is edge-on. So the
     * only question is *when*, and the answer is "once the reader has stopped".
     */
    let idle: ReturnType<typeof setTimeout>;

    const settle = () => {
      const v = pos.get();
      const target = Math.round(v);
      if (target < 0 || target > steps) return;
      if (Math.abs(v - target) < SETTLE_EPSILON) return;
      scrollTo(topForIndex(target), { duration: SETTLE_DURATION });
    };

    const onScroll = () => {
      clearTimeout(idle);
      if (performance.now() < ownUntil.current) return;
      idle = setTimeout(settle, SETTLE_IDLE_MS);
    };

    lenis.on("scroll", onScroll);

    return () => {
      clearTimeout(idle);
      lenis.off("scroll", onScroll);
      cancelFrame(tick);
      lenis.destroy();
      lenisRef.current = null;
      ownUntil.current = 0;
    };
  }, [enabled, pos, steps, topForIndex, scrollTo]);

  /* Separate from the lifecycle effect on purpose: pausing must not rebuild the
     instance. Lenis also puts `.lenis-stopped` on <html> while stopped, which is
     what actually blocks native wheel and touch — see globals.css. */
  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;
    if (paused) lenis.stop();
    else lenis.start();
  }, [paused, enabled]);

  return scrollTo;
}
