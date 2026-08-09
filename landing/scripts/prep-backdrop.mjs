/**
 * Turns a raw room clip into the scene's backdrop.
 *
 *   npm run backdrop:prep              # every clip in backdrop-src/
 *   npm run backdrop:prep -- morning   # just one
 *
 * Reads `backdrop-src/<phase>.<ext>` and writes `public/backdrop/<phase>.mp4`
 * plus a matching `.avif` poster. Source files are NOT committed; the outputs
 * are, because Cloudflare Pages builds from the repo and has no ffmpeg.
 *
 * ── Why this is nearly free ──────────────────────────────────────────────────
 * The backdrop is heavily out of focus, and blur is the best thing that can
 * happen to a video encoder: there is no high-frequency detail left to spend
 * bits on. A ten-second 1280x720 source at 2.4MB comes out around a tenth of
 * that. Blur also makes resolution irrelevant — 960x540 blurred is
 * indistinguishable from 4K blurred — so the downscale costs nothing visible.
 *
 * ── Order of operations matters ──────────────────────────────────────────────
 * delogo runs FIRST, at full resolution. It reconstructs the covered box by
 * interpolating from its edges, so it needs the original neighbouring pixels;
 * downscaling first would smear the watermark into them and leave it with
 * nothing clean to interpolate from. Everything else is cheaper after the
 * downscale, so the scale comes next and the blur last.
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

/** The three times of day the scene knows about. See sceneConfig.ts. */
const PHASES = ["morning", "evening", "night"];
const VIDEO_EXT = [".mp4", ".mov", ".webm", ".m4v", ".mkv"];

/**
 * Per-phase encode profile.
 *
 * Two kinds of clip, and they want opposite settings:
 *
 *   · **Room only.** The scene draws its own table over it, so it is out of
 *     focus from the first frame. Blur it at encode time — blur strips exactly
 *     the detail an encoder spends bits on, and makes resolution irrelevant, so
 *     this is both smaller and better.
 *   · **Room WITH the table in it.** The paper rests on the clip's own table, so
 *     the first frame has to be sharp or the illusion never lands. Full
 *     resolution, no blur, a lower CRF — several times the bytes, and there is
 *     no way around it. Defocus happens at runtime instead, in RoomBackdrop.
 */
const PROFILE = {
  blurred: { width: 960, height: 540, blur: 11, crf: 30,
             grade: "eq=brightness=-0.01:saturation=1.14:contrast=1.15" },
  /* Sharp clips are rendered ABOVE their source resolution, which sounds wrong
     and is not. The source is 1280x720 and no upscale invents detail — but the
     browser is going to scale this to a viewport that is usually wider than
     1280 anyway, and its own upscaler is bilinear and mushy. Doing it here with
     lanczos and then re-sharpening beats letting the browser do it, and the
     paper resting on the filmed table needs every bit of crispness it can get
     to look like it belongs there.

     1440x810 specifically, because that is the width most desktop viewports
     actually are — the browser then scales roughly 1:1 and does nothing at all.
     1600x900 was tried and cost 40% more bytes for detail the 1280 source never
     had in the first place.

     CRF is well below the blurred profile's for the same reason: this clip is
     on screen sharp before anyone scrolls, so it is the one frame quality is
     actually visible in. */
  sharp:   { width: 1440, height: 810, blur: 0, crf: 24,
             sharpen: "unsharp=5:5:0.55:5:5:0.0",
             grade: "eq=brightness=-0.02:saturation=1.04:contrast=1.04" },
};

/** Which phases ship sharp. Keep in step with `clipTable` in timeOfDay.ts. */
const SHARP_PHASES = new Set(["morning", "night"]);

const profileFor = (phase) => (SHARP_PHASES.has(phase) ? PROFILE.sharp : PROFILE.blurred);

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
 * Measured, these clips loop CLOSE but not exactly. The best available wrap is
 * about twice an ordinary frame step for the morning clip and four times for the
 * night one — which is small, but the night room is so still that there is
 * nothing else moving to hide it behind. So the cut is followed by a very short
 * dissolve; see SEAM_FRAMES.
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

