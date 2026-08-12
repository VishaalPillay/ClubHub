/**
 * Traces the Club-Hub wordmark artwork into SVG path data for BOTH apps.
 *
 *   node scripts/gen-wordmark.mjs                  # retrace the committed master
 *   node scripts/gen-wordmark.mjs path/to/new.png  # re-master first, then trace
 *
 * Writes byte-identical `wordmarkPaths.ts` into
 * `frontend/src/components/ui/` and `landing/src/features/newspaper/` — the two
 * apps are separate builds with no shared package, the same hand-sync
 * arrangement the theme tokens already use (see landing/README.md).
 *
 * ── What replaced what ───────────────────────────────────────────────────────
 * This used to COMPOSE the mark: four display webfonts fetched from Google at
 * generation time, one glyph outlined from each, then tilted and dropped onto
 * scraps by hand. The mark is now supplied as finished artwork, so the letters,
 * their angles, their scraps and the drop shadows under them all come from the
 * image and none of them are parameters here any more.
 *
 * ── Why it is still traced to outlines rather than shipped as a PNG ──────────
 * The same reason the font version outlined its glyphs: the nameplate is the
 * largest thing on page one of the landing site and squarely in the LCP path,
 * so it has to be right on first paint with no second asset to wait for. Vector
 * also survives `pages:render`, which rasterises the landing pages at print
 * resolution — a bitmap sized for a 240px navbar would fall apart there — and
 * it is the only form in which the two colours stay separable, which is what
 * `invert` needs on the ink footers and the controls bar.
 *
 * ── The two layers ───────────────────────────────────────────────────────────
 * The artwork is scraps of black paper with pale letters printed on them, so it
 * traces as two masks and NOT as one path with holes:
 *
 *   · `WORDMARK_TILES`   — every opaque pixel, letters included. The scrap
 *                          silhouettes, solid, with the drop shadows attached.
 *   · `WORDMARK_LETTERS` — the pale pixels only, drawn on top.
 *
 * Holes would be smaller and simpler, but the letters would then be whatever is
 * behind the mark rather than a colour of their own, and `invert` would have
 * nothing to flip. Drawing the silhouette solid also means the two traced edges
 * abut instead of meeting antialiased-to-antialiased, so there is no hairline
 * seam around the letterforms.
 */

import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* Neither of these is a dependency of this repo — there is no root
   package.json. sharp is a devDependency of landing/ (the only project here
   that processes images) and potrace is a one-off:
       npm i --no-save potrace
   Deliberately not committed as a dependency: it runs when the logo changes,
   which is approximately never, and it drags jimp in behind it. */
const require = createRequire(resolve(ROOT, "landing/package.json"));
const sharp = require("sharp");
const potrace = require("potrace");

const MASTER = resolve(ROOT, "scripts/assets/wordmark-master.png");

const DESTS = [
  resolve(ROOT, "frontend/src/components/ui/wordmarkPaths.ts"),
  resolve(ROOT, "landing/src/features/newspaper/wordmarkPaths.ts"),
];

/** Width of the emitted viewBox. Height follows the artwork's aspect. */
const VIEW_W = 1000;

/**
 * Trace settings.
 *
 * `optTolerance` is the one worth understanding: it is how far, in source
 * pixels, a fitted curve may stray from the traced polygon. The artwork is
 * ~1500px wide and the mark renders at 150–700px, so half a source pixel is
 * already below anything anyone can see — and the difference between 0.2 (the
 * default) and 0.5 here is 113 KB of path data versus 34 KB, in a file that
 * ships in the HTML of every page. Verified by rendering both at 240px and at
 * 1200px and diffing.
 *
 * `turdSize` drops speckles: the artwork's alpha edge is noisy, and without it
 * every stray cluster of semi-opaque pixels becomes its own subpath.
 */
const TRACE = {
  threshold: 128,
  turdSize: 6,
  alphaMax: 1,
  optCurve: true,
  optTolerance: 0.5,
};

/** Pale enough to be a letter rather than the scrap it is printed on. */
const LETTER_LUMA = 120;
/** Opaque enough to be artwork rather than the alpha channel's noisy fringe. */
const OPAQUE = 128;

const trace = (buf) =>
  new Promise((ok, no) => potrace.trace(buf, TRACE, (e, svg) => (e ? no(e) : ok(svg))));

