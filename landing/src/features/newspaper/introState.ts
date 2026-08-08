/**
 * Whether the delivery animation should play.
 *
 * It is a first-impression, not a loading screen, and the difference matters:
 * anything that covers the page until someone presses a key makes Largest
 * Contentful Paint depend on human reaction time. So it plays ONCE per session,
 * opens itself after a beat whether or not anyone touches it, and gets out of
 * the way of every reader who did not come here to watch it.
 */

const KEY = "clubhub:intro-seen";

/** How long the roll waits on the desk before opening itself. Long enough to
 *  read as an invitation, short enough that a reader who ignored it is not
 *  waiting on it. */
export const INTRO_AUTO_OPEN_MS = 2500;

export function shouldPlayIntro(): boolean {
  if (typeof window === "undefined") return false;

  // Someone who followed `/#the-league-table` asked for that page. Opening a
  // title sequence over it and then scrolling them somewhere else is a bug from
  // where they are standing.
  if (window.location.hash) return false;

  // Reduced-motion readers are already routed to plain mode by readingMode.ts;
  // this is belt and braces for the case where they have explicitly chosen the
  // newspaper anyway.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;

  try {
    if (window.sessionStorage.getItem(KEY)) return false;
  } catch {
    /* private mode — play it, and it simply replays on a hard reload */
  }

  return true;
}

export function markIntroSeen() {
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    /* nothing to do; the in-session component state still prevents a replay */
  }
}
