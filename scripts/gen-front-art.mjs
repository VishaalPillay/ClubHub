/**
 * Builds the front-page collage art for the landing site from the supplied masters.
 *
 *   node scripts/gen-front-art.mjs                   # rebuild from scripts/assets/front/
 *   node scripts/gen-front-art.mjs hero path/to.webp # replace one master first
 *
 * Writes `landing/public/art/<name>.webp` and a generated
 * `landing/src/features/newspaper/frontArt.ts` carrying each file's intrinsic size, so the
 * <img> tags reserve their box and nothing shifts while the art arrives.
 *
 *   hero      the campus-building collage beside the headline (page 1)
 *   campus    the students-at-a-table collage beside the headline (page 2)
 *   plane     the paper-plane collage at the foot of page 2
 *   clubs     \
 *   events     }  strips of several pictures, cut apart into one image per card (page 2)
 *   voices    /
 *   discover  \
 *   connect    }  one illustration per teaser card under the headline
 *   engage     |
 *   lead      /
 *
 * ── Page 2 ───────────────────────────────────────────────────────────────────
 * `campus` and `plane` are single pictures; `clubs`, `events` and `voices` are strips cut per card
 * (see SPLIT). `campus` also gets a silhouette polygon, exactly as `hero` does.
 *
 * ── The hero's silhouette ────────────────────────────────────────────────────
 * The hero collage is a torn cut-out with a big empty top-left, and the front page sets its
 * headline and copy around it with `shape-outside`. That needs a shape. `shape-outside: url()`
 * would read the image's own alpha, but it depends on the image being loaded, same-origin and
 * mapped onto the right box at layout time, and when any of that slips the text silently runs
 * UNDER the picture. So the shape is computed here instead, from the same pixels, and written
 * into frontArt.ts as an explicit polygon: for each horizontal band of the picture, the
 * leftmost opaque pixel (the minimum over the band, so the text keeps clear of the whole band,
 * not just its middle). The polygon is in percentages of the picture's own box.
 *
 * ── Same pattern as the wordmark, for the same reason ────────────────────────
 * Supplied artwork, processed once. The masters are stored exactly as delivered (1536x1024,
 * mostly transparent padding) and trimmed here on every run, so re-mastering never compounds
 * a lossy generation. Each is a full-colour paper collage with a halftone photograph in it —
 * there is no vector form of that — so the outputs are WebP with alpha.
 *
 * ── Sizes ────────────────────────────────────────────────────────────────────
 * The sheet is 574 CSS px wide and `pages:render` photographs it at 2x, which is the only
 * density the 3D scene ever sees; plain mode draws the same art at most ~1x on a 780px page.
 * The hero is drawn ~290px wide and each teaser ~125px, so 900 and 560 leave headroom for a
 * retina plain-mode reader without shipping the 1536px masters.
 */

import { createRequire } from "node:module";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* sharp is a devDependency of landing/ only — there is no root package.json. */
const require = createRequire(resolve(ROOT, "landing/package.json"));
const sharp = require("sharp");

const SRC = resolve(ROOT, "scripts/assets/front");
const OUT = resolve(ROOT, "landing/public/art");
const MODULE = resolve(ROOT, "landing/src/features/newspaper/frontArt.ts");

/** name → output width. */
/** Single pictures: master name -> output width. */
const ART = {
  hero: 900,
  discover: 560,
  connect: 560,
  engage: 560,
  lead: 560,
  campus: 900,
  plane: 480,
};

/**
 * Strips that hold several pictures side by side, cut into one image per card:
 * master name -> how many, and each one's output width. Outputs are `<name>-1`, `<name>-2`, ...
 *
 * The cut is by CONNECTED PIECE, not by column. The club illustrations overlap — a burst of one
 * reaches into the paper of the next — so no vertical line separates them cleanly, and a column
 * cut leaves a sliver of the neighbour's burst on the card. Each picture is, however, one
 * connected piece of opaque pixels: the strip is labelled, the N largest pieces are the cards
 * (ordered left to right), and each card keeps only its own piece. Everything smaller (dust from
 * the halftone edge) is dropped. If the strip ever has fewer than N pieces — two cards fused —
 * it fails loudly rather than emit a card that holds two pictures.
 */
const SPLIT = {
  clubs: { n: 4, w: 360 },
  events: { n: 3, w: 440 },
  /* `maxY`: keep only the top part of the strip. Each voices picture has its quote painted onto a
     paper note across its lower half — at ~125px a card that handwriting is ~6px tall and
     unreadable, so the quote is set as live text and only the person is kept. 0.495 of the strip
     is just above the top of the tallest note. */
  voices: { n: 3, w: 520, maxY: 0.495 },
};

/** Pictures the page wraps its type around: they also get a silhouette polygon. */
const SHAPED = new Set(["hero", "campus"]);

const ALPHA_FLOOR = 8;
/** Bands the hero silhouette is cut into, and the alpha that counts as "picture" in it. */
const SHAPE_BANDS = 48;
const SHAPE_ALPHA = 110;
const MARGIN = 4;
const WEBP = { quality: 82, alphaQuality: 100, effort: 6 };

