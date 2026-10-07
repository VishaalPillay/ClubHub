import * as THREE from "three";
import { resolveFont } from "./collegeStrip";

/**
 * The lettering on and in the folder — a rubber stamp, a typed file line, a scribble on
 * a sticky note, the print on a ticket stub — painted once into one small canvas.
 *
 * Painted in the browser rather than shipped as an image: it costs no download, so it
 * can be on the very first frame (a stamp that popped onto the cover a second after the
 * folder appeared would be the one thing anybody noticed), and it is set in the page's
 * own faces (Space Grotesk for the stamp and the ticket), so it belongs to the edition.
 * The typed line asks for Courier New, the sticky note for whatever handwriting face the
 * system has; both fall back to the page's fonts.
 *
 * The canvas is a MASK — white on transparent, read through `.a` — and the shaders do the
 * inking: the stamp's uneven pressure and missing specks, the ballpoint's colour.
 */

const W = 1024;
const H = 640;

type Rect = { x: number; y: number; w: number; h: number };
const STAMP: Rect = { x: 0, y: 0, w: 1024, h: 300 };
const TYPED: Rect = { x: 0, y: 300, w: 1024, h: 100 };
const STICKY: Rect = { x: 0, y: 400, w: 320, h: 240 };
const TICKET: Rect = { x: 320, y: 400, w: 704, h: 120 };

/** A region as (u0, v0, du, dv) in texture space. CanvasTexture flips Y, so v runs up
 *  from the bottom of the canvas. Local (0, 0) is the region's bottom-left. */
const uv = (r: Rect) => new THREE.Vector4(r.x / W, 1 - (r.y + r.h) / H, r.w / W, r.h / H);

export const DECAL_UV = {
  stamp: uv(STAMP),
  typed: uv(TYPED),
  sticky: uv(STICKY),
  ticket: uv(TICKET),
};
/** Width over height of each region, so a decal can be placed by its width alone. */
export const DECAL_ASPECT = {
  stamp: STAMP.w / STAMP.h,
  typed: TYPED.w / TYPED.h,
  sticky: STICKY.w / STICKY.h,
  ticket: TICKET.w / TICKET.h,
};

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

function paint(ctx: Ctx, grotesk: string) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  /* Fit a line of text to a width: set at `px`, shrunk if it would run over. */
  const fit = (text: string, weight: number, px: number, family: string, max: number) => {
    ctx.font = `${weight} ${px}px ${family}`;
    const w = ctx.measureText(text).width;
    if (w > max) ctx.font = `${weight} ${Math.floor((px * max) / w)}px ${family}`;
  };

  // ── The stamp: a double rule round three lines, in the edition's grotesk.
  {
    const { x, y, w, h } = STAMP;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.roundRect(x + 14, y + 14, w - 28, h - 28, 26);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(x + 38, y + 38, w - 76, h - 76, 14);
    ctx.stroke();
    ctx.letterSpacing = "10px";
    fit("RECEIVED  ·  2026", 600, 34, grotesk, w - 160);
    ctx.fillText("RECEIVED  ·  2026", x + w / 2, y + 76);
    ctx.letterSpacing = "6px";
    fit("CLUB BUSINESS", 700, 116, grotesk, w - 130);
    ctx.fillText("CLUB BUSINESS", x + w / 2, y + 156);
    ctx.letterSpacing = "8px";
    fit("EDITION 01 · HANDLE WITH CARE", 600, 36, grotesk, w - 160);
    ctx.fillText("EDITION 01 · HANDLE WITH CARE", x + w / 2, y + 230);
  }

  // ── A typed line for under the label.
  {
    const { x, y, w, h } = TYPED;
    ctx.letterSpacing = "2px";
    ctx.textAlign = "left";
    const line = "FILE Nº 01 — THE CLUB OPERATIONS PAPER";
    fit(line, 400, 50, `"Courier New", Courier, ${grotesk}`, w - 32);
    ctx.fillText(line, x + 16, y + h / 2);
    ctx.textAlign = "center";
  }

  // ── The sticky note: two scribbled lines, a wavy underline and a star.
  {
    const { x, y, w } = STICKY;
    const hand = `"Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", cursive`;
    ctx.letterSpacing = "0px";
    fit("club fair", 700, 54, hand, w - 40);
    ctx.fillText("club fair", x + w / 2 - 10, y + 62);
    fit("Fri · 4pm!", 700, 50, hand, w - 50);
    ctx.fillText("Fri · 4pm!", x + w / 2, y + 132);
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const px = x + 40 + (i / 24) * (w - 90);
      const py = y + 182 + Math.sin(i * 0.9) * 5;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      const px = x + w - 34 + Math.cos(a) * 18;
      const py = y + 34 + Math.sin(a) * 18;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // ── The ticket stub.
  {
    const { x, y, w, h } = TICKET;
    ctx.letterSpacing = "12px";
    fit("ADMIT ONE", 800, 66, grotesk, w - 60);
    ctx.fillText("ADMIT ONE", x + w / 2, y + h * 0.4);
    ctx.letterSpacing = "6px";
    fit("CLUB FAIR · Nº 0418", 600, 28, grotesk, w - 80);
    ctx.fillText("CLUB FAIR · Nº 0418", x + w / 2, y + h * 0.82);
  }
}

export function createFolderDecals() {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d") as Ctx | null;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 4;
  if (!ctx) return { texture, dispose: () => texture.dispose() };

  const grotesk = resolveFont("--font-mono");
  paint(ctx, grotesk);
  texture.needsUpdate = true;

  /* The page's fonts are almost always in by the time the scene mounts. If the grotesk
     was not, paint again when it is — the first coat used the fallback face. */
  let live = true;
  if (document.fonts && !document.fonts.check(`700 40px ${grotesk}`)) {
    void document.fonts.ready.then(() => {
      if (!live) return;
      paint(ctx, grotesk);
      texture.needsUpdate = true;
    });
  }

  return {
    texture,
    dispose: () => {
      live = false;
      texture.dispose();
    },
  };
}
