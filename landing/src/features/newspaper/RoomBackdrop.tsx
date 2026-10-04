"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { ROOM_POSTER, ROOM_VIDEO } from "../scene/roomLight";
import { openness } from "../scene/sceneConfig";

/**
 * The room behind the table — a looping clip, in the DOM, behind the canvas, with
 * dust drifting through its sunbeam.
 *
 * ── Why not a VideoTexture in the scene ──────────────────────────────────────
 * The obvious move is to map the video onto geometry inside three. It is the
 * wrong one. That re-uploads a full frame to the GPU on every render, and it
 * welds the clip's playback to the WebGL loop — so any hitch in the scene
 * becomes a hitch in the room. As a sibling element the browser decodes and
 * composites it on its own, throttles it when the tab is hidden, and hands us
 * `poster` for free. It buys nothing to be in the scene: a backdrop this far out
 * of focus has no parallax worth having.
 *
 * ── What it costs to be outside the scene ────────────────────────────────────
 * One thing, and it has to be paid: a DOM layer is nailed to the viewport, so
 * when the camera rises and pushes in to read, the table moves and the room does
 * not. That reads as wrong even to someone who cannot say why. The fix is the
 * transform below — a few percent of scale and drift on the same curve the
 * camera uses. At this blur it is indistinguishable from real parallax.
 */

/**
 * Motes of dust hanging in the sunbeam.
 *
 * The clip loops after four seconds, and a four-second loop of leaf shadows is
 * the kind of thing a visitor learns by their third scroll. These are the part of
 * the room that does NOT loop: thirty specks on thirty different periods
 * (14-30s), so the combined pattern does not repeat for far longer than anyone
 * stays, drifting up and to the right through the light. Golden-hour rooms are
 * full of them; footage of one without any reads as filmed in a clean cube.
 *
 * Generated from a fixed seed so the server markup and the client agree (this is
 * a client component, but it still renders once on the server). Pure CSS from
 * here: transform and opacity only, so they cost the compositor nothing and the
 * main thread not at all.
 */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MOTES = (() => {
  const rnd = mulberry32(2026);
  return Array.from({ length: 30 }, () => ({
    // Where the beam is: the right two-thirds of the frame, from the window down
    // across the table.
    x: 28 + rnd() * 68,
    y: 6 + rnd() * 78,
    size: 2 + rnd() * 4.6,
    dur: 14 + rnd() * 16,
    // Negative, so the field is already populated on the first frame instead of
    // filling in over the first half-minute.
    delay: -rnd() * 30,
    dx: 1 + rnd() * 5,
    dy: -(3 + rnd() * 9),
    alpha: 0.35 + rnd() * 0.55,
  }));
})();

export interface RoomBackdropProps {
  /** Continuous scroll position in steps. */
  pos: MotionValue<number>;
  steps: number;
  /** Steps of camera-only lead-in. The room defocuses over exactly this, so it
   *  must match the rig or the two move on different curves. */
  lead: number;
}

export default function RoomBackdrop({ pos, steps, lead }: RoomBackdropProps) {
  const video = useRef<HTMLVideoElement>(null);

  /** 0 shut, 1 open — the same curve the scene runs on, from the same function. */
  const open = useTransform(pos, (p) => openness(p, steps - lead * 2, lead));

  // Pushes in and settles a little as the paper lifts toward the reader.
  const scale = useTransform(open, [0, 1], [1, 1.07]);
  const y = useTransform(open, [0, 1], ["0%", "2.2%"]);
  // And falls back, so the eye goes where the type is.
  const veil = useTransform(open, [0, 1], [0.12, 0.66]);

  /**
   * Rack focus. The clip ships SHARP — its first frame, a crisp table the
   * paper visibly rests on, is the whole trick — and defocuses here as the
   * paper lifts toward the reader, on the same curve the lift runs on so focus
   * and motion cannot drift apart.
   */
  const blur = useTransform(open, [0, 1], ["blur(0px)", "blur(15px)"]);

  // The motes are part of the room, and the room is going out of focus; they go
  // with it, and are gone well before the page is up against the lens so they
  // never drift across type being read.
  const dustOpacity = useTransform(open, [0, 0.55], [1, 0]);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    /* Autoplay can be refused — iOS low-power mode declines even muted video.
       Nothing to handle: the poster is the same frame the clip opens on, so a
       refusal degrades to a still photograph of the room and no one can tell
       until they notice it is not moving. */
    void el.play().catch(() => {});
  }, []);

  return (
    <div className="np-room" aria-hidden>
      <motion.video
        ref={video}
        className="np-room-clip"
        style={{ scale, y, filter: blur }}
        poster={ROOM_POSTER}
        src={ROOM_VIDEO}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        // Never part of the tab order or the a11y tree; it is wallpaper.
        tabIndex={-1}
      />
      <motion.div className="np-dust" style={{ opacity: dustOpacity }}>
        {MOTES.map((m, i) => (
          <span
            key={i}
            style={
              {
                left: `${m.x}%`,
                top: `${m.y}%`,
                "--s": `${m.size}px`,
                "--d": `${m.dur}s`,
                "--dl": `${m.delay}s`,
                "--dx": `${m.dx}vw`,
                "--dy": `${m.dy}vh`,
                "--o": m.alpha,
              } as CSSProperties
            }
          />
        ))}
      </motion.div>
      <motion.div className="np-room-veil" style={{ opacity: veil }} />
    </div>
  );
}
