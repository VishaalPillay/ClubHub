/**
 * World units and framing for the 3D desk.
 *
 * ── The unit ─────────────────────────────────────────────────────────────────
 * 1 world unit = one page width. Everything else is expressed against that, so
 * the scene is resolution-independent and the numbers stay readable.
 *
 * ── Why the camera looks DOWN ────────────────────────────────────────────────
 * The CSS version cheated: the page faced you square-on while a wooden desk sat
 * flat behind it, which works only because CSS has no real space to contradict
 * it. In actual 3D that cheat falls apart immediately — and it also leaves hands
 * nowhere sensible to come from.
 *
 * So the paper lies FLAT on the desk (the XZ plane) and the camera looks down at
 * it from a seated eye position. That is both physically honest and what makes
 * first-person hands possible: they reach in from the bottom of frame, which is
 * where your own hands are.
 *
 * The angle is a compromise, and it is the one number most worth tuning. Steeper
 * (nearer 90°) reads less like sitting at a desk; shallower foreshortens the
 * page until the text stops being readable. 62° keeps the depth axis at
 * cos(28°) ≈ 0.88 — a shortening you barely notice while reading.
 */

/** Page aspect, carried over from the CSS design (792 / 574). */
export const PAGE_ASPECT = 1.38;

export const PAGE_W = 1;
export const PAGE_H = PAGE_W * PAGE_ASPECT;

/** An open spread is two leaves side by side, bound down the middle. */
export const SPREAD_W = PAGE_W * 2;

/** Camera elevation above the desk plane, degrees. */
export const CAMERA_PITCH_DEG = 66;

/** Vertical field of view. Long lens, matching the old `perspective: 2200px`
 *  which worked out to about 23°. A wide lens on a plane this close keystones
 *  the far edge hard enough to hurt legibility. */
export const CAMERA_FOV = 23;

/** How much of the frame the spread may occupy, as a fraction of the half-extent
 *  in normalised device coordinates. Below 1 by enough to leave desk visible
 *  around the paper and to clear the controls bar along the bottom. */
export const SPREAD_FRAME_FILL = 0.74;

/** Camera position for a distance, on the pitch above. Always looks at origin. */
export function cameraPositionFor(distance: number): [number, number, number] {
  const pitch = (CAMERA_PITCH_DEG * Math.PI) / 180;
  return [0, distance * Math.sin(pitch), distance * Math.cos(pitch)];
}

/**
 * The four corners of a fully open spread, on the desk plane.
 *
 * Used to frame the camera. It has to be the corners and not the width, because
 * the sheet is lying DOWN: its 1.38 units of depth project to a large and very
 * asymmetric vertical extent — the near edge is closer to the lens and therefore
 * magnified — and none of that is visible to a calculation that only knows how
 * wide the spread is. Framing on width alone ran the bottom of the page straight
 * off the screen.
 */
export const SPREAD_CORNERS: readonly [number, number, number][] = [
  [-PAGE_W, 0, -PAGE_H / 2],
  [PAGE_W, 0, -PAGE_H / 2],
  [-PAGE_W, 0, PAGE_H / 2],
  [PAGE_W, 0, PAGE_H / 2],
];

/**
 * A single page, centred — the closed front and back covers.
 *
 * Framed separately because a closed paper is half the width of an open one, and
 * a camera parked at spread distance leaves the front page marooned in the middle
 * of the frame at half size. The front page is the most important page in the
 * edition; it should fill the view. The camera pulls back as the paper opens,
 * which also gives the delivery animation somewhere to land.
 */
export const PAGE_CORNERS: readonly [number, number, number][] = [
  [-PAGE_W / 2, 0, -PAGE_H / 2],
  [PAGE_W / 2, 0, -PAGE_H / 2],
  [-PAGE_W / 2, 0, PAGE_H / 2],
  [PAGE_W / 2, 0, PAGE_H / 2],
];

/**
 * The whole table — the establishing framing, used while the paper is closed.
 *
 * Deliberately not the page. A closed front cover framed tight fills the screen
 * with paper and the table might as well not exist; framed on the table you see
 * all four edges against the room, which is the shot that says "this is an
 * object on a surface". The camera then pushes IN as the spread opens, because
 * by then the scene is established and legibility matters more than context.
 *
 * Kept in sync with TABLE_W / TABLE_D in Table.tsx by hand — they are the same
 * measurement, and there is no import that would not be circular.
 */
export const TABLE_CORNERS: readonly [number, number, number][] = [
  [-3.05 / 2, 0, -2.15 / 2],
  [3.05 / 2, 0, -2.15 / 2],
  [-3.05 / 2, 0, 2.15 / 2],
  [3.05 / 2, 0, 2.15 / 2],
];


/**
 * Depth budget, in world units above the desk.
 *
 * The CSS version measured this in px against a `lift` curve peaking at z ≈ 64;
 * here it is real space. A turning leaf arcs up to LEAF_LIFT, so anything that
 * must stay in front of it — the mug, and the hand at the moment it grips —
 * sits above that. Hands deliberately cross it: dropping below LEAF_LIFT mid-turn
 * is what puts fingers behind the lifting page.
 */
export const LEAF_LIFT = 0.22;
export const COFFEE_Y = 0;
export const HAND_NEAR_Y = LEAF_LIFT + 0.06;

/** Paper tones, carried over so the 3D scene and the plain document agree. */
export const PAPER = "#f5f2ec";
export const DESK_BASE = "#6b4a2f";
