/**
 * Turns any room photograph into the scene's backdrop.
 *
 *   npm run backdrop:prep -- <path-to-photo>
 *
 * You supply an ordinary image; this does the rest. Because the backdrop is
 * heavily out of focus, two things follow that make it almost free:
 *
 *   · Resolution does not matter. Blurred, a 640px image is indistinguishable
 *     from a 4K one, so the output lands around 15-20KB.
 *   · Framing does not matter much either. The result is mapped onto a sphere
 *     and no viewer can tell an ordinary snapshot from an equirectangular
 *     capture once it has been blurred this hard.
 *
 * What DOES matter is tone. Pick something warm and dim with soft light — a
 * study, a library, a cafe interior. Avoid anything with a bright window or a
 * hard highlight: it will pull the eye off the newspaper, which is the one
 * thing on screen that has to be read.
 */

import { access, mkdir, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import sharp from "sharp";

const DEST_DIR = resolve("public/backdrop");
const DEST = resolve(DEST_DIR, "room.avif");

/** Wide enough to wrap a sphere without the seam being obvious, small enough to
 *  be negligible. Everything above this is thrown away by the blur anyway. */
const WIDTH = 768;
const HEIGHT = 384;

/** Heavy on purpose. This should not resolve into anything recognisable. */
const BLUR = 22;

async function main() {
  const src = process.argv[2];
  if (!src) {
    console.error("Usage: npm run backdrop:prep -- <path-to-photo>");
    process.exit(1);
  }

  try {
    await access(src);
  } catch {
    console.error(`Cannot read ${src}`);
    process.exit(1);
  }

  await mkdir(DEST_DIR, { recursive: true });

  await sharp(src)
    .resize(WIDTH, HEIGHT, { fit: "cover" })
    .blur(BLUR)
    // Pulled down and slightly desaturated so it sits behind the paper rather
    // than beside it. Fine tuning happens in the shader, not here.
    .modulate({ brightness: 0.72, saturation: 0.75 })
    .avif({ quality: 55, effort: 6 })
    .toFile(DEST);

  const { size } = await stat(DEST);
  console.log(`  ${basename(src)} -> public/backdrop/room.avif  ${(size / 1024).toFixed(1)} KB`);
  console.log("");
  console.log("  Now set BACKDROP_SRC in src/features/scene/Backdrop.tsx:");
  console.log('    const BACKDROP_SRC: string | null = "/backdrop/room.avif";');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
