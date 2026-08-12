/**
 * Turns the raw room clip into the scene's backdrop.
 *
 *   npm run backdrop:prep
 *
 * Reads `backdrop-src/morning.<ext>` and writes `public/backdrop/morning.mp4`
 * plus a matching `.avif` poster. The source file is NOT committed; the outputs
 * are, because Cloudflare Pages builds from the repo and has no ffmpeg.
 *
 * ── One clip ─────────────────────────────────────────────────────────────────
 * This used to loop over three named times of day and pick an encode profile per
 * clip — a blurred one for clips that were only a room, a sharp one for clips
 * with the table in them. There is one room now and it has the table in it, so
 * there is one profile. The NAME still matters: `morning` is what
 * `ROOM_VIDEO` in src/features/scene/roomLight.ts asks for.
 *
 * ── Order of operations matters ──────────────────────────────────────────────
 * delogo runs FIRST, at full resolution. It reconstructs the covered box by
 * interpolating from its edges, so it needs the original neighbouring pixels;
 * downscaling first would smear the watermark into them and leave it with
 * nothing clean to interpolate from. Everything else is cheaper afterwards.
 */

import { execFile } from "node:child_process";
import { access, mkdir, readdir, stat, unlink } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import sharp from "sharp";

const run = promisify(execFile);

const SRC_DIR = resolve("backdrop-src");
const DEST_DIR = resolve("public/backdrop");

/** The clip's name, on both sides. Bound to ROOM_VIDEO in roomLight.ts. */
const CLIP = "morning";
const VIDEO_EXT = [".mp4", ".mov", ".webm", ".m4v", ".mkv"];

/**
 * The encode profile.
 *
 * The paper rests on the clip's OWN table, so the first frame has to be sharp or
 * the illusion never lands. That costs several times the bytes of a defocused
 * backdrop and there is no way around it — the defocus happens at runtime
 * instead, in RoomBackdrop, once the paper has taken over the frame.
 *
 * It renders ABOVE its source resolution, which sounds wrong and is not. The
 * source is 1280x720 and no upscale invents detail — but the browser is going to
 * scale this to a viewport that is usually wider than 1280 anyway, and its own
 * upscaler is bilinear and mushy. Doing it here with lanczos and then
 * re-sharpening beats letting the browser do it.
 *
 * 1440x810 specifically, because that is the width most desktop viewports
 * actually are — the browser then scales roughly 1:1 and does nothing at all.
 * 1600x900 was tried and cost 40% more bytes for detail the source never had.
 *
 * CRF is low because this clip is on screen sharp before anyone scrolls, so it
 * is the one frame quality is actually visible in.
 */
const PROFILE = {
  width: 1440,
  height: 810,
  crf: 24,
  sharpen: "unsharp=5:5:0.55:5:5:0.0",
  grade: "eq=brightness=-0.02:saturation=1.04:contrast=1.04",
};

/**
 * The generator's watermark, as fractions of the frame.
 *
 * Fractions rather than pixels so the box survives a source at a different
 * resolution. This is Gemini's four-point sparkle, which sits bottom-right and
 * does not move; padded generously on all sides because delogo's reconstruction
 * is only as good as its margin.
 */
const WATERMARK = { x: 0.883, y: 0.789, w: 0.05, h: 0.086 };

/**
 * Signature of every frame: a tiny greyscale thumbnail, raw.
 *
 * 128x72 is enough to tell two frames apart by where a curtain is and cheap
 * enough to hold the whole clip in memory at once — a ten-second source is about
 * two megabytes of these.
 */
const SIG_W = 128;
const SIG_H = 72;

async function frameSignatures(src) {
  const { stdout } = await run(
    ffmpegPath,
    ["-v", "error", "-i", src, "-vf", `scale=${SIG_W}:${SIG_H}`,
     "-pix_fmt", "gray", "-f", "rawvideo", "-"],
    { encoding: "buffer", maxBuffer: 512 * 1024 * 1024 },
  );
  const size = SIG_W * SIG_H;
  const frames = [];
  for (let i = 0; i + size <= stdout.length; i += size) {
    frames.push(stdout.subarray(i, i + size));
  }
  return frames;
}

/**
 * Length of the dissolve across the wrap, in frames.
 *
 * Six, where the first attempt at this used fifteen — and the difference is not
 * timidity, it is that the two things being dissolved are now nearly identical.
 * The original crossfade blended the tail of a ten-second clip into its head:
 * two completely different moments, so anything with an edge ghosted for the
 * whole dissolve. After `findLoopPoint` the two ends already match to within a
 * couple of frame-steps, so this has almost nothing left to blend — it is
 * smoothing a small step, not disguising a large one.
 *
 * A quarter of a second. Long enough that a 2-4x frame step spreads out below
 * perception, short enough that nothing has time to visibly double.
 */
