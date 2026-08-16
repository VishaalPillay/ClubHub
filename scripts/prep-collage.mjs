/**
 * Turns raw collage artwork into the scraps the flow pages actually load.
 *
 *     node scripts/prep-collage.mjs
 *
 * Reads every image in `scripts/assets/collage/` and writes a matching `.avif`
 * into `frontend/public/collage/`. The sources are NOT committed; the outputs
 * are, because the droplet builds from the repo and has no image toolchain.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * These pages are served by the DigitalOcean droplet, not Cloudflare, and every
 * flow in the app mounts them — including the signed-in ones. A folder of raw
 * PNGs would be several megabytes on the login page. This does three things the
 * artwork can't do for itself:
 *
 *   1. Knocks out the white background, so a scrap sits on the paper ground
 *      instead of on a white rectangle.
 *   2. Trims to the real content bounds, so `--x`/`--y` in scraps.ts mean what
 *      they say instead of pointing at invisible padding.
 *   3. Caps the longest edge and encodes AVIF, then reports the running total
 *      against the budget.
 *
 * ── The knockout is region growing, not a colour key ─────────────────────────
 * Three properties are needed, and a naive approach fails at least one:
 *
 *   A global "make every near-white pixel transparent" punches holes through the
 *   artwork — the butterfly's cream wings, a torn scrap's own paper and the
 *   statue's marble are all near-white INSIDE the piece.
 *
 *   A flood fill keyed to white handles that, but only if the background IS
 *   white. japan.png has a dark brown-to-black gradient behind it; a white key
 *   leaves the whole vignette intact and drops a dark rectangle onto the paper.
 *
 * So: seed from the border pixels that agree with the border's median colour,
 * then grow by comparing each candidate to the NEIGHBOUR IT CAME FROM rather
 * than to a fixed target. Neighbour-to-neighbour deltas across a smooth gradient
 * are tiny, so the fill walks the whole vignette; at the artwork's edge the delta
 * jumps and it stops. Seeding by the border median (rather than every border
 * pixel) keeps a piece that touches the canvas edge — the maths scrap's tape and
 * paperclip do — from seeding a fill inside its own artwork.
 *
 * Every file reports how much it removed. A piece that reports ~0% found no
 * background; one that reports >92% ate itself, and is skipped rather than
 * written. Images that already carry real alpha skip the knockout entirely.
 */

import { createRequire } from "node:module";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* Not a dependency of this repo — there is no root package.json. sharp is a
   devDependency of landing/, the only project here that processes images. Same
   borrow as scripts/gen-wordmark.mjs. */
const require = createRequire(resolve(ROOT, "landing/package.json"));
const sharp = require("sharp");

const SRC_DIR = resolve(ROOT, "scripts/assets/collage");
const DEST_DIR = resolve(ROOT, "frontend/public/collage");

const SRC_EXT = [".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"];

/** Longest edge for a piece NOT placed in the manifest (a spare). */
const MAX_EDGE = 600;

/**
 * Pixels encoded per CSS pixel of display width.
 *
 * 2× is right for a small piece, where a soft edge on a stamp or a butterfly is
 * the first thing the eye catches. The big corner pieces are low-frequency
 * background art behind a form, and at 2× a single one of them costs more than
 * every filler combined — so above the threshold they drop to 1.6×, which is
 * indistinguishable here and roughly halves them.
 */
const dprHeadroom = (displayWidth) => (displayWidth > 220 ? 1.6 : 2);

const MANIFEST = resolve(ROOT, "frontend/src/features/flow/scraps.ts");

/**
 * Display width of every piece actually placed in scraps.ts, keyed by filename
 * stem. Commented-out entries are skipped, so a held-back spare is treated as a
 * spare rather than being encoded to its (stale) parked size.
 *
 * A piece may appear several times at different sizes — the butterfly and the
 * stamp are reused as small accents on both sides — so the LARGEST placement
 * wins. Encoding to the smallest would leave the big instance upscaled and soft.
 *
 * A regex over the manifest rather than an import, because the manifest is TS
 * and this is a plain node script — the alternative is a build step for a
 * one-column lookup.
 */
async function placedWidths() {
  const out = new Map();
  let text;
  try {
    text = await readFile(MANIFEST, "utf8");
  } catch {
    return out;
  }
  for (const line of text.split("\n")) {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    const stem = line.match(/src:\s*"\/collage\/([^"]+)\.avif"/)?.[1];
    if (!stem) continue;
    /* A gutter piece declares a fixed `w`. A corner piece is sized in `vw` and
       is at its biggest when it hits the `max` ceiling, so that is the width it
       has to be sharp at. */
    const size = line.match(/\bw:\s*(\d+)/)?.[1] ?? line.match(/\bmax:\s*(\d+)/)?.[1];
    if (size) out.set(stem, Math.max(out.get(stem) ?? 0, Number(size)));
  }
  return out;
}

