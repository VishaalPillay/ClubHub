/**
 * The room, the hour, and the light that has to match between them.
 *
 * ── Why one module owns all three ────────────────────────────────────────────
 * The backdrop is a video of a real room and the paper is shaded by a handful of
 * numbers. Those two layers read as ONE scene only if they agree about where the
 * light is coming from — and they read as a cutout the moment they don't.
 * Compositing does not fix that; matching the light does. So the clip, the
 * camera solved against its table, and the light rig are defined together, per
 * hour, in one place.
 *
 * ── The deliberate cheat ─────────────────────────────────────────────────────
 * `paperTint` is nearly white at every hour, including night. That is not an
 * oversight: eight pages of small type are the only thing on this page anyone
 * has to be able to READ, and a physically honest night would render them a dim
 * blue-grey. Cinema lights faces brighter than physics allows for exactly the
 * same reason.
 */

export type Phase = "morning" | "evening" | "night";

/**
 * The camera and float path solved against the table IN the clip.
 *
 * Every phase films the table, and that single fact shapes the whole scene:
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
   * way to give away that a scene is composited. What varies per hour is only
   * how dark it is and how soft its edge is: direct sun throws a strong shadow
   * with a tight penumbra, a room lit by a city and some string lights throws a
   * weak one with almost none.
   */
  shadowStrength: number;
  shadowPenumbra: number;
  /** The camera and float path solved against the clip's table. Required:
   *  every phase films the table, and the scene has no other way to exist. */
  clipTable: ClipTable;
}

export const TIME_OF_DAY: Record<Phase, RoomLight> = {
  /**
   * Light direction measured off the clip rather than guessed — the bars of
   * window light on the floor run about 17° off vertical in frame, which pins
   * the key's horizontal bearing near x:z = 0.3:-1. An earlier eyeballed value
   * doubled that angle and threw the paper's shadow across at twice the slope
   * of the room's own. The negative z is the window: it is on the far side of
   * the table, not the camera's.
   */
  morning: {
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
         corners. Same physical table as the night clip, framed larger and from
         a little higher, which is why the two share an aspect: 0.58 was
         supplied from outside the image for night, and it fits this framing
         too. That agreement is the closest thing to a check this method has. */
      pitch: 29.2,
      fov: 24.1,
      distance: 8.76,
      /* Sat a little forward of the table's true centre and a little under
         full size, so there is green visible behind the masthead. Dead centre
         at 0.93 put the far edge flush with the back rail, which reads like it
         is about to slide off. */
      rest: [-0.02, 0.0, 0.4],
      restScale: 0.87,
      /* Less upright than night's: this lens sits 29 degrees above the table
         rather than 21, so the paper has less distance to travel to face it. */
      read: [0, 2.15, 3.8],
      readTiltDeg: 61,
      readScaleClosed: 1.18,
      readScaleOpen: 1.1,
    },
  },

  /** Low, hard and orange. Same window, sun almost on the horizon. */
  evening: {
    // Same horizontal bearing as morning — same window — only the elevation
    // drops, which is what lengthens the shadows.
    dir: [1.0, 2.0, -3.4],
    paperTint: "#ffeeda",
    goboPeriod: 2.4,
    goboPaper: 0.15,
    shadowStrength: 0.58,
    shadowPenumbra: 0.14,
    /* PLACEHOLDER — night's fit, borrowed. No evening clip exists yet and
       nothing returns this phase (see phaseForHour). When one lands: measure
       its tabletop corners, `npm run clip:fit -- evening`, and put the solved
       camera here before wiring the phase up. */
    clipTable: {
      pitch: 20.9,
      fov: 19.1,
      distance: 11.7,
      rest: [-0.04, 0.0, 1.18],
      restScale: 0.93,
      read: [0, 2.3, 5.79],
      readTiltDeg: 74,
      readScaleClosed: 1.15,
      readScaleOpen: 1.08,
    },
  },

  /**
   * No sun at all. The key is the string lights above the window plus the city:
   * dim, so the shadow is weak and soft-edged enough to read as contact rather
   * than as a cast.
   */
  night: {
    dir: [1.0, 3.4, -3.3],
    paperTint: "#dfe0e8",
    goboPeriod: 2.0,
    goboPaper: 0.04,
    shadowStrength: 0.34,
    shadowPenumbra: 0.5,
    clipTable: {
      /* Fitted to the tabletop in night.mp4 — 3.9px RMS across its four
         corners. The table's aspect (0.58) had to be supplied from outside the
         image: every aspect from 0.30 to 0.72 reproduces those corners within
         4px, so the fit alone cannot choose a camera, and the free fit picked
         one that made the newspaper twice as deep as the table it lay on. */
      pitch: 20.9,
      fov: 19.1,
      distance: 11.7,
      rest: [-0.04, 0.0, 1.18],
      restScale: 0.93,
      /* ON the view axis, not guessed. The camera aims at the origin from a
         shallow 21 degrees, so the centre of frame at this depth is world
         (0, 2.21, 5.79) — lifted a little from there so the page clears the
         controls bar along the bottom. Setting the height by eye put the
         masthead off the top of the screen. */
      read: [0, 2.3, 5.79],
      /* Nearly upright at the end, because the camera is nearly level with the
         table: to face a lens only 21 degrees above the surface, the paper has
         to stand most of the way up. */
      readTiltDeg: 74,
      /* HEIGHT is what binds here, not width: a spread is twice as wide as a
         cover but exactly as tall, so both states land on nearly the same
         number. */
      readScaleClosed: 1.15,
      readScaleOpen: 1.08,
    },
  },
};