const SEAM_FRAMES = 6;

/** Mean absolute difference between two frame signatures, in 0-255 units. */
function frameDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

/**
 * Where to cut the clip so that its end joins its own beginning invisibly.
 *
 * ── Why this replaced the boomerang ─────────────────────────────────────────
 * These clips are GENERATED TO LOOP, and they very nearly do. Everything before
 * this was solving the wrong problem: a crossfade dissolved two different
 * moments together and ghosted, and playing the clip forwards then backwards
 * removed the seam but introduced a reversal — the curtain visibly changing
 * direction twice a cycle, which is worse, because reversed motion is a thing
 * the eye is genuinely good at spotting.
 *
 * The clip does not need help. It needs its wrap point found. A generated loop
 * is usually a few frames out — frame 0 matches frame 237 rather than 239 — so
 * this compares every plausible start against every plausible end and takes the
 * pair that actually match. Cut there and the wrap joins two near-identical
 * frames, with no dissolve, no reversal, and every second of unique motion kept.
 *
 * Frames a..b-1 are emitted, NOT a..b: on wrap, b-1 is followed by a, and if a
 * and b are the same picture then that is exactly the step b-1 -> b would have
 * been. Keeping b as well would hold a duplicate frame once per cycle.
 *
 * ── It does not get all the way there on its own ────────────────────────────
 * Measured, the best available wrap is still about twice an ordinary frame step
 * — small, but small is not nothing on a clip that plays all day. So the cut is
 * followed by a very short dissolve; see SEAM_FRAMES.
 */
function findLoopPoint(sigs, fps) {
  const n = sigs.length;
  /* How far in from each end to look. A generated loop is out by frames, not
     seconds, but the window is generous because it costs nothing: this is a few
     hundred comparisons of a 9KB buffer. */
  const window = Math.min(Math.round(1.5 * fps), Math.floor(n / 4));
  const minLen = Math.round(Math.min(4 * fps, n * 0.6));
  if (n < minLen + 4) return null;

  let best = null;
  for (let a = 0; a <= window; a++) {
    for (let b = n - 1; b >= n - 1 - window; b--) {
      if (b - a < minLen) continue;
      const d = frameDistance(sigs[a], sigs[b]);
      if (!best || d < best.d) best = { a, b, d };
    }
  }

  // For context: how different consecutive frames are in the ordinary course.
  let step = 0;
  for (let i = 1; i < n; i++) step += frameDistance(sigs[i - 1], sigs[i]);
  return { ...best, typical: step / (n - 1) };
}

async function findSource() {
  let entries;
  try {
    entries = await readdir(SRC_DIR);
  } catch {
    return null;
  }
  const hit = entries.find(
    (f) => basename(f, extname(f)).toLowerCase() === CLIP && VIDEO_EXT.includes(extname(f).toLowerCase()),
  );
  return hit ? join(SRC_DIR, hit) : null;
}

async function probe(file) {
  const { stdout } = await run(ffprobeStatic.path, [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height,r_frame_rate",
    "-show_entries", "format=duration",
    "-of", "json",
    file,
  ]);
  const j = JSON.parse(stdout);
  const [num, den] = String(j.streams[0].r_frame_rate).split("/");
  return {
    width: j.streams[0].width,
    height: j.streams[0].height,
    duration: Number(j.format.duration),
    fps: Number(num) / Number(den || 1),
  };
}