/* AVIF quality. These are out-of-focus background decoration behind a form, not
   photographs anyone will study — 44 is indistinguishable from 50 on halftone
   engravings at these sizes and buys back most of a hero piece's weight. */
const AVIF_QUALITY = 42;

/**
 * Total for everything the page actually loads. Warned about, not enforced.
 *
 * Raised from 250KB when the four corner pieces landed. 250 was set while these
 * pages still rendered on phones; the app is laptop-only now, so the collage is
 * never pulled over a phone connection, and the corners are the design rather
 * than decoration around its edges. 320 is the point at which a piece should be
 * dropped rather than the number quietly moved again.
 */
const BUDGET_KB = 320;

/** Max per-channel delta between a pixel and the neighbour it grew from. */
const GROW_TOLERANCE = 13;

/** Max per-channel delta from the border median for a pixel to be a seed. */
const SEED_TOLERANCE = 44;

/** Fraction of already-transparent pixels above which we assume real alpha. */
const EXISTING_ALPHA_RATIO = 0.02;

const chanDist = (d, i, j) =>
  Math.max(
    Math.abs(d[i] - d[j]),
    Math.abs(d[i + 1] - d[j + 1]),
    Math.abs(d[i + 2] - d[j + 2]),
  );

/** Median RGB of the canvas border — whatever the background actually is. */
function borderMedian(data, width, height) {
  const rs = [], gs = [], bs = [];
  const sample = (x, y) => {
    const i = (y * width + x) * 4;
    rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]);
  };
  for (let x = 0; x < width; x++) { sample(x, 0); sample(x, height - 1); }
  for (let y = 0; y < height; y++) { sample(0, y); sample(width - 1, y); }
  const mid = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  return [mid(rs), mid(gs), mid(bs)];
}

/**
 * Grow the background region inward from the border, clearing alpha as it goes.
 *
 * Iterative with an explicit Int32Array stack — a recursive fill blows the call
 * stack on a multi-megapixel canvas.
 */
function knockOutBackground(data, width, height) {
  const seen = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let sp = 0;
  let cleared = 0;

  const [mr, mg, mb] = borderMedian(data, width, height);
  const nearMedian = (p) => {
    const i = p * 4;
    return (
      Math.abs(data[i] - mr) <= SEED_TOLERANCE &&
      Math.abs(data[i + 1] - mg) <= SEED_TOLERANCE &&
      Math.abs(data[i + 2] - mb) <= SEED_TOLERANCE
    );
  };

  const seed = (x, y) => {
    const p = y * width + x;
    if (seen[p] || !nearMedian(p)) return;
    seen[p] = 1;
    stack[sp++] = p;
  };
  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
  for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }

  const grow = (x, y, fromIdx) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (seen[p]) return;
    if (chanDist(data, p * 4, fromIdx) > GROW_TOLERANCE) return;
    seen[p] = 1;
    stack[sp++] = p;
  };

  while (sp > 0) {
    const p = stack[--sp];
    data[p * 4 + 3] = 0;
    cleared++;
    const x = p % width;
    const y = (p / width) | 0;
    const i = p * 4;
    grow(x + 1, y, i); grow(x - 1, y, i); grow(x, y + 1, i); grow(x, y - 1, i);
  }
  return cleared / (width * height);
}

/** One 3×3 average over the alpha channel, to soften the cut edge. */
function featherAlpha(data, width, height) {
  const a = new Uint8Array(width * height);
  for (let p = 0; p < a.length; p++) a[p] = data[p * 4 + 3];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) sum += a[p + dy * width + dx];
      data[p * 4 + 3] = (sum / 9) | 0;
    }
  }
}

