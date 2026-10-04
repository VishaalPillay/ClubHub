/**
 * Builds the college logos for the front page's "Available at" ticker.
 *
 *   node scripts/gen-college-logos.mjs
 *
 * Reads every image in `scripts/assets/colleges/` — the FILE NAME (minus extension) is the
 * college id from `landing/src/features/newspaper/colleges.ts`, e.g. `srm.png`, `mit-wpu.webp`,
 * `thapar.png` — and writes
 *
 *   landing/public/colleges/<id>.webp                 trimmed, <=128px tall, transparent
 *   landing/src/features/newspaper/collegeLogos.ts    which ids have a logo, and their size
 *
 * A college with no file here is not broken: the ticker sets it as a bare name with a small
 * red bullet. So the strip is complete with zero logos and fills in one logo at a time.
 * After running this: `npm run build && npm run pages:render` in `landing/` (the baked page
 * texture shows the first few chips; the 3D scene paints the rest live).
 *
 * ── It also checks the claim ─────────────────────────────────────────────────
 * Every string in a `names: [...]` list in colleges.ts must exist verbatim in the sign-up
 * picker (`frontend/src/data/collegesIndia.ts`). "Available at X" is true exactly when a
 * student of X can select it at registration; a typo or an aspirational entry would make the
 * strip say something the product does not do, so this fails the run instead of warning.
 *
 * ── White backgrounds ────────────────────────────────────────────────────────
 * Several of the supplied files are opaque, with the mark on a white box. On cream paper that
 * is a visible white rectangle. Near-white pixels CONNECTED TO THE IMAGE BORDER are made
 * transparent (a flood from the edge, so white inside a mark — letters, highlights — is kept).
 * That is the only edit made to a mark; nothing is recoloured, redrawn or tidied.
 *
 * ── Where the logos come from is not this script's business ──────────────────
 * Every logo here is the registered mark of an institution that has not agreed to be associated
 * with ClubHub. The ticker says "Available at" and nothing more; keep it that way. See
 * `scripts/assets/colleges/SOURCES.md` for where each file came from and under what tag.
 *
 * ── Why 128px ────────────────────────────────────────────────────────────────
 * Drawn ~20 CSS px tall on the sheet, ~60px in the 3x page texture and in the live canvas.
 * 128 keeps a 2x margin over that. Smaller sources are never enlarged.
 */

import { createRequire } from "node:module";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* sharp is a devDependency of landing/ only — there is no root package.json. */
const require = createRequire(resolve(ROOT, "landing/package.json"));
const sharp = require("sharp");

const SRC = resolve(ROOT, "scripts/assets/colleges");
const OUT = resolve(ROOT, "landing/public/colleges");
const MODULE = resolve(ROOT, "landing/src/features/newspaper/collegeLogos.ts");
const COLLEGES_TS = resolve(ROOT, "landing/src/features/newspaper/colleges.ts");
const PICKER_TS = resolve(ROOT, "frontend/src/data/collegesIndia.ts");
const STATS_MODULE = resolve(ROOT, "landing/src/features/newspaper/pickerStats.ts");

const HEIGHT = 128;
const MAX_WIDTH = 384;
/** Working height for the background flood: big enough that edge pixels are not the mark. */
const WORK_HEIGHT = 384;
const EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

/** A pixel is "paper white" when every channel is at least this. */
const WHITE = 238;