/**
 * Rewrites a traced path into the emitted viewBox and rounds it.
 *
 * potrace emits absolute M/L/C/Z at three decimals in source-pixel space, which
 * is both the wrong origin and about twice the precision anything needs. This
 * walks the commands rather than regexing the numbers, because the transform is
 * different for x and y — an offset applies to each in its own axis, and a
 * blind numeric replace would shift every y by the x origin.
 *
 * **A command letter can carry more than one coordinate group.** potrace writes
 * runs of curves as a single `C` followed by six numbers per segment, which is
 * legal SVG and easy to miss: consuming exactly one group per letter then reads
 * the next segment's first number as if it were a command, and every coordinate
 * after the first such run lands in the wrong axis. The mark still renders —
 * as a shredded smear that looks like a bad trace rather than a bad parse.
 */
function remap(d, { x, y, scale }) {
  const ARITY = { M: 2, L: 2, C: 6, Z: 0 };
  const tokens = d.match(/[MLCZmlcz]|-?[\d.]+/g) ?? [];
  const isCmd = (t) => t !== undefined && /[A-Za-z]/.test(t);
  const num = (v, axis) => {
    const n = (v - (axis === 0 ? x : y)) * scale;
    /* One decimal in a 1000-unit box is 0.07px at the largest size the mark is
       ever drawn. Trailing zeros stripped — over 1,000 numbers, that is real. */
    return String(Math.round(n * 10) / 10);
  };

  let out = "";
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++].toUpperCase();
    const n = ARITY[cmd];
    out += cmd;
    if (!n) continue;
    let first = true;
    do {
      for (let k = 0; k < n; k++) {
        const v = num(Number(tokens[i++]), k % 2);
        /* Only "-" is self-separating: a leading minus cannot continue the
           previous number. Numbers here always carry their leading zero, so
           there is never a ".5" to elide a space before. */
        if (!first && !v.startsWith("-")) out += " ";
        out += v;
        first = false;
      }
    } while (isCmd(tokens[i]) === false && i < tokens.length);
  }
  return out;
}

async function main() {
  const from = process.argv[2];
  if (from) {
    await mkdir(dirname(MASTER), { recursive: true });
    /* Trimmed to the artwork with a small margin and re-encoded. The delivered
       file is mostly transparent padding; keeping it costs 750 KB to store the
       same pixels. */
    const src = sharp(resolve(process.cwd(), from)).ensureAlpha();
    await src
      .clone()
      .trim({ threshold: 1 })
      .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(MASTER);
    console.log(`  master  <- ${from}`);
  }

  const { data, info } = await sharp(MASTER).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;

  /* Black shape on white, which is the polarity potrace expects. */
  const tiles = Buffer.alloc(W * H, 255);
  const letters = Buffer.alloc(W * H, 255);
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let p = 0, i = 0; p < W * H; p++, i += 4) {
    if (data[i + 3] < OPAQUE) continue;
    tiles[p] = 0;
    if ((data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000 >= LETTER_LUMA) letters[p] = 0;
    const x = p % W, y = (p / W) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }

  const mask = (buf) =>
    sharp(buf, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
  const dOf = (svg) => [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join("");

  const scale = VIEW_W / (x1 - x0 + 1);
  const box = { x: x0, y: y0, scale };
  const dTiles = remap(dOf(await trace(await mask(tiles))), box);
  const dLetters = remap(dOf(await trace(await mask(letters))), box);
  const viewH = Math.round((y1 - y0 + 1) * scale * 10) / 10;

  const file = `/**
 * GENERATED — do not edit. Run \`node scripts/gen-wordmark.mjs\` instead.
 *
 * The Club-Hub wordmark, traced from scripts/assets/wordmark-master.png. Two
 * layers, drawn in this order: the scraps (solid, drop shadows included), then
 * the letters printed on them. See the generator for why it is not one path
 * with holes.
 *
 * Byte-identical to the copy in the other app. Regenerate both together.
 */

export const WORDMARK_VIEW = { x: 0, y: 0, w: ${VIEW_W}, h: ${viewH} };

/** The black scraps, letters filled in. Painted in the ink colour. */
export const WORDMARK_TILES =
  "${dTiles}";

/** The letterforms, painted on top in the knockout colour. */
export const WORDMARK_LETTERS =
  "${dLetters}";
`;

  for (const dest of DESTS) {
    await writeFile(dest, file);
    console.log(`  ${dest.slice(ROOT.length + 1).replace(/\\/g, "/")}  ${(file.length / 1024).toFixed(1)} KB`);
  }
  console.log(`  viewBox 0 0 ${VIEW_W} ${viewH}   tiles ${dTiles.length}  letters ${dLetters.length} chars`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
