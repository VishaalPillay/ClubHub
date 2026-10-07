import * as THREE from "three";
import { COLLEGES } from "../newspaper/colleges";
import { COLLEGE_LOGOS } from "../newspaper/collegeLogos";

/**
 * The live "Available at" ticker on page 1.
 *
 * The page textures are photographs (`npm run pages:render`), so on their own the ticker
 * would be a still frame — a carousel that does not move. This paints just that patch,
 * every frame, onto a canvas the leaf shader lays over the baked texture.
 *
 * Where the patch is comes from `public/pages/meta.json`, written by the same script that
 * photographs the page: the box of the `[data-college-window]` element, as fractions of the
 * page. Nothing here hard-codes a position, so it cannot drift from the layout.
 *
 * Proportions are copied from `.np-college*` in newspaper.css, in units of the window's
 * height (the DOM sizes everything in cqw, and the window is 4.6cqw tall):
 *
 *   chip text   0.424 of the window  (1.95cqw)       gap logo→text   0.6 em
 *   logo        0.74  of the window  (3.4cqw), in a box up to 3.48 windows wide (16cqw), the mark
 *               contained and centred inside it                chip padding    2.4 em
 *   bullet      0.5 em square, red, only when a college has no logo
 *
 * The canvas fully covers the baked version, so a mismatch is invisible while it runs and
 * the baked frame is only ever seen if this fails to start — which is why the baked one is
 * kept legible rather than blanked.
 */

/** Fractions of the page, from its top-left corner. */
export interface StripRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Width of the baked page texture; only used to size this canvas to match its pixels. */
const PAGE_TEX_W = 1722;
const PAGE_ASPECT = 1.38;

const PAPER = "#f8eedf";
const INK = "#16150f";
const RED = "#b41c14";

/** Chip text size relative to the window's height — see the header. */
const TEXT = 0.424;
const LOGO = 0.74;
/** Widest a logo box may be, in window heights (16cqw / 4.6cqw). Wider marks shrink to fit. */
const LOGO_MAX_W = 3.48;
/** Scroll speed in chip-text heights per second. ~25 CSS px/s on the sheet. */
const SPEED = 2.2;
const FADE = 0.06;

export interface CollegeStrip {
  texture: THREE.CanvasTexture;
  /** (u0, v0, du, dv) of the patch in the front texture's UV space. */
  uvRect: THREE.Vector4;
  update: (seconds: number) => void;
  dispose: () => void;
}

/** The resolved font stack behind a `--font-*` variable (next/font gives it a hashed
 *  name, so a canvas cannot simply ask for "Inter"). */
export function resolveFont(variable: string, fallback = "sans-serif"): string {
  const probe = document.createElement("span");
  probe.style.cssText = `position:absolute;visibility:hidden;font-family:var(${variable})`;
  probe.textContent = "x";
  document.body.appendChild(probe);
  const family = getComputedStyle(probe).fontFamily;
  probe.remove();
  return family || fallback;
}

/** The resolved font stack behind `--font-ui`. */
export function resolveUiFont(): string {
  return resolveFont("--font-ui");
}

export function createCollegeStrip(rect: StripRect, family: string): CollegeStrip {
  const W = Math.max(64, Math.round(rect.w * PAGE_TEX_W));
  const H = Math.max(16, Math.round(rect.h * PAGE_TEX_W * PAGE_ASPECT));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  const fs = H * TEXT;
  const logoH = H * LOGO;
  const gap = fs * 0.6;
  const pad = fs * 2.4;
  const bullet = fs * 0.5;

  // Logos load in the background; a chip draws its bullet until its logo is ready.
  const logos = new Map<string, HTMLImageElement>();
  for (const c of COLLEGES) {
    const l = COLLEGE_LOGOS[c.id];
    if (!l) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = l.src;
    logos.set(c.id, img);
  }

  ctx.font = `700 ${fs}px ${family}`;
  // Chrome and Safari 17+ — elsewhere it is simply ignored and the chips are 4% tighter.
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(fs * 0.04).toFixed(2)}px`;
  ctx.textBaseline = "middle";

  const labels = COLLEGES.map((c) => c.short.toUpperCase());
  const widths = labels.map((t) => ctx.measureText(t).width);

  const isReady = (i: number) => {
    const img = logos.get(COLLEGES[i].id);
    return !!(img && img.complete && img.naturalWidth > 0 && COLLEGE_LOGOS[COLLEGES[i].id]);
  };
  /** A wordmark logo already says the name, so its text label is dropped — but only once the
   *  logo has actually loaded; until then the chip falls back to bullet + name. */
  const hasName = (i: number) => !(isReady(i) && COLLEGES[i].wordmark);

  const chipWidth = (i: number) => {
    const l = COLLEGE_LOGOS[COLLEGES[i].id];
    const lead = isReady(i) ? Math.min((logoH * l.w) / l.h, H * LOGO_MAX_W) : bullet;
    return lead + (hasName(i) ? gap + widths[i] : 0) + pad;
  };

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;

  const draw = (seconds: number) => {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    // Re-measured every frame: a logo that finishes loading mid-scroll changes its chip.
    const ws = COLLEGES.map((_, i) => chipWidth(i));
    const loop = ws.reduce((a, b) => a + b, 0);
    // Start a little in, matching the baked frame, so the first name is clear of the fade.
    let x = fs * 1.1 - ((seconds * SPEED * fs) % loop);

    while (x < W) {
      for (let i = 0; i < COLLEGES.length && x < W; i++) {
        const w = ws[i];
        if (x + w > 0) {
          const img = logos.get(COLLEGES[i].id);
          const l = COLLEGE_LOGOS[COLLEGES[i].id];
          let cx = x;
          if (img && img.complete && img.naturalWidth > 0 && l) {
            // The CSS box is `height: 3.4cqw; width: auto; max-width: 16cqw` with the image
            // `object-fit: contain` — so a very wide mark is scaled down, never stretched.
            const boxW = Math.min((logoH * l.w) / l.h, H * LOGO_MAX_W);
            const k = Math.min(boxW / l.w, logoH / l.h);
            const dw = l.w * k;
            const dh = l.h * k;
            ctx.drawImage(img, cx + (boxW - dw) / 2, (H - dh) / 2, dw, dh);
            cx += boxW;
          } else {
            ctx.fillStyle = RED;
            ctx.fillRect(cx, (H - bullet) / 2, bullet, bullet);
            cx += bullet;
          }
          if (hasName(i)) {
            ctx.fillStyle = INK;
            ctx.fillText(labels[i], cx + gap, H / 2 + fs * 0.04);
          }
        }
        x += w;
      }
    }

    // The same soft ends the CSS mask gives the baked ticker.
    for (const [from, to, a, b] of [
      [0, W * FADE, 1, 0],
      [W * (1 - FADE), W, 0, 1],
    ] as const) {
      const g = ctx.createLinearGradient(from, 0, to, 0);
      g.addColorStop(0, `rgba(248,238,223,${a})`);
      g.addColorStop(1, `rgba(248,238,223,${b})`);
      ctx.fillStyle = g;
      ctx.fillRect(from, 0, to - from, H);
    }

    texture.needsUpdate = true;
  };

  draw(0);

  return {
    texture,
    // Page UVs run bottom-up, the rect is measured from the top.
    uvRect: new THREE.Vector4(rect.x, 1 - (rect.y + rect.h), rect.w, rect.h),
    update: draw,
    dispose: () => texture.dispose(),
  };
}
