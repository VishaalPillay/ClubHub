/**
 * World units and the shared scroll curve for the 3D scene.
 *
 * 1 world unit = one page width. Everything else is expressed against that, so
 * the scene is resolution-independent and the numbers stay readable.
 *
 * This module imports NOTHING, deliberately: NewspaperShell and RoomBackdrop
 * read from it on the main bundle, and an import of three here would pull the
 * whole renderer out of the dynamic chunk and undo the code split.
 *
 * There is no camera framing in here any more. The clip films the table, so the
 * camera is fixed to the fit solved by `npm run clip:fit` and lives with the
 * rest of the room's numbers in roomLight.ts.
 */

/** Page aspect, carried over from the CSS design (792 / 574). */
export const PAGE_ASPECT = 1.38;

export const PAGE_W = 1;
export const PAGE_H = PAGE_W * PAGE_ASPECT;

/**
 * How open the paper is: 0 on either cover, 1 everywhere between.
 *
 * Three things run on this curve — the paper's float toward the reader, the
 * room's defocus, and the veil that dims it. They must share one definition or
 * they visibly drift apart, which is the whole reason it lives in the module
 * that imports nothing.
 *
 * Smoothed, because a move that starts and stops abruptly reads as a yank.
 */
export function openness(pos: number, turns: number, lead: number) {
  const steps = turns + lead * 2;
  const travel = Math.max(lead, 0.5);
  const t = Math.min(Math.max(Math.min(pos / travel, (steps - pos) / travel), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Camera position for a distance and pitch. Always looks near the origin. */
export function cameraPositionFor(distance: number, pitchDeg: number): [number, number, number] {
  const pitch = (pitchDeg * Math.PI) / 180;
  return [0, distance * Math.sin(pitch), distance * Math.cos(pitch)];
}
