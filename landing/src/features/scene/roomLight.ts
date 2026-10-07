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
 * gone. The site shows ONE room at every hour — now a golden-hour study, low sun
 * through a tall window onto a desk — which means the light
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
  /** The colour of the sun itself. The paper's lit side is pushed toward it by the
   *  same `lambert` term that shades it, so the side facing the window warms and
   *  the side turned away stays neutral — which is what low sun does to paper. */
  sunColor: string;
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
   * Leaf-shadow dapple drifting across the paper.
   *
   * The clip's table is crossed by shadows of leaves moving in the wind, and a
   * paper lying in it with perfectly still light reads as laid on top of the
   * footage. This is a slow, soft, world-space noise that crosses the page the
   * way the clip's own dapple crosses the desk — it is not synchronised with the
   * video (it cannot be; the clip loops and this does not) and is weak enough
   * that nobody can tell. `dapple` is how much light it takes out, `dappleScale`
   * how many blotches per world unit, `dappleSpeed` how fast it drifts.
   */
  dapple: number;
  dappleScale: number;
  dappleSpeed: number;
  /**
   * The window-light pattern that actually lies across the desk in the clip,
   * continued across the paper.
   *
   * The paper used to carry a made-up cosine of light bars, at a made-up phase.
   * It did not line up with the bars on the mat, so the mat's shadow stopped dead
   * at the paper's edge and the paper glowed evenly on top of it — the clearest
   * single thing making it look pasted on rather than lying there. This is the
   * real thing: the mat was unprojected to a top-down view with the fitted
   * camera, and its brightness averaged along the shadow stripes (five frames, so
   * the moving leaf shadows wash out and the static window bars remain), giving a
   * profile ACROSS them. `samples` is that profile, 64 values from `tMin` to
   * `tMax`, where t = dot(world.xz, perp-to-the-light); `ref` is the value of the
   * brightest part of the paper's own footprint, so the lit end of the page keeps
   * its full brightness and only the part lying in shadow goes down. Regenerate
   * it whenever the clip, the camera or `dir` changes — it is only valid for the
   * combination it was measured with.
   */
  lightProfile: { tMin: number; tMax: number; ref: number; samples: number[] };
  /**
   * How far the free edges of resting paper rise off the table (world units).
   * A sheet that lies exactly flat on a plane looks printed onto the footage;
   * real newsprint is never flat. Zero in the middle, so it still touches.
   */
  restBow: number;
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
  /** Shadow colour. Low sun does not throw a black shadow: the sky fills it with
   *  its own warm-brown, so a pure-black one is the other way to give a composite
   *  away. */
  shadowTint: string;
  /** How far the shadow lies from the paper while it is still ON the table
   *  (world units). Paper has thickness; at golden hour that sliver is long. */
  shadowRest: number;
  /** The camera and float path solved against the clip's table. */
  clipTable: ClipTable;
}

/**
 * The one light rig, matched to `backdrop/morning.mp4` (the golden-hour room).
 *
 * ── Direction, measured ──────────────────────────────────────────────────────
 * Light direction is read off the clip, not guessed. The desk mat was unprojected
 * to a top-down view with the fitted camera (below) and the shadow stripes across
 * it measured: they run 32 degrees off the far axis, leaning toward +x. Shadows
 * from a window's vertical mullions lie along the light's horizontal bearing, so
 * that is the sun's bearing, and it puts the sun far-right beyond the window —
 * where the clip puts it. The previous room's stripes ran 17 degrees off.
 * Elevation is not recoverable from stripes alone, so it is set by eye: 24
 * degrees, low, because the shadows are long and the light is orange.
 *
 * The negative z is the window: it is on the far side of the table, not the
 * camera's.
 */
