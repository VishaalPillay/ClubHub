/**
 * What the page actually looks like while it loads, frame by frame.
 *
 *   npm run perf:timeline                 # throttled to 8 Mbps
 *   NO_THROTTLE=1 npm run perf:timeline   # localhost speed
 *   SHOT_DIR=... npm run perf:timeline    # also write screenshots
 *
 * Written because a load-order bug is invisible to every other check here: the
 * build passed, nothing 404'd, no console error, and the finished page was
 * correct — yet the first 1.6 seconds showed the plain newspaper document at
 * full screen before it was replaced. Only sampling the DOM over time finds
 * that class of fault, so this samples reading mode, the backdrop and the canvas
 * at fixed offsets and prints the network ordering alongside.
 */
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright-core";

const MIME = { ".html":"text/html;charset=utf-8", ".js":"text/javascript", ".css":"text/css",
  ".woff2":"font/woff2", ".avif":"image/avif", ".png":"image/png", ".mp4":"video/mp4",
  ".ico":"image/x-icon", ".svg":"image/svg+xml" };
const root = resolve("out");
const server = createServer((q, r) => {
  const u = decodeURIComponent((q.url || "/").split("?")[0]);
  let f = join(root, u);
  if (u.endsWith("/")) f = join(f, "index.html");
  createReadStream(f)
    .on("error", () => { if (!r.headersSent) r.writeHead(404); r.end("nf"); })
    .on("open", () => r.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" }))
    .pipe(r);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await chromium.launch({ channel: "chrome",
  args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 } });
await ctx.addInitScript(() => { try { localStorage.setItem("clubhub:reading-mode", "paper"); } catch {} });
const page = await ctx.newPage();

const t0 = Date.now();
const log = [];
page.on("response", (r) => {
  const u = r.url().replace(`http://127.0.0.1:${port}`, "");
  if (/\.(avif|mp4|js|css)$/.test(u)) log.push([Date.now() - t0, r.status(), u]);
});

// Throttle a little so the ordering is visible rather than instantaneous.
if (!process.env.NO_THROTTLE) {
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false, latency: 40, downloadThroughput: (8 * 1024 * 1024) / 8, uploadThroughput: 1e6,
});
}

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "commit" });

const shots = process.env.NO_THROTTLE ? [80, 150, 300, 500, 800, 1200, 2000] : [120, 300, 600, 1000, 1600, 2600, 4000];
const dir = process.env.SHOT_DIR;
for (const at of shots) {
  const wait = at - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  const state = await page.evaluate(() => {
    const scope = document.querySelector(".np-scope");
    const stack = document.querySelector(".np-stack, .np-sr");
    const v = document.querySelector("video");
    const c = document.querySelector(".np-canvas canvas");
    return {
      mode: scope?.getAttribute("data-mode") ?? null,
      stackClass: stack?.className ?? null,
      video: v ? { ready: v.readyState, paused: v.paused } : null,
      canvas: c ? { w: c.width, h: c.height, op: getComputedStyle(c.parentElement).opacity } : null,
    };
  });
  console.log(`  ${String(at).padStart(5)}ms  mode=${state.mode}  stack=${state.stackClass}  video=${JSON.stringify(state.video)}  canvas=${JSON.stringify(state.canvas)}`);
  if (dir) await page.screenshot({ path: join(dir, `load-${at}.png`) });
}

console.log("\n  network:");
for (const [t, s, u] of log) console.log(`    ${String(t).padStart(5)}ms  ${s}  ${u}`);

await browser.close();
server.close();
