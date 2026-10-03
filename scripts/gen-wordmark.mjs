/**
 * Builds the ClubHub wordmark images for BOTH apps from one master.
 *
 *   node scripts/gen-wordmark.mjs                  # rebuild from the committed master
 *   node scripts/gen-wordmark.mjs path/to/new.webp # re-master first, then rebuild
 *
 * Writes, identically, into `frontend/` and `landing/`:
 *
 *   public/brand/clubhub-{480,960,1600}.webp   the renditions
 *   <src dir>/wordmarkAssets.ts                the srcset + intrinsic size the
 *                                              <Wordmark> component reads
 *
 * where <src dir> is `src/components/ui/` and `src/features/newspaper/` — two
 * separate builds with no shared package, the same hand-sync the theme tokens
 * use (see landing/README.md).
 *
 * ── Why this is a raster now ─────────────────────────────────────────────────
 * It used to be traced into two SVG paths, which only worked because the old
 * mark was two flat colours: black scraps with pale letters on them. The current
 * artwork is full colour — red and black cut letters on cream scraps with
 * torn, textured edges — and there is no honest vector form of paper grain.
 * Tracing it to a handful of flat fills would be a different, worse logo.
 *
 * What the vector version bought was first-paint reliability (no second asset to
 * wait for) and an `invert` mode for dark surfaces. The first is kept by sizing
 * the <img> from intrinsic dimensions, so nothing shifts while it loads. The
 * second is gone: the letters carry their own cream border, so the mark holds on
 * the ink footers without a recolour.
 *
 * ── Why three widths ─────────────────────────────────────────────────────────
 * The mark is drawn at 132–185px in the app and up to ~570px on the landing
 * nameplate, at 1x–3x. 480 covers the app at 2x–3x, 960 the nameplate at 1x–1.5x
 * and the app's biggest screens, 1600 the nameplate at 2x (which is also the
 * density `pages:render` photographs it at). One 1600px file would put ~2.5x the
 * bytes on every signed-in page.
 *
 * The master is stored as supplied rather than re-encoded: trimming happens here
 * on every run, so re-mastering never compounds a lossy generation.
 */

import { createRequire } from "node:module";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* sharp is deliberately not a dependency of this repo's root — there is no root
   package.json. It is a devDependency of landing/, the only project here that
   processes images, so resolve it from there. */
const require = createRequire(resolve(ROOT, "landing/package.json"));
const sharp = require("sharp");

const MASTER = resolve(ROOT, "scripts/assets/wordmark-master.webp");

const WIDTHS = [480, 960, 1600];

/** Where each app wants its renditions and its generated module. */
const APPS = [
  {
    publicDir: resolve(ROOT, "frontend/public/brand"),
    module: resolve(ROOT, "frontend/src/components/ui/wordmarkAssets.ts"),
  },
  {
    publicDir: resolve(ROOT, "landing/public/brand"),
    module: resolve(ROOT, "landing/src/features/newspaper/wordmarkAssets.ts"),
  },
];

/** Soft drop shadows sit at low alpha; this keeps them and drops stray fringe. */
const ALPHA_FLOOR = 8;
/** Transparent breathing room kept around the trimmed art, in master pixels. */
const MARGIN = 6;

const WEBP = { quality: 90, alphaQuality: 100, effort: 6 };

/** Bounding box of everything at or above ALPHA_FLOOR. */
async function artBounds() {
  const { data, info } = await sharp(MASTER).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] >= ALPHA_FLOOR) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const left = Math.max(0, x0 - MARGIN);
  const top = Math.max(0, y0 - MARGIN);
  return {
    left,
    top,
    width: Math.min(W, x1 + MARGIN + 1) - left,
    height: Math.min(H, y1 + MARGIN + 1) - top,
  };
}

async function main() {
  const from = process.argv[2];
  if (from) {
    await mkdir(dirname(MASTER), { recursive: true });
    await copyFile(resolve(process.cwd(), from), MASTER);
    console.log(`  master  <- ${from}`);
  }

  const box = await artBounds();
  const aspect = box.width / box.height;
  const sizes = [];
  const buffers = new Map();

  for (const w of WIDTHS) {
    const h = Math.round(w / aspect);
    const data = await sharp(MASTER)
      .ensureAlpha()
      .extract(box)
      .resize(w, h, { kernel: "lanczos3" })
      .webp(WEBP)
      .toBuffer();
    buffers.set(w, data);
    sizes.push({ w, h, kb: (data.length / 1024).toFixed(1) });
  }

  const largest = sizes[sizes.length - 1];
  const middle = sizes[1];

  const file = `/**
 * GENERATED — do not edit. Run \`node scripts/gen-wordmark.mjs\` instead.
 *
 * The ClubHub wordmark renditions in public/brand/, from
 * scripts/assets/wordmark-master.webp. Byte-identical to the copy in the other
 * app. Regenerate both together.
 */

/** Intrinsic size of the middle rendition — what the <img> reserves space with. */
export const WORDMARK_SIZE = { w: ${middle.w}, h: ${middle.h} };

/** The default candidate, for browsers that ignore srcset. */
export const WORDMARK_SRC = "/brand/clubhub-${middle.w}.webp";

export const WORDMARK_SRCSET =
  "${sizes.map((s) => `/brand/clubhub-${s.w}.webp ${s.w}w`).join(", ")}";
`;

  for (const app of APPS) {
    await mkdir(app.publicDir, { recursive: true });
    for (const [w, data] of buffers) await writeFile(resolve(app.publicDir, `clubhub-${w}.webp`), data);
    await writeFile(app.module, file);
    console.log(`  ${app.publicDir.slice(ROOT.length + 1).replace(/\\/g, "/")}  ${sizes.map((s) => `${s.w}px ${s.kb} KB`).join("  ")}`);
  }
  console.log(`  trimmed ${box.width}x${box.height} (${aspect.toFixed(3)}:1); widest rendition ${largest.w}x${largest.h}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