/** Produced by `npm run backdrop:prep`. */
export const roomVideo = (p: Phase) => `/backdrop/${p}.mp4`;
export const roomPoster = (p: Phase) => `/backdrop/${p}.avif`;

/**
 * Which clips actually exist.
 *
 * A compile-time list rather than a probe, so the browser never requests a file
 * that is not there. Add a phase here after running the prep script for it;
 * anything missing falls back to the nearest one that does exist.
 */
export const AVAILABLE: readonly Phase[] = ["morning", "night"];

/** Nearest available phase, walking the day in order. */
function nearestAvailable(want: Phase): Phase {
  if (AVAILABLE.includes(want)) return want;
  const order: Phase[] = ["morning", "evening", "night"];
  const i = order.indexOf(want);
  for (let d = 1; d < order.length; d++) {
    const before = order[i - d];
    const after = order[i + d];
    if (after && AVAILABLE.includes(after)) return after;
    if (before && AVAILABLE.includes(before)) return before;
  }
  return "morning";
}

/** Night runs from here until NIGHT_UNTIL the next morning. */
const NIGHT_FROM = 19;

/**
 * ...and ends here, which is NOT simply "before 7pm is morning".
 *
 * Taken literally that reading puts a sunlit room on screen at two in the
 * morning, which is the one hour nobody would call morning. The boundary that
 * was asked for is the 7pm one and it is exactly as specified; the small hours
 * were not part of the question, so they go to night where they belong. Move
 * this to 0 for the strictly literal version.
 */
const NIGHT_UNTIL = 5;

/**
 * The phase for a local hour.
 *
 * Two clips, one boundary. `evening` survives in the type and in TIME_OF_DAY
 * because its light rig is written and correct, but nothing returns it and no
 * clip exists for it — it is dormant, not dead, and wiring it up is adding a
 * file and a line here.
 */
export function phaseForHour(hour: number): Phase {
  return hour >= NIGHT_FROM || hour < NIGHT_UNTIL ? "night" : "morning";
}

/** Hour → phase, already resolved against what exists. The boot script bakes
 *  this into its inline table — see bootScript.ts. */
export function resolvedPhaseForHour(hour: number): Phase {
  return nearestAvailable(phaseForHour(hour));
}

/**
 * The phase to render right now.
 *
 * Client-only by construction: it reads the visitor's clock, which the server
 * cannot know. Call it inside a `useState` initialiser guarded on `window` —
 * never during a render the server also performs.
 */
export function currentPhase(): Phase {
  return resolvedPhaseForHour(new Date().getHours());
}