async function findSource(phase) {
  let entries;
  try {
    entries = await readdir(SRC_DIR);
  } catch {
    return null;
  }
  const hit = entries.find(
    (f) => basename(f, extname(f)).toLowerCase() === phase && VIDEO_EXT.includes(extname(f).toLowerCase()),
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

function filterGraph({ width, height, fps }, prof, loop) {
  const wm = [
    `x=${Math.round(WATERMARK.x * width)}`,
    `y=${Math.round(WATERMARK.y * height)}`,
    `w=${Math.round(WATERMARK.w * width)}`,
    `h=${Math.round(WATERMARK.h * height)}`,
  ].join(":");

  /* Graded AFTER the blur, and for blurred clips pushed UP rather than knocked
     down. Blur is an averaging operation: it pulls the bright shafts and the
     shadows between them toward each other, so a clip that was vivid sharp comes
     out flat and grey once defocused. Those numbers restore what the blur
     removed rather than adding stylisation — which is why the sharp profile does
     not use them. Dimming is a DOM overlay, so it stays tunable. */
  const blur = prof.blur ? `gblur=sigma=${prof.blur},` : "";
  const sharpen = prof.sharpen ? `${prof.sharpen},` : "";
  const post =
    `scale=${prof.width}:${prof.height}:flags=lanczos,` +
    `${blur}${sharpen}${prof.grade},format=yuv420p`;

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

async function processPhase(phase) {
  const src = await findSource(phase);
  if (!src) return null;

  const info = await probe(src);
  const prof = profileFor(phase);
  const loop = await findLoopPoint(await frameSignatures(src), info.fps);
  const dest = resolve(DEST_DIR, `${phase}.mp4`);
  const poster = resolve(DEST_DIR, `${phase}.avif`);

  await run(ffmpegPath, [
    "-y", "-v", "error",
    "-i", src,
    "-filter_complex", filterGraph(info, prof, loop),
    "-map", "[out]",
    // No audio, ever. It is a background, and a muted track is dead bytes.
    "-an",
    "-c:v", "libx264",
    "-profile:v", "high",
    "-pix_fmt", "yuv420p",
    "-crf", String(prof.crf),
    "-preset", "slow",
    "-movflags", "+faststart",
    dest,
  ]);

  /* The poster is the processed video's OWN first frame, not the source's.
     It has to match what the video shows in its first moment, otherwise the
     handover from poster to playback is a visible jump. */
  const tmp = resolve(DEST_DIR, `.${phase}-poster.png`);
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
    phase,
    src: basename(src),
    kb: v.size / 1024,
    posterKb: p.size / 1024,
    from: `${info.width}x${info.height} ${info.duration.toFixed(1)}s`,
    to: `${prof.width}x${prof.height}${prof.blur ? ` blur${prof.blur}` : " sharp"}`,
    loop: loop
      ? `cut ${loop.a}..${loop.b - 1}, source wrap was ${loop.d.toFixed(2)}; ` +
        `encoded wrap ${outWrap.toFixed(2)} vs ${outStep.toFixed(2)} per ordinary frame ` +
        `(${(outWrap / Math.max(outStep, 1e-6)).toFixed(1)}x)`
      : "uncut",
  };
}

async function main() {
  const only = process.argv[2];
  const wanted = only ? [only] : PHASES;

  for (const p of wanted) {
    if (!PHASES.includes(p)) {
      console.error(`Unknown phase "${p}". Expected one of: ${PHASES.join(", ")}`);
      process.exit(1);
    }
  }

  try {
    await access(SRC_DIR);
  } catch {
    console.error(`No ${basename(SRC_DIR)}/ directory. Put your clips there as <phase>.mp4`);
    process.exit(1);
  }

  await mkdir(DEST_DIR, { recursive: true });

  let done = 0;
  for (const phase of wanted) {
    const out = await processPhase(phase);
    if (!out) {
      console.log(`  ${phase.padEnd(9)} — no source, skipped`);
      continue;
    }
    done++;
    console.log(
      `  ${out.phase.padEnd(9)} ${out.from} -> ${out.to}  ` +
        `${out.kb.toFixed(0)} KB video + ${out.posterKb.toFixed(0)} KB poster\n` +
        `             loop: ${out.loop}`,
    );
  }

  if (!done) {
    console.log("");
    console.log(`  Nothing to do. Expected files like ${basename(SRC_DIR)}/morning.mp4`);
  }
}

main().catch((err) => {
  console.error(err.stderr?.toString?.() ?? err);
  process.exit(1);
});