/** Tight bounds of everything still visible. */
function contentBounds(data, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function main() {
  let names;
  try {
    names = (await readdir(SRC_DIR)).filter((f) => SRC_EXT.includes(extname(f).toLowerCase()));
  } catch {
    console.error(`No source folder at ${SRC_DIR}\nCreate it and drop the artwork in.`);
    process.exit(1);
  }
  if (names.length === 0) {
    console.error(`No images in ${SRC_DIR}`);
    process.exit(1);
  }

  await mkdir(DEST_DIR, { recursive: true });
  const placed = await placedWidths();

  const rows = [];
  for (const name of names.sort()) {
    /* Lowercased on purpose. Development is on Windows (case-insensitive) and
       the droplet is Linux (case-sensitive), so `Paris.png` referenced as
       `paris.avif` would work locally and 404 only in production. Normalising
       here means the manifest can be written in one predictable case. */
    const stem = basename(name, extname(name)).toLowerCase();
    const src = resolve(SRC_DIR, name);
    const dest = resolve(DEST_DIR, `${stem}.avif`);

    const { data, info } = await sharp(src)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height } = info;

    let transparent = 0;
    for (let p = 0; p < width * height; p++) if (data[p * 4 + 3] < 250) transparent++;
    const hadAlpha = transparent / (width * height) > EXISTING_ALPHA_RATIO;

    let removed = 0;
    if (!hadAlpha) {
      removed = knockOutBackground(data, width, height);
      if (removed > 0.92) {
        console.warn(
          `  ! ${name} — knockout ate ${(removed * 100).toFixed(0)}% of the image; skipped.\n` +
            `    Its background is probably too close to its subject. Pre-key this one by hand.`,
        );
        continue;
      }
      if (removed < 0.01) {
        console.warn(
          `  ! ${name} — knockout found almost no background (${(removed * 100).toFixed(1)}%).\n` +
            `    It will keep its backdrop. Check this one by eye.`,
        );
      }
      featherAlpha(data, width, height);
    }

    const box = contentBounds(data, width, height);
    if (!box) {
      console.warn(`  ! ${name} — nothing left after knockout; skipped.`);
      continue;
    }

    /* A placed piece never needs more pixels than twice the width it is drawn
       at — the stamp is displayed at 78px and arrived 490px wide, which was 53KB
       of detail no screen can resolve. Never upscales: a piece smaller than its
       own target is left alone. */
    const placedW = placed.get(stem);
    const scale = placedW
      ? Math.min(1, (placedW * dprHeadroom(placedW)) / box.width)
      : Math.min(1, MAX_EDGE / Math.max(box.width, box.height));
    await sharp(data, { raw: { width, height, channels: 4 } })
      .extract(box)
      .resize({
        width: Math.max(1, Math.round(box.width * scale)),
        height: Math.max(1, Math.round(box.height * scale)),
        fit: "fill",
      })
      .avif({ quality: AVIF_QUALITY, effort: 6 })
      .toFile(dest);

    const kb = (await stat(dest)).size / 1024;
    rows.push({
      stem,
      kb,
      out: `${Math.round(box.width * scale)}×${Math.round(box.height * scale)}`,
      src: `${width}×${height}`,
      keyed: hadAlpha ? "had alpha" : `cut ${(removed * 100).toFixed(0)}%`,
      placed: placed.has(stem),
    });
  }

  /* Only placed pieces count against the budget: a spare sits in the repo but is
     never requested by a browser, so it costs disk, not page weight. */
  const shipped = rows.filter((r) => r.placed).reduce((n, r) => n + r.kb, 0);
  const onDisk = rows.reduce((n, r) => n + r.kb, 0);

  console.log(`\n  ${"file".padEnd(14)}${"source".padEnd(12)}${"output".padEnd(12)}${"where".padEnd(9)}size`);
  console.log(`  ${"-".repeat(56)}`);
  for (const r of rows) {
    console.log(
      `  ${r.stem.padEnd(14)}${r.src.padEnd(12)}${r.out.padEnd(12)}` +
        `${(r.placed ? "placed" : "spare").padEnd(9)}${r.kb.toFixed(1)} KB`,
    );
  }
  console.log(`  ${"-".repeat(56)}`);
  console.log(
    `  ${rows.filter((r) => r.placed).length} placed (loaded by the page)`.padEnd(49) +
      `${shipped.toFixed(1)} KB`,
  );
  console.log(`  ${rows.length} on disk`.padEnd(49) + `${onDisk.toFixed(1)} KB`);
  console.log(
    shipped > BUDGET_KB
      ? `\n  OVER BUDGET by ${(shipped - BUDGET_KB).toFixed(1)} KB (cap ${BUDGET_KB} KB).\n` +
          `  Drop a piece from scraps.ts, shrink a \`w\`, or lower AVIF_QUALITY.\n`
      : `\n  Within the ${BUDGET_KB} KB budget (${(BUDGET_KB - shipped).toFixed(1)} KB spare).\n`,
  );

  // Paste-ready starting points, so wiring a new piece is copy/paste + nudge.
  const suggest = rows
    .map((r) => `  { src: "/collage/${r.stem}.avif", w: 200, x: "3%", y: "20%", r: 0 },`)
    .join("\n");
  await writeFile(resolve(DEST_DIR, "MANIFEST.txt"), `${suggest}\n`, "utf8");
  console.log(`  Starter entries written to public/collage/MANIFEST.txt\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
