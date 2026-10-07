/**
 * The boot script's verdict on this device and connection (bootScript.ts), read back
 * for React. Deliberately not recomputed here: the boot script ran before first paint
 * and everything — the CSS, the reading mode — already acts on what it wrote.
 */

export type Tier = "high" | "mid" | "low";

export function readTier(): Tier {
  const t = document.documentElement.dataset.npTier;
  return t === "mid" || t === "low" ? t : "high";
}

/** A test override is in force (`clubhub:force-tier`): the watchdogs stand down, so a
 *  screenshot script running the scene on software GL is not switched to plain. Set
 *  `clubhub:watchdog` to "on" as well to test the watchdogs themselves. */
export function watchdogsEnabled(): boolean {
  if (!document.documentElement.hasAttribute("data-np-forced")) return true;
  try {
    return window.localStorage.getItem("clubhub:watchdog") === "on";
  } catch {
    return false;
  }
}

/** The connection reported under 5 Mbps (bootScript.ts): download less, render the same. */
export function slowNet(): boolean {
  return document.documentElement.dataset.npNet === "slow";
}

type NetInfo = { saveData?: boolean; effectiveType?: string };

/**
 * Which room clip, if any.
 *
 *   full   1080p (1.8 MB) — a high tier on a screen big enough to show it, on a
 *          connection that is not flagged slow
 *   light  720p (250 KB) — everyone else
 *   still  none; the poster stays — Data Saver, or a 2G link. The poster is the clip's
 *          own first frame, so the room is still there, just not moving.
 *
 * Never decided from `connection.downlink` on its own: Chrome's figure starts around
 * 1.5 Mbps on a fresh session (it has measured nothing yet) while rating the same link
 * "4g" — that low guess is how a fast laptop on good wifi lost the room video.
 */
export function roomVideoFor(tier: Tier): "full" | "light" | "still" {
  const c = (navigator as Navigator & { connection?: NetInfo }).connection;
  if (c?.saveData || /(^|-)2g$/.test(c?.effectiveType ?? "")) return "still";
  const bigScreen = window.innerWidth * window.devicePixelRatio >= 1900;
  return tier === "high" && bigScreen && !slowNet() ? "full" : "light";
}
