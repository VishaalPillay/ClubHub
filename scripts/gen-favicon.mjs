/**
 * Builds every icon the product ships — browser, iOS and installable-PWA — for
 * BOTH apps from one master image.
 *
 *   node scripts/gen-favicon.mjs                 # rebuild from the committed master
 *   node scripts/gen-favicon.mjs path/to/new.png # re-master first, then rebuild
 *
 * Next's metadata file convention picks up the first three and emits the <link>
 * tags itself; the PWA set is referenced by `frontend/src/app/manifest.ts`.
 *
 *   {frontend,landing}/src/app/
 *     favicon.ico        16 + 20 + 24 + 32 + 48 + 64, the tab icon
 *     icon.png           192, bookmarks and Android
 *     apple-icon.png     180, iOS home screen (opaque, full bleed)
 *   frontend/public/icons/
 *     icon-192.png       manifest, purpose "any"
 *     icon-512.png       manifest, purpose "any"
 *     maskable-192.png   manifest, purpose "maskable"
 *     maskable-512.png   manifest, purpose "maskable"
 *
 * ── The master ───────────────────────────────────────────────────────────────
 * The artwork is a torn-paper collage already cut to a rounded square, with
 * transparent corners. Re-mastering trims it to the squircle's own bounds (the
 * file arrives with a wide transparent margin, and a drop-shadow-sized one is
 * the difference between an icon that fills its tile and one that floats in it)
 * and pads the few pixels of non-squareness with transparency rather than
 * stretching. It is kept at native resolution, ~920 px: the biggest output is
 * 512, so nothing here is ever upscaled.
 *
 * ── Four shapes, because four platforms disagree about corners ───────────────
 *   tab / Android "any"  the squircle itself, transparent corners. The shape is
 *                        part of the design, so it is kept rather than cut to a
 *                        disc as the previous artwork needed.
 *   apple-icon           opaque full-bleed square. iOS composites transparency
 *                        onto BLACK and then applies its own mask, so shipping
 *                        the transparent corners would put black slivers where
 *                        the two curves disagree. The corners are filled with
 *                        the art's own nearest colours instead (see `bleed`).
 *   maskable             the OS cuts an arbitrary shape (circle, squircle,
 *                        teardrop) out of an opaque square, and promises only
 *                        that the central 80%-diameter circle survives. The
 *                        sparks beside the C sit ~0.45 of the width from the
 *                        centre — outside that circle — so the art is shrunk to
 *                        89% and the margin it opens up is filled by `bleed`.
 *
 * ── Why the small ico entries are not all cut the same ───────────────────────
 * Windows renders a 16 CSS px favicon at 20 device px at 125% display scaling,
 * 24 at 150% and 32 at 200%. With only 16/32/48 in the file those setups rescale
 * a bitmap already at the edge of legibility, which is what a slightly soft,
 * slightly grey icon looks like. Each entry is cut from the master at its own
 * size, so nothing is scaled twice, and the smallest get a contrast lift because
 * a ~50x downscale averages the black C and the cream sheet toward each other.
 */

import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* sharp is deliberately not a dependency of this repo's root — there is no root
   package.json. It is a devDependency of landing/, which is the only project
   here that processes images, so resolve it from there. */
const require = createRequire(resolve(ROOT, "landing/package.json"));
const sharp = require("sharp");

const MASTER = resolve(ROOT, "scripts/assets/favicon-master.png");

/** The sheet's own cream (`--color-paper`), for anything that has to be opaque. */
const PAPER = "#f8eedf";

/** Share of the canvas the art keeps inside a maskable icon: the sparks sit 0.446
    of the width from the centre, the guaranteed-safe circle is 0.40. */
const MASKABLE_SCALE = 0.89;

/**
 * Tab-icon sizes and how much of the squircle each keeps. 1 is the whole shape.
 * The C is large and bold, so even 16 px survives the full square; the smallest
 * entries trim the squircle's rounded margin (a few px at this size) so the
 * letter gets the room instead.
 */
const ICO_SIZES = [
  { px: 16, crop: 0.92, punch: true },
  { px: 20, crop: 0.94, punch: true },
  { px: 24, crop: 0.96, punch: true },
  { px: 32, crop: 1 },
  { px: 48, crop: 1 },
  { px: 64, crop: 1 },
];