export const ROOM_LIGHT: RoomLight = {
  dir: [2.4, 2.0, -3.8],
  /* Warmer than the old rig's near-white: the whole frame is amber, and paper that
     stayed neutral would look cut out of a different photograph. Still light, and
     still the cheat described above — eight pages of small type have to be read. */
  paperTint: "#fff0dc",
  sunColor: "#ffcf94",
  /* Measured: the window bars on the mat repeat about every 0.8 world units. */
  goboPeriod: 0.8,
  /* The bars are now measured (lightProfile), not a cosine, so this period only sets
     how fast their slow drift reads. Strength: */
  /* Strength of the measured light bars on the paper, 0 to 1. The mat's own bars are
     a ~4.5:1 range; the paper takes about half of that so type in the shadowed half
     is still comfortably readable. */
  goboPaper: 0.75,
  lightProfile: {
    tMin: -0.4364,
    tMax: 2.3361,
    ref: 0.6,
    samples: [0.236, 0.236, 0.236, 0.228, 0.2, 0.194, 0.218, 0.219, 0.217, 0.244, 0.295, 0.341, 0.332, 0.278, 0.245, 0.25, 0.262, 0.271, 0.28, 0.282, 0.276, 0.271, 0.274, 0.28, 0.287, 0.301, 0.32, 0.352, 0.401, 0.443, 0.469, 0.482, 0.488, 0.489, 0.48, 0.456, 0.417, 0.382, 0.365, 0.368, 0.377, 0.392, 0.428, 0.486, 0.544, 0.582, 0.601, 0.604, 0.599, 0.602, 0.632, 0.699, 0.798, 0.893, 0.959, 1, 1, 1, 1, 1, 1, 0.972, 0.924, 0.924],
  },
  restBow: 0.024,
  dapple: 0.06,
  dappleScale: 1.6,
  dappleSpeed: 0.55,
  // Low direct sun: dark and crisp at the edge, and long.
  shadowStrength: 0.66,
  shadowPenumbra: 0.07,
  shadowTint: "#1f1006",
  shadowRest: 0.17,
  clipTable: {
    /* Fitted to the green desk mat in the golden-hour clip: 1.1px RMS across its
       four corners (scripts/fit-clip-table.mjs). The pitch/fov pair is not
       determined by one image; the table's aspect had to come from outside it.
       0.58 is a desk mat about 60x35cm, and it agrees with the reference
       composite, where the paper's on-screen squash implies a camera pitch of ~16
       degrees — this fit gives 16.8. The clip's shallow depth of field also says
       long lens, which this (31 degree vertical fov) is, and the wider fits are
       not. */
    pitch: 16.83,
    fov: 31.26,
    distance: 5.438,
    /* The mat's centre in world space, from the fit — a little forward of true
       centre so there is mat visible behind the masthead. */
    rest: [0.09, 0.0, 1.6],
    /* The page fits the mat's depth at scale 0.93. This is a little over, so the
       paper covers the mat front to back and its edges sit at the mat's own, which
       is how the reference composite has it; the earlier, smaller 0.9 left it
       looking like a card lost in the middle of the mat. */
    restScale: 1.1,
    /* ON the view axis: 3.2 units from the camera, along the line through the
       origin. The camera sits at 5.44 from the origin, so this is 2.24 out from
       it: (sin 16.83, cos 16.83) x 2.24. Setting the height by eye put the
       masthead off the top of the screen. */
    read: [0, 0.65, 2.15],
    /* Faces a lens 16.8 degrees above the table: 90 - pitch. */
    readTiltDeg: 73.2,
    /* HEIGHT is what binds here, not width: a spread is twice as wide as a
       cover but exactly as tall, so both states land on nearly the same
       number. Tuned against the frame, not derived. */
    readScaleClosed: 1.1,
    readScaleOpen: 1.04,
  },
};

/**
 * The backdrop, produced by `npm run backdrop:prep`.
 *
 * Still named `morning` — it was a morning room and is now a golden-hour one,
 * and renaming the file would churn a megabyte of committed binary to say the
 * same thing. These two strings
 * are the only place the name appears in the app; the boot CSS in
 * `newspaper.css` paints the same poster and cites this module.
 */
export const ROOM_VIDEO = "/backdrop/morning.mp4";
/** The same clip at 720p (`npm run backdrop:prep -- --renditions`), a seventh of the
 *  size — for ordinary laptops and connections that are not fast. */
export const ROOM_VIDEO_720 = "/backdrop/morning-720.mp4";
export const ROOM_POSTER = "/backdrop/morning.avif";
