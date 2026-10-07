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

/* ── The folder ──────────────────────────────────────────────────────────────
   The edition is kept in a kraft folder (Folder.tsx): a back board, a stack of
   other documents with tabs, the four leaves on top, and a front cover hinged at
   the spine and held shut by an elastic cord round a button. All in the same
   page-width units, with the spine at x = 0 and the desk at y = 0. */

/** How far the boards overhang the pages on the three open sides. */
export const FOLDER_MARGIN = 0.045;
/** Board width and depth: the page plus the overhang (none on the spine side). */
export const FOLDER_W = PAGE_W + FOLDER_MARGIN;
export const FOLDER_H = PAGE_H + FOLDER_MARGIN * 2;
/** Board thickness — both boards. Thick enough to read as board, not card: the edge
 *  shows, and it carries the laminated look of pressed kraft. */
export const BOARD_T = 0.0085;
/** The other documents in the folder, under the edition on the right. */
export const STACK_T = 0.034;
/** Where the deck of page cards rests: on the stack of other documents. */
export const LEAF_BASE_RIGHT = BOARD_T + STACK_T;

/**
 * Share of each END step (the lead-in and the lead-out) spent on the folder itself,
 * at the step's inner end — after the lift has brought it to the reader at the start,
 * before it is set down at the end:
 *
 *   lead-in:   [0, 0.55)  the SHUT folder lifts to the reader and the room falls away
 *              [0.55, 1]  in front of them the cord comes off and the cover opens
 *   lead-out:  [0, 0.45]  the cover swings back over the deck and the cord goes back on
 *              (0.45, 1]  the SHUT folder is set back down on the desk
 *
 * You are handed the folder, then you open it; you close it, then you put it down.
 */
export const FOLDER_SHARE = 0.45;

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

/** Opening at the front: 0 shut … 1 open, over the inner end of the lead-in. */
export function folderProgress(pos: number, lead: number) {
  if (lead <= 0) return 1;
  return clamp01((pos / lead - (1 - FOLDER_SHARE)) / FOLDER_SHARE);
}

/** Closing at the back: 0 open … 1 shut, over the inner end of the lead-out. */
export function closeProgress(pos: number, turns: number, lead: number) {
  if (lead <= 0) return 0;
  const steps = turns + lead * 2;
  return clamp01((pos - (steps - lead)) / lead / FOLDER_SHARE);
}

const smooth01 = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Within the opening: the cord comes off the button first… */
export const cordRelease = (f: number) => smooth01(0.0, 0.42, f);
/** …and the cover swings open after it, overlapping its tail so the two read as one
 *  gesture. 0 shut on top of the pages, 1 lying open. */
export const coverOpen = (f: number) => smooth01(0.3, 1.0, f);
/** Within the closing: the cover swings back over the deck… */
export const coverClose = (c: number) => smooth01(0.0, 0.72, c);
/** …and then the cord goes back round the button. */
export const cordHook = (c: number) => smooth01(0.6, 1.0, c);
/** How open the cover is at a scroll position: 0 shut … 1 lying open, opening over the
 *  lead-in and closing over the lead-out. Folder.tsx swings the cover by it, and the
 *  reading pose slides the edition across by it (NewspaperScene `READ_SHIFT`), so the
 *  two can never disagree. */
export function coverOpenness(pos: number, turns: number, lead: number) {
  return coverOpen(folderProgress(pos, lead)) * (1 - coverClose(closeProgress(pos, turns, lead)));
}
/** The pages' resting bow, held flat while a board is anywhere near them — a bowed
 *  edge goes straight through a shut cover. */
export const pageBow = (f: number, c: number) => smooth01(0.55, 0.92, f) * (1 - smooth01(0.0, 0.35, c));

/**
 * How lifted the folder is: 0 lying on the desk, 1 up at the reader.
 *
 * Three things run on this curve — the folder's float toward the reader, the room's
 * defocus, and the veil that dims it. They must share one definition or they
 * visibly drift apart, which is the whole reason it lives in the module that imports
 * nothing.
 *
 * It finishes BEFORE the folder opens and starts only AFTER it has closed (see
 * FOLDER_SHARE): the whole folder comes to the reader shut, and goes back shut.
 *
 * Smoothed, because a move that starts and stops abruptly reads as a yank.
 */
export function openness(pos: number, turns: number, lead: number) {
  const steps = turns + lead * 2;
  const travel = Math.max(lead, 0.5);
  const d = Math.min(pos / travel, (steps - pos) / travel);
  const span = lead > 0 ? 1 - FOLDER_SHARE : 1;
  const t = clamp01(d / span);
  return t * t * (3 - 2 * t);
}

/** Camera position for a distance and pitch. Always looks near the origin. */
export function cameraPositionFor(distance: number, pitchDeg: number): [number, number, number] {
  const pitch = (pitchDeg * Math.PI) / 180;
  return [0, distance * Math.sin(pitch), distance * Math.cos(pitch)];
}