/** The apps that get the browser/iOS trio. Both: one product, one mark. */
const APPS = [resolve(ROOT, "frontend/src/app"), resolve(ROOT, "landing/src/app")];

/** Only the app is installable; the landing site is a static page. */
const PWA_DIR = resolve(ROOT, "frontend/public/icons");

const png = { compressionLevel: 9, effort: 10 };

async function rgba(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** Pixels at or above this alpha count as "the art" when measuring and filling. */
const SOLID = 200;

/** Bounding box of the artwork's solid pixels. */
function bounds({ data, w, h }) {
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] >= SOLID) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Trim to the squircle and pad to square — never stretch. Written as the master. */
async function remaster(src) {
  const raw = await rgba(src);
  const b = bounds(raw);
  const side = Math.max(b.width, b.height);
  const padX = side - b.width;
  const padY = side - b.height;
  await sharp(src)
    .ensureAlpha()
    .extract(b)
    .extend({
      left: Math.floor(padX / 2),
      right: Math.ceil(padX / 2),
      top: Math.floor(padY / 2),
      bottom: Math.ceil(padY / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png(png)
    .toFile(MASTER);
  console.log(`  master  <- ${src}  (${side}x${side})`);
}

/**
 * Un-solids every pixel within `r` steps of a non-solid one. The squircle's rim
 * carries a baked-in edge shading (a few px of darker colour); smeared outward
 * it would draw a faint curved line inside every filled corner, so the rim is
 * dropped before anything is spread from it.
 */
function erode({ data, w, h }, r) {
  const out = Buffer.from(data);
  const n = w * h;
  const dist = new Int16Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    if (data[i * 4 + 3] < SOLID) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    if (dist[i] >= r) continue;
    const x = i % w;
    const y = (i - x) / w;
    for (const j of [
      x > 0 ? i - 1 : -1,
      x < w - 1 ? i + 1 : -1,
      y > 0 ? i - w : -1,
      y < h - 1 ? i + w : -1,
    ]) {
      if (j < 0 || dist[j] >= 0) continue;
      dist[j] = dist[i] + 1;
      out[j * 4 + 3] = 0;
      queue[tail++] = j;
    }
  }
  return out;
}

/**
 * Fills every non-solid pixel with the colour of the nearest solid one, by a
 * multi-source flood from the artwork outward. The result is the art with its
 * rounded corners (and any margin around it) smeared outward — streaky, which
 * is why callers blur it and only ever show it where an OS mask or the art
 * itself covers the rest.
 */
function bleed({ data, w, h }) {
  const out = Buffer.from(data);
  const n = w * h;
  const seen = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    if (data[i * 4 + 3] >= SOLID) {
      seen[i] = 1;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i - x) / w;
    for (const j of [
      x > 0 ? i - 1 : -1,
      x < w - 1 ? i + 1 : -1,
      y > 0 ? i - w : -1,
      y < h - 1 ? i + w : -1,
    ]) {
      if (j < 0 || seen[j]) continue;
      seen[j] = 1;
      out[j * 4] = out[i * 4];
      out[j * 4 + 1] = out[i * 4 + 1];
      out[j * 4 + 2] = out[i * 4 + 2];
      queue[tail++] = j;
    }
  }
  for (let i = 0; i < n; i++) out[i * 4 + 3] = 255;
  return out;
}

/**
 * The art on an opaque canvas, `scale` of it wide, everything outside the
 * squircle filled from the squircle's own edge colours.
 *
 * Three layers, so the fill never reads as a fill: the smear is blurred hard
 * into a soft field of the art's dominant colours (newsprint, cream, red, kraft)
 * rather than left as streaks; the crisp art is laid over it; and the seam
 * between them is feathered by blurring the art's own mask, so texture dissolves
 * into the field instead of stopping at a ruler-straight edge.
 */
async function opaqueSquare(master, size, scale = 1) {
  const art = Math.round(size * scale);
  const off = Math.round((size - art) / 2);
  const artBuf = await sharp(master)
    .resize(art, art, { kernel: "lanczos3" })
    .png()
    .toBuffer();

  const placed = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: artBuf, left: off, top: off }])
    .raw()
    .toBuffer();

  const eroded = erode({ data: placed, w: size, h: size }, Math.max(2, Math.round(size * 0.008)));
  const filled = bleed({ data: eroded, w: size, h: size });
  const raw = { raw: { width: size, height: size, channels: 4 } };

  const mask = Buffer.alloc(size * size);
  for (let i = 0; i < mask.length; i++) mask[i] = eroded[i * 4 + 3] >= SOLID ? 255 : 0;
  const feather = await sharp(mask, { raw: { width: size, height: size, channels: 1 } })
    .blur(Math.max(1, size / 70))
    .raw()
    .toBuffer();

  const under = await sharp(filled, raw)
    .blur(Math.max(2, size / 14))
    .png()
    .toBuffer();
  const crisp = await sharp(filled, raw)
    .removeAlpha()
    .joinChannel(feather, { raw: { width: size, height: size, channels: 1 } })
    .png()
    .toBuffer();

  return sharp(under)
    .composite([{ input: crisp }])
    .flatten({ background: PAPER })
    .ensureAlpha()
    .png(png)
    .toBuffer();
}

