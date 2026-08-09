"use client";

import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import dynamic from "next/dynamic";
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { NewspaperProvider, type NewspaperCtx } from "./NewspaperContext";
import {
  getReadingMode,
  getServerReadingMode,
  setReadingMode,
  subscribeReadingMode,
} from "./readingMode";
import { PAGES_PER_SHEET, rectoForSpread, spreadForPage, type EditionPage } from "./edition";
import PageControls from "./PageControls";
import RoomBackdrop from "./RoomBackdrop";
import { currentPhase, type Phase } from "../scene/timeOfDay";
import { useLenis } from "./useLenis";
import { useMediaQuery } from "./useMediaQuery";

/**
 * three.js touches `window` at import time and there is nothing in a WebGL scene
 * worth prerendering, so it is loaded client-side only. `ssr: false` is legal
 * here precisely because this file is a Client Component — Next rejects it in a
 * Server Component. The server keeps emitting plain mode either way.
 */
const NewspaperScene = dynamic(() => import("../scene/NewspaperScene"), { ssr: false });

/**
 * Starts the scene chunk downloading at module evaluation, not from an effect.
 *
 * `dynamic()` only begins fetching when the component first renders, which is
 * after hydration — so the largest download on the page queued behind the very
 * work it was waiting for, and the paper arrived seconds after the room. The
 * boot script has already decided reading mode by the time this file executes,
 * so the answer is available and there is nothing to wait for. Deduped by the
 * module registry, so `dynamic` still gets the same promise.
 */
if (typeof document !== "undefined" && document.documentElement.dataset.npMode === "paper") {
  void import("../scene/NewspaperScene");
}

/**
 * Contains a render error from the canvas tree — a class component, because
 * only class components can catch one.
 *
 * This is not decoration. In React 19 an uncaught render error unmounts the
 * ENTIRE root, so a single flaky 404 on a page texture — `useLoader` throws,
 * Suspense has nothing to resume — would take down the whole page: chrome,
 * articles, everything. Caught here, the same failure degrades to the room
 * video with no paper on the table, the hidden document still carrying all
 * eight pages, and the "Read as a plain page" switch still working.
 */
class SceneBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[landing] 3D scene failed; the plain document remains available.", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The state owner: scroll track, sticky stage, `pos`, the discrete page/leaf
 * indices, `mode`, keyboard navigation and deep links.
 *
 * `children` is the rendered output of sixteen Server Components (eight pages on
 * four leaves), handed across the RSC boundary as an opaque slot. This component
 * positions it and can never re-render it — which is what keeps the whole
 * edition at zero JS.
 *
 * The server renders plain mode. Paper mode is only ever switched on here, after
 * hydration, and only when motion is welcome. So the crawlable, no-JS,
 * reduced-motion and print documents are all the same complete document.
 *
 * ── TWO LAYOUTS, ONE MECHANIC ───────────────────────────────────────────────
 * `spread` (≥1024px) shows both leaves of the open pair, so ONE step is one
 * spread and four turns read all eight pages. Below that a two-page spread is
 * unreadable, so ONE step is one PAGE: you turn a leaf to reach its verso, then
 * pan across the spine to the next recto, and a turn happens on every other
 * step. `turnStart` in NewspaperSheet is what reconciles the two.
 */
