/**
 * Screenshots the live 3D scene at a given scroll step.
 *
 *   npm run scene:shot -- <step> [outfile]          a scroll position
 *   npm run scene:shot -- delivery <ms> [outfile]   the intro, N ms after load
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
          res.writeHead(404);
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

async function main() {
  const isDelivery = process.argv[2] === "delivery";
  const step = isDelivery ? 0 : Number(process.argv[2] ?? 0);
  const delayMs = isDelivery ? Number(process.argv[3] ?? 600) : 0;
  const outFile = resolve(
    (isDelivery ? process.argv[4] : process.argv[3]) ??
      (isDelivery ? `delivery-${delayMs}.png` : `scene-step-${step}.png`),
  );

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
    ({ skipIntro }) => {
      try {
        localStorage.setItem("clubhub:reading-mode", "paper");
        // Capturing the delivery means letting it play, so the seen-flag is only
        // set when we are after a scroll position instead.
        if (skipIntro) sessionStorage.setItem("clubhub:intro-seen", "1");
      } catch {}
    },
    { skipIntro: !isDelivery },
  );

  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") console.error("  [console]", m.text());
    else if (process.env.SCENE_DEBUG) console.log("  [console]", m.text());
  });
  page.on("pageerror", (e) => console.error("  [pageerror]", e.message));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  await page.waitForSelector(".np-canvas canvas", { timeout: 20000 });

  if (isDelivery) {
    // Nothing to scroll — just wait out the requested slice of the timeline.
    await page.waitForTimeout(delayMs);
    await page.screenshot({ path: outFile });
    console.log(`  delivery +${delayMs}ms -> ${outFile}`);
  } else {
    // Drive the real scrollbar, the way Lenis and useScroll both expect.
    await page.evaluate((s) => {
      const track = document.querySelector(".np-track");
      if (!track) return;
      const px = (track.offsetHeight - window.innerHeight) / 4;
      window.scrollTo(0, track.offsetTop + s * px);
    }, step);

    // Long enough for Lenis to settle and the textures to have decoded.
    await page.waitForTimeout(2500);
    await page.screenshot({ path: outFile });
    console.log(`  step ${step} -> ${outFile}`);
  }

  await browser.close();
  server.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
