"use client";

import { useEffect, useRef } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { roomPoster, roomVideo, type Phase } from "../scene/timeOfDay";
import { openness } from "../scene/sceneConfig";

/**
 * The room behind the table — a looping clip, in the DOM, behind the canvas.
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

export interface RoomBackdropProps {
  /** Continuous scroll position in steps. */
  pos: MotionValue<number>;
  steps: number;
  /** Steps of camera-only lead-in. The room defocuses over exactly this, so it
   *  must match the rig or the two move on different curves. */
  lead: number;
  /** Resolved by the shell, so this and the 3D light rig cannot disagree. */
  phase: Phase;
}

export default function RoomBackdrop({ pos, steps, lead, phase }: RoomBackdropProps) {
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
        poster={roomPoster(phase)}
        src={roomVideo(phase)}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        // Never part of the tab order or the a11y tree; it is wallpaper.
        tabIndex={-1}
      />
      <motion.div className="np-room-veil" style={{ opacity: veil }} />
    </div>
  );
}