/**
 * One tab-icon tile: the squircle (or the middle `crop` of it), resampled with
 * its transparency intact.
 *
 * Sharpened below 64px and not above: a 20x downscale of a collage is a heavy
 * low-pass and the C's serifs come back soft without it. At 180 and 192 the
 * same filter just crawls the paper texture.
 *
 * `ensureAlpha` is not optional even where it looks redundant: an .ico entry
 * must be RGBA. Next decodes the file at build time to write the `sizes`
 * attribute and fails the build on a three-channel payload — "The PNG is not in
 * RGBA format!", naming no file.
 */
async function tile(master, { px, crop = 1, punch = false }) {
  const { width: D } = await sharp(master).metadata();
  const side = Math.round(D * crop);
  const at = Math.round((D - side) / 2);

  let img = sharp(master)
    .extract({ left: at, top: at, width: side, height: side })
    .resize(px, px, { kernel: "lanczos3" });

  /* Per-channel so alpha is left alone: lifting it would fatten the rim. */
  if (punch) img = img.linear([1.22, 1.22, 1.22, 1], [-28, -28, -28, 0]);
  if (px < 64) img = img.sharpen({ sigma: 0.6, m1: 0.5, m2: 1.2 });

  return img.ensureAlpha().png(png).toBuffer();
}

/**
 * An .ico wrapping PNG payloads — the format every browser since IE11 reads,
 * and far smaller than the BMP form for artwork with this much texture in it.
 *
 * Header: 6 bytes, then one 16-byte directory entry per image, then the images.
 * A side of 256 is written as 0; nothing here is that big, but the rule is the
 * one thing about this format people get wrong.
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ px, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(px >= 256 ? 0 : px, 0);
    e.writeUInt8(px >= 256 ? 0 : px, 1);
    e.writeUInt8(0, 2); // palette size — 0 for truecolour
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const kb = (b) => `${(b.length / 1024).toFixed(1)} KB`;

async function main() {
  const from = process.argv[2];
  if (from) {
    await mkdir(dirname(MASTER), { recursive: true });
    await remaster(resolve(process.cwd(), from));
  }

  const icoImages = await Promise.all(
    ICO_SIZES.map(async (s) => ({ px: s.px, data: await tile(MASTER, s) })),
  );
  const favicon = ico(icoImages);
  const icon = await tile(MASTER, { px: 192 });
  const apple = await opaqueSquare(MASTER, 180);

  for (const app of APPS) {
    await writeFile(resolve(app, "favicon.ico"), favicon);
    await writeFile(resolve(app, "icon.png"), icon);
    await writeFile(resolve(app, "apple-icon.png"), apple);
    const rel = app.slice(ROOT.length + 1).replace(/\\/g, "/");
    console.log(
      `  ${rel}  favicon.ico ${kb(favicon)}  icon.png ${kb(icon)}  apple-icon.png ${kb(apple)}`,
    );
  }

  await mkdir(PWA_DIR, { recursive: true });
  for (const px of [192, 512]) {
    const any = await tile(MASTER, { px });
    const maskable = await opaqueSquare(MASTER, px, MASKABLE_SCALE);
    await writeFile(resolve(PWA_DIR, `icon-${px}.png`), any);
    await writeFile(resolve(PWA_DIR, `maskable-${px}.png`), maskable);
    console.log(
      `  frontend/public/icons  icon-${px}.png ${kb(any)}  maskable-${px}.png ${kb(maskable)}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
