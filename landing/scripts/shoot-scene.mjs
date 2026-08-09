/**
 * Screenshots the live 3D scene at a given scroll step.
 *
 *   npm run scene:shot -- <step> [outfile] [phase]
 *
 * `phase` is morning | evening | night and overrides the wall clock, so a
 * time-of-day that is not the current hour can still be checked.
 *
 * Exists because a WebGL scene cannot be checked by reading the DOM. Nothing
 * about the camera framing, the page curl, which texture landed on which face,
 * or the lighting shows up in `getComputedStyle` — it is all in a canvas, and
 * the only honest way to verify it is to look at a picture of it.
 *
 * Requires `npm run build` first; it serves out/ exactly as the CDN would.
 */

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright-core";

const OUT_DIR = resolve("out");
const VIEWPORT = { width: 1440, height: 900 };

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".ico": "image/x-icon",
};

function serve(root) {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const url = decodeURIComponent((req.url || "/").split("?")[0]);
      let file = join(root, url);
      if (url.endsWith("/")) file = join(file, "index.html");
      createReadStream(file)
        .on("error", () => {
          if (!res.headersSent) res.writeHead(404);
          res.end("not found");
        })
        .on("open", () =>
          res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" }),
        )
        .pipe(res);
    });
    server.listen(0, "127.0.0.1", () => ok({ server, port: server.address().port }));
  });
}

/** Hour to force for each phase. Mirrors phaseForHour in timeOfDay.ts. */
const PHASE_HOUR = { morning: 9, evening: 18, night: 22 };

async function main() {
  const step = Number(process.argv[2] ?? 0);
  const outFile = resolve(process.argv[3] ?? `scene-step-${step}.png`);
  const phase = process.argv[4];
  if (phase && !(phase in PHASE_HOUR)) {
    console.error(`Unknown phase "${phase}". Expected: ${Object.keys(PHASE_HOUR).join(", ")}`);
    process.exit(1);
  }

  try {
    await stat(OUT_DIR);
  } catch {
    console.error("No out/ directory. Run `npm run build` first.");
    process.exit(1);
  }

  const { server, port } = await serve(OUT_DIR);

  const browser = await chromium.launch({
    channel: "chrome",
    // Headless Chrome needs to be told it may rasterise WebGL in software; a
    // build machine has no GPU worth speaking of and would otherwise hand back
    // a null context, which looks exactly like a broken scene.
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "no-preference",
  });

  await context.addInitScript(
    ({ hour }) => {
      try {
        localStorage.setItem("clubhub:reading-mode", "paper");
      } catch {}
      /* Only `getHours` is replaced, never the Date constructor. Swapping the
         whole class breaks any caller that invokes `Date()` without `new`, which
         is enough to take the page down before it renders. */
      if (hour !== undefined) Date.prototype.getHours = () => hour;
    },
    { hour: phase ? PHASE_HOUR[phase] : undefined },
  );

  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") console.error("  [console]", m.text());
    else if (process.env.SCENE_DEBUG) console.log("  [console]", m.text());
  });
  page.on("pageerror", (e) => console.error("  [pageerror]", e.message));

  /* NOT networkidle: a looping backdrop keeps the connection busy, so the page
     never reaches idle and the wait times out. */
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".np-canvas canvas", { timeout: 30000 });
  await page.waitForTimeout(2500);

  // Drive the real scrollbar, the way Lenis and useScroll both expect.
  // The step count is READ from the page rather than assumed: it changed when
  // the camera lead-in was added, and a hardcoded divisor silently shoots the
  // wrong scroll position while looking like a scene bug.
  await page.evaluate((s) => {
    const track = document.querySelector(".np-track");
    const scope = document.querySelector(".np-scope");
    if (!track || !scope) return;
    const steps = Number(getComputedStyle(scope).getPropertyValue("--np-steps")) || 4;
    const px = (track.offsetHeight - window.innerHeight) / steps;
    window.scrollTo(0, track.offsetTop + s * px);
  }, step);

  // Long enough for Lenis to settle and the textures to have decoded.
  await page.waitForTimeout(2500);
  await page.screenshot({ path: outFile });
  console.log(`  step ${step}${phase ? ` (${phase})` : ""} -> ${outFile}`);

  await browser.close();
  server.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
