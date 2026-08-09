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

/**
 * Can this browser actually run the scene?
 *
 * Probed once and cached: creating a context is not free, and `getReadingMode`
 * is called on every store read. A failure here is not exotic — blocked WebGL,
 * a software renderer that has been blacklisted, or a machine that has simply
 * run out of contexts are all real.
 */
let webglOk: boolean | null = null;

function hasWebGL(): boolean {
  if (webglOk !== null) return webglOk;
  try {
    const canvas = document.createElement("canvas");
    webglOk = Boolean(
      canvas.getContext("webgl2") ??
        canvas.getContext("webgl") ??
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    webglOk = false;
  }
  return webglOk;
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

export function getReadingMode(): ReadingMode {
  /* Hard gates first, and they outrank a stored preference: someone who chose
     the newspaper on a desktop and later opened the site on a phone, or turned
     reduced-motion on since, should not be handed a scene their device or their
     settings have ruled out. */
  if (window.matchMedia(REDUCED).matches) return "plain";
  if (window.matchMedia(`(width < ${MIN_WIDTH}px)`).matches) return "plain";
  if (!hasWebGL()) return "plain";

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
