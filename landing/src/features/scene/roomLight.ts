/**
 * The room, and the light that has to match it.
 *
 * ── Why one module owns both ─────────────────────────────────────────────────
 * The backdrop is a video of a real room and the paper is shaded by a handful of
 * numbers. Those two layers read as ONE scene only if they agree about where the
 * light is coming from — and they read as a cutout the moment they don't.
 * Compositing does not fix that; matching the light does. So the clip, the
 * camera solved against its table, and the light rig are defined together, here.
 *
 * ── One clip, all day ────────────────────────────────────────────────────────
 * There used to be two — a morning room and a night one, chosen off the
 * visitor's clock, with an `evening` rig written but never reachable. That is
 * gone. The site shows the morning room at every hour, which means the light
 * rig, the camera, the fallback colours and the boot preloads are all constants
 * rather than a lookup, and there is no longer a way for the DOM layer and the
 * WebGL layer to disagree about what time it is. If a second room is ever wanted
 * back, it is a table keyed by clip name and a chooser — not a resurrection of
 * the hour logic, which was the part with the bugs in it.
 *
 * ── The deliberate cheat ─────────────────────────────────────────────────────
 * `paperTint` stays near white. Eight pages of small type are the only thing on
 * this page anyone has to be able to READ, so the paper is lit for legibility
 * first. Cinema lights faces brighter than physics allows for the same reason.
 */

/**
 * The camera and float path solved against the table IN the clip.
 *
 * The clip films a table, and that single fact shapes the whole scene:
 *
 *   · **No table is drawn.** The clip has one.
 *   · **The camera never moves.** It cannot. A video has no parallax, so any
 *     camera move slides the scene off the table it is supposed to be resting
 *     on, and the illusion dies in one frame.
 *   · **The paper moves instead** — it lifts off the clip's table and tilts up
 *     into the lens as you scroll. Which is the better mechanic anyway: it reads
 *     as picking the paper up rather than as the room rushing at you.
 *   · **The clip ships sharp**, because its first frame is the whole trick, and
 *     defocuses at runtime as the paper takes over the frame.
 *
 * The camera numbers are SOLVED, not chosen: `npm run clip:fit`. Nudging them by
 * hand puts the paper on a plane the table is not on.
 */
export interface ClipTable {
  pitch: number;
  fov: number;
  distance: number;
  /** Where the paper rests on the clip's table, and how big it sits. */
  rest: [number, number, number];
  restScale: number;
  /** Where it floats to, how far it tilts up toward the lens, and how big it
   *  reads — closed covers need more scale than an open spread. */
  read: [number, number, number];
  readTiltDeg: number;
  readScaleClosed: number;
  readScaleOpen: number;
}

export interface RoomLight {
  /** Where the key light sits, in world space. Every shader in the scene
   *  derives its shading — and the paper's shadow direction — from this. */
  dir: [number, number, number];
  /** Multiplied into the paper. Kept close to white — see above. */
  paperTint: string;
  /**
   * The window's light bars, thrown faintly across the paper.
   *
   * The room in the clip is full of hard bars from a window, and a page in that
   * room with perfectly even lighting reads as pasted on. `goboPeriod` is their
   * spacing in world units; the direction comes from `dir`, so they always run
   * the way the light does. Kept weak — legibility wins.
   */
  goboPeriod: number;
  goboPaper: number;
  /**
   * The paper's shadow on the table.
   *
   * Its DIRECTION is not configured — it is derived from `dir`, because a
   * shadow that does not fall away from the light is the single most obvious
   * way to give away that a scene is composited. These two set only its
   * character: direct sun through a window throws a strong shadow with a tight
   * penumbra.
   */
  shadowStrength: number;
  shadowPenumbra: number;
  /** The camera and float path solved against the clip's table. */
  clipTable: ClipTable;
}

/**
 * The one light rig, matched to `backdrop/morning.mp4`.
 *
 * Light direction measured off the clip rather than guessed — the bars of
 * window light on the floor run about 17° off vertical in frame, which pins the
 * key's horizontal bearing near x:z = 0.3:-1. An earlier eyeballed value doubled
 * that angle and threw the paper's shadow across at twice the slope of the
 * room's own. The negative z is the window: it is on the far side of the table,
 * not the camera's.
 */
export const ROOM_LIGHT: RoomLight = {
  dir: [1.3, 4.3, -4.3],
  paperTint: "#fff7ee",
  goboPeriod: 2.0,
  /* Weak: the paper stands up into the lens as it lifts, and world-XZ bars
     flatten to a near-constant tint once it does. Subtle is the only setting
     that survives both poses. */
  goboPaper: 0.09,
  // Direct sun through a window: dark, and crisp at the edge.
  shadowStrength: 0.62,
  shadowPenumbra: 0.1,
  clipTable: {
    /* Fitted to the tabletop in morning.mp4 — 0.6px RMS across its four
       corners, at an assumed table aspect of 0.58. That aspect had to come from
       outside the image (see scripts/fit-clip-table.mjs) and was cross-checked
       against a second, differently framed clip of the same physical table
       before that clip was retired: it fitted there too, within 3.9px. */
    pitch: 29.2,
    fov: 24.1,
    distance: 8.76,
    /* Sat a little forward of the table's true centre and a little under full
       size, so there is green visible behind the masthead. Dead centre at 0.93
       put the far edge flush with the back rail, which reads like it is about
       to slide off. */
    rest: [-0.02, 0.0, 0.4],
    restScale: 0.87,
    /* ON the view axis, not guessed: the camera aims at the origin, so the
       centre of frame at this depth is a specific world point, and setting the
       height by eye put the masthead off the top of the screen. */
    read: [0, 2.15, 3.8],
    /* How far it stands up to face a lens 29 degrees above the table. */
    readTiltDeg: 61,
    /* HEIGHT is what binds here, not width: a spread is twice as wide as a
       cover but exactly as tall, so both states land on nearly the same
       number. */
    readScaleClosed: 1.18,
    readScaleOpen: 1.1,
  },
};

/**
 * The backdrop, produced by `npm run backdrop:prep`.
 *
 * Still named `morning` — it is a morning room, and renaming the file would
 * churn a megabyte of committed binary to say the same thing. These two strings
 * are the only place the name appears in the app; the boot CSS in
 * `newspaper.css` paints the same poster and cites this module.
 */
export const ROOM_VIDEO = "/backdrop/morning.mp4";
export const ROOM_POSTER = "/backdrop/morning.avif";
