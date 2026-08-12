/**
 * Builds the browser icons for BOTH apps from one master image.
 *
 *   node scripts/gen-favicon.mjs                 # rebuild from the committed master
 *   node scripts/gen-favicon.mjs path/to/new.svg # re-master first, then rebuild
 *
 * Writes into `frontend/src/app/` and `landing/src/app/`, where Next's metadata
 * file convention picks them up and emits the <link> tags itself — there is no
 * icon markup to keep in step in either layout.
 *
 *   favicon.ico       16 + 20 + 24 + 32 + 48 + 64, the tab icon
 *   icon.png          192, bookmarks and Android
 *   apple-icon.png    180, iOS home screen
 *
 * ── Why six entries and not three ────────────────────────────────────────────
 * A tab favicon is 16 CSS px, and Windows almost never renders it at 16 device
 * px: at 125% display scaling Chrome wants 20, at 150% it wants 24, at 200% it
 * wants 32. With only 16/32/48 in the file the two commonest Windows setups get
 * a rescale of a bitmap that is already at the edge of legibility, which looks
 * exactly like a slightly soft, slightly grey icon. Each of these is cut from
 * the 1024 master at its own size, so nothing is ever scaled twice.
 *
 * ── Why a raster master and not the SVG ──────────────────────────────────────
 * The artwork arrived as a 5 MB SVG: a 12,030-path autotrace of a collage, with
 * 57 fills, most of them torn-paper texture. That is a photograph wearing a
 * vector's clothes — nothing in it is resolution-independent in any way a 16px
 * tab benefits from, and shipping it as an `icon.svg` would put five megabytes
 * on the LCP path of a page that spends 160 KB on its entire backdrop video. So
 * it is rasterised once, at 1024², into `scripts/assets/favicon-master.png`
 * (370 KB), and every output is cut from that. Keep the SVG wherever the design
 * lives; this repo does not need it.
 *
 * ── Why the small sizes are cropped in ───────────────────────────────────────
 * The mark is a ransom-note CH on a torn sheet, and the sheet is surrounded by
 * collage — handwriting, a butterfly, a plaster bust. At 512 that is the point
 * of it. At 16 it is grey noise around two letters four pixels tall, and the
 * letters are the only part that has to survive. So the smaller the output, the
 * tighter the crop: the collage is spent first, because it is the part that
 * stops being legible first. Sizes at 64 and up get the full square.
 */

import { createRequire } from "node:module";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* sharp is deliberately not a dependency of this repo's root — there is no root
   package.json. It is a devDependency of landing/, which is the only project
   here that processes images, so resolve it from there. */
const require = createRequire(resolve(ROOT, "landing/package.json"));
const sharp = require("sharp");

const MASTER = resolve(ROOT, "scripts/assets/favicon-master.png");

/** Where the CH block sits inside the square, measured off the master. */
const MARK_CENTRE = { x: 0.511, y: 0.515 };

/**
 * Output sizes, how much of the square each keeps, and whether it gets a
 * contrast lift.
 *
 * The framing tightens as the icon shrinks, and the disc is why it has to. A
 * circle cannot hold the CH block at the same relative size a square can: the
 * block is 0.50 wide by 0.42 tall, so its diagonal is 0.66 of the frame, and
 * fitting that inside an inscribed circle with any margin at all means cropping
 * no tighter than ~0.75 — which at 16px leaves the letters about nine pixels
 * across and merges the H into a grey bar. Tested; it is not close.
 *
 * So the small entries let the CH run to the edge of the disc and read as a
 * badge, while 48 and up pull back far enough to show the torn sheet inside the
 * circle. `punch` goes with the small ones: a 60x downscale averages the blacks
 * and the cream toward each other, and without pulling them back apart the
 * letterforms go soft. Every number here was picked by looking at the tiles at
 * true size on a tab-strip background, not by taste. Different framings across
 * sizes is normal — a browser picks exactly one and never sees the others.
 */
const ICO_SIZES = [
  { px: 16, crop: 0.56, punch: true },
  { px: 20, crop: 0.6, punch: true },
  { px: 24, crop: 0.64, punch: true },
  { px: 32, crop: 0.66 },
  { px: 48, crop: 0.72 },
  { px: 64, crop: 0.76 },
];