/** Makes near-white pixels connected to the image border transparent. */
function floodBorderWhite({ data, width: w, height: h }) {
  const out = Buffer.from(data);
  const isWhite = (i) => {
    const o = i * 4;
    return out[o + 3] < 8 || (out[o] >= WHITE && out[o + 1] >= WHITE && out[o + 2] >= WHITE);
  };
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const push = (i) => {
    if (!seen[i] && isWhite(i)) {
      seen[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (head < tail) {
    const i = queue[head++];
    out[i * 4 + 3] = 0;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  return { data: out, width: w, height: h };
}

async function checkNames() {
  const colleges = await readFile(COLLEGES_TS, "utf8");
  const picker = await readFile(PICKER_TS, "utf8");
  const bad = [];
  for (const block of colleges.matchAll(/names:\s*\[([\s\S]*?)\]/g)) {
    for (const s of block[1].matchAll(/"([^"]+)"/g)) {
      if (!picker.includes(`"${s[1]}"`)) bad.push(s[1]);
    }
  }
  if (bad.length) {
    console.error("\n  These names in colleges.ts are NOT in the sign-up picker:");
    for (const b of bad) console.error(`    - ${b}`);
    console.error("  Copy the exact string from frontend/src/data/collegesIndia.ts, or remove the entry.\n");
    process.exit(1);
  }
  return [...colleges.matchAll(/\bid:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
}

/**
 * How many colleges and states/UTs the sign-up picker really offers. Page 2 prints these, and a
 * number on a landing page has to be one the product can back up — so it is counted from the
 * picker itself each run, never typed.
 */
async function writePickerStats() {
  const picker = await readFile(PICKER_TS, "utf8");
  const start = picker.indexOf("export const COLLEGES_INDIA");
  const body = picker.slice(start, picker.indexOf("\n};", start));
  // State keys are quoted only when they contain a space ("Tamil Nadu" vs Kerala).
  const regions = [...body.matchAll(/^\s{2}(?:"[^"]+"|\w+):\s*\[\s*$/gm)].length;
  const colleges = [...body.matchAll(/^\s{4}"[^"]+",?\s*$/gm)].length;
  await writeFile(
    STATS_MODULE,
    `/**
 * GENERATED — do not edit. Run \`node scripts/gen-college-logos.mjs\` instead.
 *
 * Counted from frontend/src/data/collegesIndia.ts (the sign-up picker) on the last run.
 */

export const PICKER_COLLEGES = ${colleges};
export const PICKER_REGIONS = ${regions};
`,
  );
  console.log(`  picker: ${colleges} colleges, ${regions} states and UTs`);
}

async function main() {
  await writePickerStats();
  await mkdir(SRC, { recursive: true });
  await mkdir(OUT, { recursive: true });

  const known = await checkNames();

  // Rebuilt from scratch, so a removed master removes its output.
  for (const f of await readdir(OUT)) if (f.endsWith(".webp")) await rm(resolve(OUT, f));

  const files = (await readdir(SRC)).filter((f) => EXT.has(extname(f).toLowerCase())).sort();
  const made = {};

  for (const f of files) {
    const id = basename(f, extname(f)).toLowerCase();
    if (!known.includes(id)) {
      console.warn(`  skip   ${f} — "${id}" is not an id in colleges.ts`);
      continue;
    }
    const input = resolve(SRC, f);

    // 1. To a working size, with an alpha channel.
    const work = await sharp(input, { density: 300 })
      .ensureAlpha()
      .resize({ height: WORK_HEIGHT, width: WORK_HEIGHT * 4, fit: "inside", withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // 2. Drop a white box around the mark, if there is one.
    const cleared = floodBorderWhite({ data: work.data, width: work.info.width, height: work.info.height });

    // 3. Trim to the mark itself, then to the final size.
    const trimmed = await sharp(cleared.data, {
      raw: { width: cleared.width, height: cleared.height, channels: 4 },
    })
      .trim({ threshold: 4 })
      .png()
      .toBuffer();

    const buf = await sharp(trimmed)
      .resize({ height: HEIGHT, width: MAX_WIDTH, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 92, alphaQuality: 100, effort: 6 })
      .toBuffer();
    const out = await sharp(buf).metadata();
    await writeFile(resolve(OUT, `${id}.webp`), buf);
    made[id] = { src: `/colleges/${id}.webp`, w: out.width, h: out.height };
    console.log(`  ${id.padEnd(11)} ${out.width}x${out.height}  ${(buf.length / 1024).toFixed(1)} KB`);
  }

  const entries = Object.entries(made)
    .map(([id, d]) => `  "${id}": { src: "${d.src}", w: ${d.w}, h: ${d.h} },`)
    .join("\n");

  await writeFile(
    MODULE,
    `/**
 * GENERATED — do not edit. Run \`node scripts/gen-college-logos.mjs\` instead.
 *
 * Logos that exist in public/colleges/, keyed by College.id, with intrinsic size. A college
 * with no entry is set as a bare name in the strip.
 */

export interface CollegeLogo {
  src: string;
  w: number;
  h: number;
}

export const COLLEGE_LOGOS: Readonly<Record<string, CollegeLogo>> = {${entries ? `\n${entries}\n` : ""}};
`,
  );

  const missing = known.filter((id) => !(id in made));
  console.log(
    `\n  ${Object.keys(made).length}/${known.length} logos.${missing.length ? ` Without a logo (set as names): ${missing.join(", ")}` : ""}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