async function bounds(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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

/** Labels 4-connected pieces of opaque pixels. Returns per-pixel labels and per-piece stats. */
function labelPieces(data, W, H) {
  const lab = new Int32Array(W * H);
  const pieces = [];
  let next = 0;
  for (let start = 0; start < W * H; start++) {
    if (lab[start] || data[start * 4 + 3] < ALPHA_FLOOR) continue;
    next++;
    lab[start] = next;
    const stack = [start];
    let area = 0;
    let sumX = 0;
    while (stack.length) {
      const i = stack.pop();
      area++;
      const x = i % W;
      sumX += x;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < W * (H - 1) ? i + W : -1]) {
        if (j >= 0 && !lab[j] && data[j * 4 + 3] >= ALPHA_FLOOR) {
          lab[j] = next;
          stack.push(j);
        }
      }
    }
    pieces.push({ id: next, area, cx: sumX / area });
  }
  return { lab, pieces };
}

/** One card per large piece of a strip — see SPLIT. Each result is a full-strip RGBA buffer with
 *  everything but that card made transparent, and the box to crop it to. */
async function splitStrip(file, n, maxY = 1) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const { lab, pieces } = labelPieces(data, W, H);
  const cards = [...pieces].sort((a, b) => b.area - a.area).slice(0, n);
  if (cards.length < n || cards[n - 1].area < 20000) {
    throw new Error(`strip ${file}: expected ${n} separate pictures, found ${cards.filter((c) => c.area >= 20000).length}`);
  }
  cards.sort((a, b) => a.cx - b.cx);

  const limit = Math.round(H * maxY);
  return cards.map((card) => {
    const raw = Buffer.from(data);
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (lab[i] === card.id && y < limit) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        } else {
          raw[i * 4 + 3] = 0;
        }
      }
    }
    const left = Math.max(0, x0 - MARGIN);
    const top = Math.max(0, y0 - MARGIN);
    return {
      raw: { data: raw, width: W, height: H },
      box: {
        left,
        top,
        width: Math.min(W, x1 + MARGIN + 1) - left,
        height: Math.min(H, y1 + MARGIN + 1) - top,
      },
    };
  });
}

/** Left edge of the opaque region, band by band, as a CSS polygon (the float's occupied side). */
function leftSilhouette(raw, w, h) {
  const pts = [];
  for (let k = 0; k < SHAPE_BANDS; k++) {
    const y0 = Math.floor((k * h) / SHAPE_BANDS);
    const y1 = Math.floor(((k + 1) * h) / SHAPE_BANDS);
    let minX = w;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < minX; x++) {
        if (raw[(y * w + x) * 4 + 3] >= SHAPE_ALPHA) {
          minX = x;
          break;
        }
      }
    }
    const px = ((minX / w) * 100).toFixed(1);
    pts.push(`${px}% ${((y0 / h) * 100).toFixed(1)}%`, `${px}% ${((y1 / h) * 100).toFixed(1)}%`);
  }
  // Right edge and corners: the float occupies everything from that left edge to the box's side.
  return `polygon(100% 0%, ${pts.join(", ")}, 100% 100%) border-box`;
}

async function main() {
  const [name, from] = process.argv.slice(2);
  const masters = [...Object.keys(ART), ...Object.keys(SPLIT)];
  if (name) {
    if (!masters.includes(name) || !from) throw new Error(`usage: gen-front-art.mjs <${masters.join("|")}> <file>`);
    await copyFile(resolve(process.cwd(), from), resolve(SRC, `${name}.webp`));
    console.log(`  master ${name} <- ${from}`);
  }

  await mkdir(OUT, { recursive: true });
  const dims = {};
  const shapes = {};

  /** `source` is a file path, or `{ data, width, height }` raw RGBA for a card cut from a strip. */
  const emit = async (key, source, box, w) => {
    const h = Math.round((w * box.height) / box.width);
    const input =
      typeof source === "string"
        ? sharp(source)
        : sharp(source.data, { raw: { width: source.width, height: source.height, channels: 4 } });
    const resized = input.ensureAlpha().extract(box).resize(w, h, { kernel: "lanczos3" });
    const data = await resized.clone().webp(WEBP).toBuffer();
    if (SHAPED.has(key)) {
      const px = await resized.clone().raw().toBuffer();
      shapes[key] = leftSilhouette(px, w, h);
    }
    await writeFile(resolve(OUT, `${key}.webp`), data);
    dims[key] = { w, h };
    console.log(`  ${key.padEnd(10)} ${w}x${h}  ${(data.length / 1024).toFixed(1)} KB`);
  };

  for (const [key, w] of Object.entries(ART)) {
    const file = resolve(SRC, `${key}.webp`);
    await emit(key, file, await bounds(file), w);
  }
  for (const [key, { n, w, maxY }] of Object.entries(SPLIT)) {
    const file = resolve(SRC, `${key}.webp`);
    const cards = await splitStrip(file, n, maxY);
    for (let i = 0; i < n; i++) await emit(`${key}-${i + 1}`, cards[i].raw, cards[i].box, w);
  }

  const entries = Object.entries(dims)
    .map(([k, d]) => `  ${JSON.stringify(k)}: { src: "/art/${k}.webp", w: ${d.w}, h: ${d.h} },`)
    .join("\n");
  await writeFile(
    MODULE,
    `/**
 * GENERATED — do not edit. Run \`node scripts/gen-front-art.mjs\` instead.
 *
 * Front-page and page-2 collage art in public/art/, from scripts/assets/front/. Sizes are the
 * intrinsic pixel dimensions of each file, used to reserve the <img> box.
 */

export const FRONT_ART = {
${entries}
} as const;

export type FrontArtKey = keyof typeof FRONT_ART;

/** The left silhouettes of the pictures the type wraps, as CSS \`shape-outside\` values. */
export const HERO_SHAPE =
  "${shapes.hero}";

export const CAMPUS_SHAPE =
  "${shapes.campus}";
`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