/** The apps that get a copy. Both, because they are one product wearing one mark. */
const APPS = [resolve(ROOT, "frontend/src/app"), resolve(ROOT, "landing/src/app")];

/** An antialiased disc, for masking the square art down to a round icon. */
const disc = (px) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}">` +
      `<circle cx="${px / 2}" cy="${px / 2}" r="${px / 2}" fill="#fff"/></svg>`,
  );

/**
 * One square of the master, resampled and — unless told otherwise — cut to a
 * circle.
 *
 * Round is the right shape here for a reason beyond taste: the artwork is a
 * torn sheet with collage crowding all four corners, and the corners are both
 * the least legible part at tab size and the part that makes the icon read as a
 * rectangle competing with the tab's own edges. The disc throws away exactly the
 * pixels that were doing the least work.
 *
 * Sharpened below 64px and not above: downscaling a collage by 20x is a heavy
 * low-pass, and the serifs on the C come back soft without it. At 180 and 192
 * the same filter just crawls the paper texture.
 */
async function render(master, { px, crop = 1, punch = false, round = true }) {
  const { width: D } = await sharp(master).metadata();
  const side = Math.min(D, Math.round(D * crop));
  const clamp = (v) => Math.max(0, Math.min(D - side, Math.round(v)));

  let img = sharp(master)
    .extract({
      left: clamp(D * MARK_CENTRE.x - side / 2),
      top: clamp(D * MARK_CENTRE.y - side / 2),
      width: side,
      height: side,
    })
    .resize(px, px, { kernel: "lanczos3" });

  if (punch) img = img.linear(1.22, -28);
  if (px < 64) img = img.sharpen({ sigma: 0.6, m1: 0.5, m2: 1.2 });

  /* Flattened onto the sheet's own cream first, so the disc's antialiased rim
     fades to paper rather than to whatever the master's own edge pixels are.

     `ensureAlpha` puts the channel back and it is not optional even where the
     result is opaque: an .ico entry must be RGBA. Next decodes the file at build
     time to write the `sizes` attribute and fails the build outright on a
     three-channel payload — "The PNG is not in RGBA format!", naming no file. */
  const square = await img
    .flatten({ background: "#efece5" })
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();

  if (!round) return square;

  return sharp(square)
    .composite([{ input: disc(px), blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
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

async function main() {
  const from = process.argv[2];
  if (from) {
    const src = resolve(process.cwd(), from);
    await mkdir(dirname(MASTER), { recursive: true });
    /* Re-mastering accepts anything sharp can read, including the original SVG.
       1024 is four times the largest output and the point past which a 16px tile
       stops caring. */
    if (src.toLowerCase().endsWith(".png") && src === MASTER) {
      await copyFile(src, MASTER);
    } else {
      await sharp(src, { density: 384 })
        .resize(1024, 1024, { fit: "contain", kernel: "lanczos3" })
        .png({ compressionLevel: 9 })
        .toFile(MASTER);
    }
    console.log(`  master  <- ${from}`);
  }

  const icoImages = await Promise.all(
    ICO_SIZES.map(async (s) => ({ px: s.px, data: await render(MASTER, s) })),
  );
  const favicon = ico(icoImages);
  const icon = await render(MASTER, { px: 192, crop: 0.82 });
  /* The one square left, and deliberately. iOS composites a transparent
     apple-touch-icon onto BLACK, so a disc here would ship a circle in a black
     tile to every home screen; it then applies its own squircle mask, which is
     the rounding the platform actually wants. Full bleed, no crop, no disc. */
  const apple = await render(MASTER, { px: 180, round: false });

  for (const app of APPS) {
    await writeFile(resolve(app, "favicon.ico"), favicon);
    await writeFile(resolve(app, "icon.png"), icon);
    await writeFile(resolve(app, "apple-icon.png"), apple);
    const rel = app.slice(ROOT.length + 1).replace(/\\/g, "/");
    console.log(
      `  ${rel}  favicon.ico ${(favicon.length / 1024).toFixed(1)} KB` +
        `  icon.png ${(icon.length / 1024).toFixed(1)} KB` +
        `  apple-icon.png ${(apple.length / 1024).toFixed(1)} KB`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
