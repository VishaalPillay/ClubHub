/**
 * Rasterises the eight editorial pages into textures for the 3D scene.
 *
 *   npm run pages:render      (after `npm run build`)
 *
 * ── Why a screenshot and not a rebuild ───────────────────────────────────────
 * The pages are already designed, in HTML and CSS, and they are good. Rebuilding
 * them as textures by hand would throw that away and make every copy edit a
 * layout job. So the real pages are rendered by a real browser and photographed.
 * The HTML stays the source of truth; these files are derived artefacts.
 *
 * ── Why the output is committed ──────────────────────────────────────────────
 * Not run during the Cloudflare Pages build. A headless browser in a CDN build
 * step is a fragile dependency for something that changes only when the copy
 * does. Run it locally, commit the AVIFs, done.
 *
 * ── Render mode ──────────────────────────────────────────────────────────────
 * Paper mode no longer puts the pages in the DOM — it is a WebGL canvas, and the
 * pages inside it are the very textures this script produces. Plain mode does
 * render them, but at a different (clamped) type scale.
 *
 * So neither reading mode is photographable, and `data-render="page"` exists for
 * exactly this: plain-mode DOM, laid out at the sheet's 574x792 geometry, sharing
 * the paper-mode `cqw` type scale. See the RENDER MODE block in newspaper.css.
 * Without it the pipeline could not be re-run when the copy changes.
 */

import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";

const OUT_DIR = resolve("out");
const DEST_DIR = resolve("public/pages");

/** Fixed so `--np-page-w/h` resolve to exactly 574x792 — the aspect the 3D
 *  leaves are built to. Changing this changes PAGE_ASPECT in sceneConfig.ts. */
const VIEWPORT = { width: 1440, height: 900 };

/** 3x. The sheet is read at 650-760 CSS px wide on a laptop and on a 2x display that is
 *  1300-1500 device pixels; a 2x texture (1148px) is magnified there, and the small type is
 *  the first thing to go soft. 3x (1722px) is the smallest size that stays at or above
 *  1:1 on those screens. Cost: ~1.75x the texture memory, which is why this stays at 3
 *  and not 4. */
const SCALE = 3;

/* Flat type on paper compresses very well in AVIF, so the extra pixels cost far less
   than the 2.25x they add; quality is held up because text edges are what ring first. */
const AVIF = { quality: 64, effort: 6 };

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
};

/** Minimal static server. A dependency-free 30 lines beats spawning `serve` and
 *  guessing when it is ready. */
function serve(root) {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const url = decodeURIComponent((req.url || "/").split("?")[0]);
      let file = join(root, url);
      if (url.endsWith("/")) file = join(file, "index.html");
      createReadStream(file)
        .on("error", () => {
          // Next's export writes /index.html for "/" and <route>.html otherwise.
          createReadStream(join(root, url + ".html"))
            .on("error", () => {
              res.writeHead(404);
              res.end("not found");
            })
            .on("open", () => res.writeHead(200, { "content-type": "text/html; charset=utf-8" }))
            .pipe(res);
        })
        .on("open", () =>
          res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" }),
        )
        .pipe(res);
    });
    server.listen(0, "127.0.0.1", () => ok({ server, port: server.address().port }));
  });
}

/** Chrome that must not appear in a page texture. Everything else is handled by
 *  the `data-render="page"` rules in newspaper.css. */
const HIDE_CHROME = `
  html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
  .np-scope .np-controls, .np-scope .np-progress, .np-scope .np-skiplinks { display: none !important; }
`;

async function main() {
  try {
    await stat(OUT_DIR);
  } catch {
    console.error("No out/ directory. Run `npm run build` first.");
    process.exit(1);
  }

  const { server, port } = await serve(OUT_DIR);
  await mkdir(DEST_DIR, { recursive: true });

  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: "light",
    reducedMotion: "no-preference",
  });

  /* Plain mode, so the eight articles are really in the DOM and in normal flow.
     The delivery animation is marked seen so nothing covers what we photograph. */
  await context.addInitScript(() => {
    try {
      localStorage.setItem("clubhub:reading-mode", "plain");
    } catch {}
  });

  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  await page.waitForSelector(".np-page-body", { timeout: 15000 });

  /* Switch the pages into render geometry. Set on the element rather than passed
     as a URL flag so nothing about it can ship to a real visitor. */
  await page.evaluate(() => {
    document.querySelector(".np-scope")?.setAttribute("data-render", "page");
  });
  await page.addStyleTag({ content: HIDE_CHROME });

  // Self-hosted next/font files load late enough to photograph a fallback face.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  const faces = await page.$$(".np-page-body");
  if (faces.length !== 8) {
    console.error(`Expected 8 pages, found ${faces.length}. Aborting.`);
    await browser.close();
    server.close();
    process.exit(1);
  }

  /* The 3D scene animates the "Available at" ticker on page 1 live (a canvas laid over the
     baked texture), so it has to know where on the sheet that window is. Recorded as
     fractions of the page — resolution-independent, so it survives a change of SCALE or of
     the sheet's CSS size. */
  const strip = await faces[0].evaluate((face) => {
    const el = face.querySelector("[data-college-window]");
    if (!el) return null;
    const f = face.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      x: (r.left - f.left) / f.width,
      y: (r.top - f.top) / f.height,
      w: r.width / f.width,
      h: r.height / f.height,
    };
  });
  await writeFile(join(DEST_DIR, "meta.json"), JSON.stringify({ colleges: strip }, null, 2) + "\n");

  /* A page is a fixed-height sheet with `overflow: hidden`, so content past the
     bottom is not scrolled, it is photographed away. Measure before shooting and
     fail the run: a clipped texture ships silently otherwise. */
  const overflows = [];
  for (let i = 0; i < faces.length; i++) {
    const over = await faces[i].evaluate((el) => el.scrollHeight - el.clientHeight);
    if (over > 1) overflows.push(`${String(i + 1).padStart(2, "0")} (+${over}px)`);
  }

  for (let i = 0; i < faces.length; i++) {
    const png = await faces[i].screenshot({ type: "png" });
    const name = String(i + 1).padStart(2, "0");
    const out = join(DEST_DIR, `${name}.avif`);
    await writeFile(out, await sharp(png).avif(AVIF).toBuffer());
    const { size } = await stat(out);
    const meta = await sharp(png).metadata();
    console.log(`  ${name}.avif  ${meta.width}x${meta.height}  ${(size / 1024).toFixed(0)} KB`);
  }

  await browser.close();
  server.close();

  const files = (await readdir(DEST_DIR)).filter((f) => f.endsWith(".avif"));
  let total = 0;
  for (const f of files) total += (await stat(join(DEST_DIR, f))).size;
  console.log(`\n  ${files.length} textures, ${(total / 1024 / 1024).toFixed(2)} MB total`);
  if (overflows.length) {
    console.error(`
  OVERFLOW — content is clipped on page(s): ${overflows.join(", ")}`);
    process.exit(1);
  }
  console.log("  This is the payload figure the plan flagged as the one to watch.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
