import type { ReadingMode } from "./NewspaperContext";

/**
 * The reading-mode store.
 *
 * Whether the newspaper should animate depends on three things React cannot know
 * while rendering on the server: `prefers-reduced-motion`, a stored preference,
 * and any explicit in-session choice. That is precisely an external store, so it
 * is read with `useSyncExternalStore` rather than synced into state from an
 * effect — no cascading render, no hydration mismatch, and the server snapshot
 * is authoritative for the crawlable document.
 *
 * `getServerSnapshot` returns "plain", so the SSR document is always the eight
 * plain articles. Everything else is an upgrade applied after hydration.
 */

/** Also read by the pre-paint boot script — see bootScript.ts. */
export const READING_MODE_KEY = "clubhub:reading-mode";
const KEY = READING_MODE_KEY;
const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * Below this the 3D scene is not offered at all.
 *
 * Not a layout judgement — a cost one. Paper mode now means three.js plus eight
 * page textures, and on a mid-range phone that is a large download and a warm
 * battery to read eight pages of text that the plain document renders instantly
 * and reflows properly. Plain mode is genuinely the better experience on a
 * handset, so it is the default there rather than the consolation prize.
 */
export const MIN_WIDTH = 1024;

/** Testing only: `localStorage["clubhub:force-tier"] = "high" | "mid" | "low"` overrides the
 *  device check (so screenshot scripts can run the scene under software GL) and turns the
 *  watchdogs off. Read by the boot script, which marks <html data-np-forced>. */
export const FORCE_TIER_KEY = "clubhub:force-tier";

/** Set for the rest of the session when the scene had to give way — see failScene. */
export const SCENE_FAILED_KEY = "clubhub:scene-failed";

/**
 * Can this browser actually run the scene?
 *
 * WebGL2 specifically: three.js has been WebGL2-only since r163, and a WebGL1-only
 * machine passing this check is a machine that gets a blank canvas. Probed once and
 * cached: creating a context is not free, and `getReadingMode` is called on every
 * store read.
 */
let webglOk: boolean | null = null;

function hasWebGL2(): boolean {
  if (webglOk !== null) return webglOk;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    webglOk = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglOk = false;
  }
  return webglOk;
}

/** Why the scene gave way this session, if it did. */
let failed: string | null = null;

/**
 * Failures that say something about THIS LOAD, not this machine, so they are not
 * remembered (see failScene): a first frame that was late, a slow stretch (a busy moment,
 * DevTools open), a lost GPU context (a driver reset recovers; a fresh page gets a fresh
 * context). Earlier builds DID store them, and a tab's sessionStorage is copied into tabs
 * opened from it (duplicate, ctrl+click), so a stored one is dropped on sight rather than
 * honoured — the boot script does the same. What is still remembered is deterministic:
 * a render error or missing files, which a reload would only hit again.
 */
export const TRANSIENT_FAILURES = ["ready-timeout", "frame-rate", "context-lost"];

function sceneFailed(): boolean {
  if (failed) return true;
  try {
    const stored = window.sessionStorage.getItem(SCENE_FAILED_KEY);
    if (stored && TRANSIENT_FAILURES.includes(stored)) {
      window.sessionStorage.removeItem(SCENE_FAILED_KEY);
      return false;
    }
    return Boolean(stored);
  } catch {
    return false;
  }
}

/**
 * The scene could not carry on — an error, a lost GPU context, a page that will not
 * load, or a frame rate the machine cannot hold. Switch to the plain document, which
 * always works, and remember it for the session so a reload does not walk the reader
 * into the same wall twice. Not persisted beyond the session: a driver update or a
 * better connection tomorrow deserves another try.
 *
 * A TRANSIENT_FAILURES reason switches this page to plain and leaves a reload free to
 * try again. Remembering those is how a single slow load — or opening DevTools — used to
 * cost the reader the scene for the whole session.
 */
export function failScene(reason: string) {
  if (failed) return;
  failed = reason;
  if (!TRANSIENT_FAILURES.includes(reason)) {
    try {
      window.sessionStorage.setItem(SCENE_FAILED_KEY, reason);
    } catch {
      /* the in-memory flag still applies */
    }
  }
  console.info(`[landing] 3D scene off (${reason}); showing the plain edition.`);
  emit();
}

let override: ReadingMode | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setReadingMode(mode: ReadingMode) {
  override = mode;
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    /* private mode — the in-memory override still applies for this session */
  }
  emit();
}

export function subscribeReadingMode(onChange: () => void) {
  listeners.add(onChange);
  const reduced = window.matchMedia(REDUCED);
  const narrow = window.matchMedia(`(width < ${MIN_WIDTH}px)`);
  reduced.addEventListener("change", emit);
  narrow.addEventListener("change", emit);
  return () => {
    listeners.delete(onChange);
    reduced.removeEventListener("change", emit);
    narrow.removeEventListener("change", emit);
  };
}

/**
 * The scene has been shown on this page. From then on the width gate no longer applies:
 * MIN_WIDTH is a COST judgement (see above), and on a machine that has already loaded and
 * is running the scene that cost is paid. A desktop window narrowing for a moment —
 * DevTools docked to the side, a window snapped to half the screen — used to tear the
 * scene down and rebuild it from scratch when it widened again.
 */
let paperShown = false;

export function getReadingMode(): ReadingMode {
  const mode = decideReadingMode();
  if (mode === "paper") paperShown = true;
  return mode;
}

function decideReadingMode(): ReadingMode {
  /* Hard gates first, and they outrank a stored preference: someone who chose
     the newspaper on a desktop and later opened the site on a phone, or turned
     reduced-motion on since, should not be handed a scene their device or their
     settings have ruled out. */
  if (window.matchMedia(REDUCED).matches) return "plain";
  if (!paperShown && window.matchMedia(`(width < ${MIN_WIDTH}px)`).matches) return "plain";
  if (!hasWebGL2()) return "plain";
  // The boot script's verdict on this device and connection (bootScript.ts).
  if (document.documentElement.dataset.npTier === "low") return "plain";
  if (sceneFailed()) return "plain";

  if (override) return override;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "plain" || stored === "paper") return stored;
  } catch {
    /* ignore */
  }
  return "paper";
}

export function getServerReadingMode(): ReadingMode {
  return "plain";
}