export default function NewspaperShell({
  pages,
  sheetCount,
  children,
}: {
  pages: readonly EditionPage[];
  sheetCount: number;
  children: React.ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  /** Server snapshot is always "plain", so the SSR document is the eight plain
   *  articles. The client upgrades to "paper" on its first post-hydration read
   *  unless reduced-motion or a stored preference says otherwise. */
  const mode = useSyncExternalStore(
    subscribeReadingMode,
    getReadingMode,
    getServerReadingMode,
  );

  /** Matches the `@media (width < 1024px)` breakpoint in newspaper.css. */
  const spread = !useMediaQuery("(width < 1024px)");

  /**
   * Steps at each end where the CAMERA moves but nothing turns.
   *
   * Without this the first leaf begins turning on the very first scroll, while
   * the camera is still out at the establishing angle — so page one is never
   * legible at any scroll position, which rather defeats a front page. The
   * lead-in buys a whole step for the camera to come in and settle before
   * anything moves, and the lead-out gives it a step to pull back out over the
   * back cover.
   *
   * Zero outside paper mode, because there is no camera there to move.
   */
  const lead = mode === "paper" && spread ? 1 : 0;

  /** Steps that actually turn a leaf. Spread: one per leaf. Narrow: one per page. */
  const turns = spread ? sheetCount : pages.length - 1;

  const steps = turns + lead * 2;

  const [pos0, setPos0] = useState(0);
  const posRef = useRef(0);

  /**
   * Where we are heading, as opposed to where we are.
   *
   * `posRef` only advances when the scroll actually crosses the ±0.5 rounding
   * boundary, which with a 0.9s Lenis jump is about 450ms after the keypress. A
   * second Arrow press inside that window would therefore compute its target
   * from the OLD step and re-issue the jump we are already running — pressing
   * right twice quickly turned one page. Chaining off the intent fixes it, and
   * the two refs reconverge the moment the motion subscription fires.
   */
  const intentRef = useRef(0);
  const stepPx = useRef(0);

  /** The incoming deep link, captured on the FIRST render — before any effect
   *  can run. `useScroll`'s own layout effect fires a `pos` change during setup,
   *  which calls the replaceState below and rewrites the hash to `#front-page`;
   *  reading `location.hash` from inside an effect therefore always saw the
   *  rewritten value and every deep link resolved to page 1. */
  const [initialSlug] = useState(() =>
    typeof window === "undefined" ? "" : window.location.hash.slice(1),
  );

  /**
   * Which time of day the room and the light are set to.
   *
   * Resolved ONCE, here, and handed to both the video and the 3D scene — if
   * each looked at the clock itself they could disagree across an hour boundary
   * and you would get a table lit for morning standing in an evening room.
   *
   * Guarded on `window` because this project is statically exported: the
   * initialiser also runs at BUILD time, where `new Date()` is the build's
   * clock, not the visitor's. Safe only because every use of it is behind
   * `mode === "paper"`, which cannot be true until hydration has finished.
   */
  const [phase] = useState<Phase>(() =>
    typeof window === "undefined" ? "morning" : currentPhase(),
  );

  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  /** Continuous position in steps, 0 … steps. The only thing sheets subscribe
   *  to. */
  const pos = useTransform(scrollYProgress, [0, 1], [0, steps]);

  /**
   * Scroll position for a PAGE. Every caller — the corners, the section rule,
   * the teasers, the pager, deep links — speaks in page numbers and never has
   * to know which layout is running.
   */
  const posForPage = useCallback(
    (p: number) => (spread ? spreadForPage(p) : p) + lead,
    [spread, lead],
  );

  /** Measure one step's worth of scroll once per resize — never inside a motion
   *  subscription, which would thrash layout on every frame. */
  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    stepPx.current = (el.offsetHeight - window.innerHeight) / Math.max(1, steps);
  }, [steps]);

  /** Reads live layout on every call, so it stays a stable callback over refs
   *  rather than a value — useLenis re-runs its effect on identity change. */
  const topForStep = useCallback(
    (i: number) => (trackRef.current?.offsetTop ?? 0) + i * stepPx.current,
    [],
  );

  /** Inertial scrolling, and the settle that replaced CSS scroll-snap. Returns a
   *  scrollTo that falls back to the native one before Lenis has mounted. */
  const scrollTo = useLenis({
    enabled: mode === "paper",
    pos,
    steps,
    topForIndex: topForStep,
  });

  /**
   * Move by whole steps. This is what "previous" and "next" mean, and it is the
   * only correct way to express them on a spread: `goTo(page - 1)` from a recto
   * lands on that same spread's verso, which is the same scroll position, so
   * the button did nothing at all. Steps have no such ambiguity.
   */
  const goToStep = useCallback(
    (i: number, opts?: { behavior?: ScrollBehavior }) => {
      const target = Math.max(0, Math.min(steps, i));
      intentRef.current = target;

      if (mode !== "paper" || !trackRef.current) {
        const page = spread ? rectoForSpread(target) : target;
        document
          .getElementById(pages[page].slug)
          ?.scrollIntoView({ behavior: opts?.behavior ?? "smooth", block: "start" });
        posRef.current = target;
        setPos0(target);
        return;
      }

      // Still driven through the real scroll position — Lenis writes scrollTop
      // rather than transforming a container, so there is no parallel animation
      // system to desync from.
      scrollTo(topForStep(target), { immediate: opts?.behavior === "instant" });
    },
    [mode, pages, spread, steps, scrollTo, topForStep],
  );

  /** Relative move, chained off the pending target rather than the settled one
   *  so repeated clicks/presses accumulate instead of re-issuing the same jump. */
  const stepBy = useCallback((delta: number) => goToStep(intentRef.current + delta), [goToStep]);

  /** Jump to a specific PAGE — section links, teasers, dog-ears, deep links. */
  const goTo = useCallback(
    (p: number, opts?: { behavior?: ScrollBehavior }) => {
      const page = Math.max(0, Math.min(pages.length - 1, p));
      goToStep(posForPage(page), opts);
    },
    [pages.length, posForPage, goToStep],
  );

  /**
   * The CONTINUOUS scroll position the 3D scene reads, as a plain ref.
   *
   * Distinct from `posRef` above, which holds the rounded step and only moves at
   * page boundaries. The scene needs the fractional value — a leaf is half turned
   * at 0.5 — and it reads it every frame inside `useFrame`, where React must
   * never be involved: re-rendering the canvas tree sixty times a second for a
   * value only the render loop consumes would defeat the point of a render loop.
   * Same reasoning that kept the CSS version on MotionValues.
   */
  const scenePosRef = useRef(0);

  useMotionValueEvent(pos, "change", (v) => {
    scenePosRef.current = v;
  });

  /** Discrete step. `Math.round` gives free hysteresis at the ±0.5 boundary, so
   *  this fires at most `steps` times per full scroll rather than per frame. */
  useMotionValueEvent(pos, "change", (v) => {
    const next = Math.round(v);
    if (next === posRef.current || next < 0 || next > steps) return;
    posRef.current = next;
    intentRef.current = next;
    setPos0(next);
  });

  /** Page and leaf, derived from the discrete step for the current layout.
   *
   *  On a spread the recto leads the pair and is what gets announced and
   *  deep-linked; on a narrow screen the step IS the page. The leaf index is
   *  how many leaves have been turned, which is what a sheet's `depth` — and
   *  therefore the compositing budget — is measured against. */
  const turn = Math.min(Math.max(pos0 - lead, 0), turns);
  const page = spread ? rectoForSpread(turn) : turn;
  const sheet = spread ? turn : Math.floor((turn + 1) / PAGES_PER_SHEET);

  useEffect(() => {
    if (mode !== "paper") return;
    window.history.replaceState(null, "", `#${pages[page].slug}`);
  }, [mode, page, pages]);

  /** After the mode flip, measure and honour any incoming deep link.
   *
   *  No setState here: the scroll moves `pos`, and the motion subscription above
   *  derives the step from it — one source of truth.
   *
   *  Deliberately deferred by two frames rather than run inline. On the flip to
   *  paper the track grows from document flow to (steps+1)×100svh of sticky
   *  track, and framer's useScroll has its own resize observer; scrolling before
   *  it re-measures leaves `scrollYProgress` computed against the old metrics,
   *  so the deep link silently resolved to page 1. */
  useLayoutEffect(() => {
    if (mode !== "paper") return;

    /* Synchronously first, so a deep-link jump fired this same tick has a real
       step size to aim with; the deferred passes re-measure once framer's own
       resize observer has caught up with the track growing to its full sticky
       height. */
    measure();

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(measure);
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [mode, measure]);

  /**
   * Honour an incoming deep link — EXACTLY once.
   *
   * Kept apart from the measure above because this must not re-fire on layout
   * change. `steps`, `posForPage` and `goToStep` all change identity when the
   * viewport crosses 1024px, and while they were in the same effect, dragging a
   * window across that breakpoint re-ran the jump and yanked the reader back to
   * the page they had arrived on however far they had read.
   */
  const didDeepLink = useRef(false);
  useEffect(() => {
    if (mode !== "paper" || didDeepLink.current) return;
    didDeepLink.current = true;
    const p = pages.findIndex((x) => x.slug === initialSlug);
    if (p <= 0) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() =>
        goToStep(posForPage(p), { behavior: "instant" }),
      );
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [mode, pages, initialSlug, goToStep, posForPage]);

  useEffect(() => {
    if (mode !== "paper") return;
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(measure, 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [mode, measure]);

  /** Keyboard. Up/Down are deliberately NOT intercepted — native scroll drives
   *  the scrub, and hijacking them is what makes these pages feel broken.
   *
   *  These step by PAGE, not by spread: on a wide screen `goTo(page + 1)` from
   *  a recto lands on its own verso, which is the same spread, so the pager
   *  moves a whole pair at a time without any special case. */
  useEffect(() => {
    if (mode !== "paper") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      // page 8's FAQ is a <details>/<summary>; its native Space must survive.
      if (t?.closest?.("input, textarea, select, [contenteditable], summary")) return;

      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
          e.preventDefault();
          stepBy(1);
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          goToStep(posRef.current - 1);
          break;
        case " ":
          e.preventDefault();
          stepBy((e.shiftKey ? -1 : 1));
          break;
        case "Home":
          e.preventDefault();
          goToStep(0);
          break;
        case "End":
          e.preventDefault();
          goToStep(steps);
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, goToStep, stepBy, steps]);

  /* The pointer parallax that used to live here is gone with the CSS stack. It
     faked depth by sweeping `perspective-origin`; the scene now has real depth,
     and a camera nudge belongs in the scene rather than out here. */

  const ctx = useMemo<NewspaperCtx>(
    () => ({
      pos,
      page,
      index: page,
      sheet,
      step: pos0,
      steps,
      stepBy,
      count: pages.length,
      spread,
      mode,
      goTo,
      goToStep,
      setMode: setReadingMode,
    }),
    [pos, page, sheet, pos0, steps, stepBy, pages.length, spread, mode, goTo, goToStep],
  );

  /** "Pages 2–3 of 8" while a pair is open, "Page 1 of 8" on a closed cover. */
  const verso = page - 1;
  const announcement =
    spread && verso >= 0 && page < pages.length
      ? `Pages ${verso + 1}–${page + 1} of ${pages.length} — ${pages[page].title}`
      : `Page ${page + 1} of ${pages.length} — ${pages[page].title}`;

  return (
    <NewspaperProvider value={ctx}>
      <div
        className="np-scope"
        data-mode={mode}
        style={{ "--np-steps": steps } as React.CSSProperties}
      >
        {/* Both invisible until focused. The reading-mode switch lives here
            rather than in the controls bar: it is an escape hatch, not everyday
            furniture, and it has to exist somewhere. */}
        <div className="np-skiplinks">
          <a href="#np-end" className="np-skip">
            Skip the newspaper
          </a>
          <button
            type="button"
            className="np-skip"
            onClick={() => setReadingMode(mode === "paper" ? "plain" : "paper")}
          >
            {mode === "paper" ? "Read as a plain page" : "Read as a newspaper"}
          </button>
        </div>

        {mode === "paper" && (
          <motion.div className="np-progress" style={{ scaleX: scrollYProgress }} aria-hidden />
        )}

        <div ref={trackRef} className="np-track">
          <div
            className="np-stage"
            role={mode === "paper" ? "region" : undefined}
            aria-roledescription={mode === "paper" ? "newspaper" : undefined}
            aria-label={
              mode === "paper"
                ? `Club-Hub, the club operations paper — ${pages.length} pages`
                : undefined
            }
          >
            {mode === "paper" && (
              <>
                <RoomBackdrop pos={pos} steps={steps} lead={lead} phase={phase} />
                <SceneBoundary>
                  <NewspaperScene
                    posRef={scenePosRef}
                    turns={turns}
                    lead={lead}
                    phase={phase}
                  />
                </SceneBoundary>
              </>
            )}

            {/*
              The eight articles, ALWAYS rendered.

              In plain mode they are the page. In paper mode they are visually
              replaced by the canvas but stay in the DOM and in the accessibility
              tree, clipped to a pixel — because the 3D pages are textures, and a
              texture cannot be read by a screen reader, searched, or selected.
              Dropping them here would mean a reader using assistive technology
              got a canvas and nothing else.

              The "Read as a plain page" control above is the visible way out.
            */}
            <div className={mode === "paper" ? "np-sr" : "np-stack"}>{children}</div>
          </div>
        </div>

        <p className="np-sr" aria-live="polite">
          {mode === "paper" ? announcement : ""}
        </p>

        <PageControls />

        <div id="np-end" tabIndex={-1} />
      </div>
    </NewspaperProvider>
  );
}