function filterGraph({ width, height, fps }, loop) {
  const wm = [
    `x=${Math.round(WATERMARK.x * width)}`,
    `y=${Math.round(WATERMARK.y * height)}`,
    `w=${Math.round(WATERMARK.w * width)}`,
    `h=${Math.round(WATERMARK.h * height)}`,
  ].join(":");

  /* Graded last, and only lightly: this clip ships sharp, so there is no blur
     averaging the contrast out of it to restore. Dimming is a DOM overlay, so it
     stays tunable without re-running ffmpeg. */
  const post =
    `scale=${PROFILE.width}:${PROFILE.height}:flags=lanczos,` +
    `${PROFILE.sharpen},${PROFILE.grade},format=yuv420p`;

  if (!loop) return `[0:v]delogo=${wm},${post}[out]`;

  /* `end_frame` is exclusive, so the cut is a..b-1 — see findLoopPoint for why
     the matching frame at b is dropped rather than kept. */
  const len = loop.b - loop.a;
  const k = Math.min(SEAM_FRAMES, Math.floor(len / 8));
  const cut =
    `[0:v]delogo=${wm},trim=start_frame=${loop.a}:end_frame=${loop.b},` +
    `setpts=PTS-STARTPTS,${post}`;

  if (k < 2) return `${cut}[out]`;

  /* The dissolve goes at the FRONT of the output, not the back, and that is what
     makes the wrap exact rather than merely close. The output opens on
     tail-blending-into-head and ends on the frame immediately before the tail
     began — so playback wraps from frame (len-k-1) to frame (len-k), which is an
     ordinary consecutive step and not a join at all. */
  const dur = (k / fps).toFixed(4);
  return [
    `${cut},split=3[s1][s2][s3]`,
    `[s1]trim=start_frame=0:end_frame=${k},setpts=PTS-STARTPTS[head]`,
    `[s2]trim=start_frame=${len - k},setpts=PTS-STARTPTS[tail]`,
    `[s3]trim=start_frame=${k}:end_frame=${len - k},setpts=PTS-STARTPTS[rest]`,
    `[tail][head]blend=all_expr='A*(1-T/${dur})+B*(T/${dur})'[seam]`,
    `[seam][rest]concat=n=2:v=1[out]`,
  ].join(";");
}

async function processClip() {
  const src = await findSource();
  if (!src) return null;

  const info = await probe(src);
  const loop = await findLoopPoint(await frameSignatures(src), info.fps);
  const dest = resolve(DEST_DIR, `${CLIP}.mp4`);
  const poster = resolve(DEST_DIR, `${CLIP}.avif`);

  await run(ffmpegPath, [
    "-y", "-v", "error",
    "-i", src,
    "-filter_complex", filterGraph(info, loop),
    "-map", "[out]",
    // No audio, ever. It is a background, and a muted track is dead bytes.
    "-an",
    "-c:v", "libx264",
    "-profile:v", "high",
    "-pix_fmt", "yuv420p",
    "-crf", String(PROFILE.crf),
    "-preset", "slow",
    "-movflags", "+faststart",
    dest,
  ]);

  /* The poster is the processed video's OWN first frame, not the source's.
     It has to match what the video shows in its first moment, otherwise the
     handover from poster to playback is a visible jump. */
  const tmp = resolve(DEST_DIR, `.${CLIP}-poster.png`);
  await run(ffmpegPath, ["-y", "-v", "error", "-i", dest, "-frames:v", "1", tmp]);
  await sharp(tmp).avif({ quality: 55, effort: 6 }).toFile(poster);
  await unlink(tmp);

  /* Measured on the ENCODED file, not on the plan. Everything upstream is a
     prediction about what ffmpeg will emit; this is what it actually emitted,
     and a loop is exactly the kind of thing that is easy to get subtly wrong and
     never notice. */
  const outSigs = await frameSignatures(dest);
  const outN = outSigs.length;
  let outStep = 0;
  for (let i = 1; i < outN; i++) outStep += frameDistance(outSigs[i - 1], outSigs[i]);
  outStep /= Math.max(outN - 1, 1);
  const outWrap = frameDistance(outSigs[outN - 1], outSigs[0]);

  const [v, p] = await Promise.all([stat(dest), stat(poster)]);
  return {
    src: basename(src),
    kb: v.size / 1024,
    posterKb: p.size / 1024,
    from: `${info.width}x${info.height} ${info.duration.toFixed(1)}s`,
    to: `${PROFILE.width}x${PROFILE.height} sharp`,
    loop: loop
      ? `cut ${loop.a}..${loop.b - 1}, source wrap was ${loop.d.toFixed(2)}; ` +
        `encoded wrap ${outWrap.toFixed(2)} vs ${outStep.toFixed(2)} per ordinary frame ` +
        `(${(outWrap / Math.max(outStep, 1e-6)).toFixed(1)}x)`
      : "uncut",
  };
}

async function main() {
  try {
    await access(SRC_DIR);
  } catch {
    console.error(`No ${basename(SRC_DIR)}/ directory. Put the clip there as ${CLIP}.mp4`);
    process.exit(1);
  }

  await mkdir(DEST_DIR, { recursive: true });

  const out = await processClip();
  if (!out) {
    console.log("");
    console.log(`  Nothing to do. Expected ${basename(SRC_DIR)}/${CLIP}.mp4`);
    return;
  }

  console.log(
    `  ${CLIP.padEnd(9)} ${out.from} -> ${out.to}  ` +
      `${out.kb.toFixed(0)} KB video + ${out.posterKb.toFixed(0)} KB poster\n` +
      `             loop: ${out.loop}`,
  );
}

main().catch((err) => {
  console.error(err.stderr?.toString?.() ?? err);
  process.exit(1);
});
