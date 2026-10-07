"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import type { RoomLight } from "./roomLight";
import { ROOM_SHADING, makeProfileTexture, roomUniforms } from "./roomShading";
import {
  BOARD_T,
  FOLDER_H,
  FOLDER_W,
  LEAF_BASE_RIGHT,
  PAGE_H,
  PAGE_W,
  STACK_T,
  cordHook,
  closeProgress,
  coverOpenness,
  cordRelease,
  folderProgress,
} from "./sceneConfig";
import { DECAL_ASPECT, DECAL_UV, createFolderDecals } from "./folderDecals";
import { useScene } from "./sceneContext";
import { disposeTexture, loadTexture } from "./textures";

/**
 * The kraft folder the edition is kept in.
 *
 * Shut, it is a back board, a stack of other documents with coloured tabs and loose
 * papers poking out (SHEETS — a used folder, not a new one), the deck of page cards, and
 * a front cover held down by an elastic cord
 * wound round a button. The reader is HANDED it shut — `openness` lifts the closed
 * folder to them first (see FOLDER_SHARE in sceneConfig.ts) — and then, in front of
 * them, the cord comes off the button and the cover swings over the spine. At the far
 * end the same happens backwards: the back half of the folder closes over the pile of
 * turned pages, and only then is the shut folder set back down.
 *
 * ── The boards are solid ─────────────────────────────────────────────────────
 * Both boards are THICK PLATES (`thickPlate`): a generated solid with rounded free-side
 * corners and real edge walls, so the board's edge shows — with the laminated look of
 * pressed kraft — instead of the cover being a sheet of paper. The front cover bends as
 * it swings; the plate is deformed in the vertex shader by the same exact-arc
 * construction as a leaf (length preserved), with the thickness offset along the
 * bent normal, so the walls bend with it.
 *
 * ── Kraft ───────────────────────────────────────────────────────────────────────
 * Procedural: tonal stains, long fibres both ways, a fine crinkle web, a few softer
 * creases, dark pulp specks and light flecks — and a bump cut from the same height
 * field (Mikkelsen's surface-gradient method, from screen-space derivatives), which is
 * what makes the window bars break up over it the way they do in a photograph instead
 * of lying on it like a decal. The label and the pocket snapshots are decals in the
 * board shader, so they bend with it for free. Lit by the same ROOM_SHADING as the
 * pages, with the window bars at near full strength.
 *
 * Coordinates are the edition's: spine at x = 0, desk at y = 0, the unturned page
 * spanning x ∈ [0, PAGE_W]. The whole folder rides in the Edition group, so it pans,
 * lifts, tilts and scales with the pages it holds.
 */

const L = FOLDER_W;
const HC = FOLDER_H;
const T = BOARD_T;
/** Matches SEPARATION in Leaf.tsx. */
const SEP = 0.0016;

/** The cover's CENTRE plane when shut: its inner face just clear of the top leaf. */
const COVER_SHUT_C = LEAF_BASE_RIGHT + 4 * SEP + 0.0014 + T / 2;
/** And lying open, board on the desk, inner face up — under the turned pages. */
const COVER_OPEN_C = T / 2;
/** Outer face of the shut cover. */
const COVER_TOP = COVER_SHUT_C + T / 2;


/** A board is stiffer than a page: it flexes a little as it swings, no more. */
const COVER_CURVE = 0.42;

/** The button sits this far in from the cover's free edge, on the centre line. */
const BUTTON_IN = 0.1;
const BUTTON_R = 0.04;

/** Round corners on the free side only — the spine side is a fold, not a cut. */
const CORNER_R = 0.032;

/**
 * The cover's near free corner is bent up: the corner a thumb lifts to open it, lifted
 * once too often. EAR is where the fold line crosses, measured as (L − s) + (HC/2 − depth)
 * — a diagonal across the corner — and EAR_K the lift per unit past it (~25 degrees).
 * Done in the plate's vertex shader (`uDogEar`, the cover only), with the slope fed into
 * the normal so the bent-up flap catches the light on its own.
 */
const EAR = 0.085;
const EAR_K = 0.32;

/** The label needs a wordmark on the very first frame, so the first one is the small
 *  rendition (30 KB, plenty for a shut folder lying on the desk); the 960 replaces it
 *  once the scene is up, before the folder is close enough for the difference to show. */
const WORDMARK_FIRST = "/brand/clubhub-480.webp";
const WORDMARK_URL = "/brand/clubhub-960.webp";
const WORDMARK_ASPECT = 960 / 265;
/** The snapshots in the inside pocket — campus art the edition already ships. */
const PHOTO_A = "/art/campus.webp";
const PHOTO_B = "/art/events-2.webp";

/* ── GLSL ────────────────────────────────────────────────────────────────────── */

const KRAFT = /* glsl */ `
  float ridge(vec2 p) { return 1.0 - abs(2.0 * vnoise(p) - 1.0); }

  float fbm2(vec2 p) { return 0.65 * vnoise(p) + 0.35 * vnoise(p * 2.03 + 7.1); }

  uniform float uDetail;   // 1 full kraft, 0 colour and stains only (mid-range laptops)

  /*
   * Kraft board at p (world-ish units on the board), as (F, h): F multiplies the board's
   * colour — kraft's texture is all multiplicative, so it does not depend on which
   * colour — and h is the crinkle height, in world units, the bump is cut from.
   *
   * ONE evaluation for both. The first version computed colour and height separately:
   * the crease noises twice, two more fbm calls for the height, ~20 noise lookups a
   * pixel — and the open cover's inside fills a third of the screen in the reading pose,
   * where it ran twice more for the pocket. On a laptop's integrated GPU at retina
   * resolution that was 41 fps with a quarter of frames late: the stutter. This is 9
   * lookups (4 on the light setting), reused by every caller.
   *
   * Tonal stains, mottling, long fibres both ways, a faint crinkle web, a few softer
   * creases, dark pulp specks and light flecks.
   *
   * Pressed board is FLAT. The first version cut its bump mostly from the crinkle web, at
   * full strength, and in the low sun that read as pebbled leather, not paper. The relief
   * now is the fibres (fine streaks, both ways) and a slow warp — a board is never quite
   * planar, and the warp is what makes the light roll across it — with the crinkle a
   * whisper. The warp reuses the stain noise: no extra lookup.
   */
  vec2 kraftFH(vec2 p) {
    float blot = fbm2(p * 2.2 + 11.0);
    float mott = fbm2(p * 8.0);
    if (uDetail < 0.5) return vec2((0.84 + 0.24 * mott) * (0.9 + 0.2 * blot), 0.0);
    float fine = vnoise(p * 64.0 + 3.0);
    /* Fibres: paper has a GRAIN — most of them lie along the direction the web ran
       through the machine — so one set dominates, a little off the board's axis, and a
       weaker set crosses it at a slant. Two equal sets at right angles (the first version)
       is a weave: it read as linen. */
    vec2 ga = vec2(0.989 * p.x - 0.149 * p.y, 0.149 * p.x + 0.989 * p.y);
    vec2 gb = vec2(0.362 * p.x - 0.932 * p.y, 0.932 * p.x + 0.362 * p.y);
    float fibA = vnoise(ga * vec2(150.0, 13.0));
    float fibB = vnoise(gb * vec2(120.0, 22.0) + 5.0);
    float craze = ridge(p * 52.0 + 4.0);
    float crease = ridge(p * 13.0 + 21.0);
    /* Pulp specks, sparse and of two sizes — a dense single-size scatter is a dot grid. */
    float speck = max(step(0.9975, hash(floor(p * 240.0))), step(0.998, hash(floor(p * 110.0) + 3.0)) * 0.8);
    float fleck = step(0.9965, hash(floor(p * 130.0) + 17.0));
    float f = (0.83 + 0.26 * mott) * (0.87 + 0.22 * blot) * (0.94 + 0.1 * fine);
    f *= 0.95 + 0.14 * (fibA - 0.5) + 0.06 * (fibB - 0.5);
    f *= 0.96 + 0.05 * smoothstep(0.6, 0.97, craze);
    f *= 1.0 - 0.07 * smoothstep(0.84, 0.99, crease);
    f = mix(f, 0.5, speck * 0.5);
    f = mix(f, 1.25, fleck * 0.35);
    float h = (fibA * 0.26 + fibB * 0.1 + fine * 0.2 + craze * 0.08 + crease * 0.14) * 0.0016
            + blot * 0.006;
    return vec2(f, h);
  }

  /* Bump from a scalar height, with screen-space derivatives (Mikkelsen 2010). */
  vec3 bumpNormal(vec3 n, float h) {
    vec3 dpdx = dFdx(vWorld);
    vec3 dpdy = dFdy(vWorld);
    float dhx = dFdx(h);
    float dhy = dFdy(h);
    vec3 r1 = cross(dpdy, n);
    vec3 r2 = cross(n, dpdx);
    float det = dot(dpdx, r1);
    vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
    return normalize(abs(det) * n - grad);
  }
`;

/** Rigid solids: stack, tabs, button, cord. */
const SOLID_VERTEX = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec3 vLocal;
  varying vec3 vNormalL;
  void main() {
    vLocal = position;
    vNormalL = normal;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const SOLID_HEAD = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec3 vLocal;
  varying vec3 vNormalL;
  ${ROOM_SHADING}
`;

/** The stack of other documents: a typed letter on top, sheet edges down the sides. */
const STACK_FRAGMENT = /* glsl */ `
  ${SOLID_HEAD}
  uniform vec3 uPaper;
  void main() {
    vec3 nL = normalize(vNormalL);
    vec3 base;
    if (abs(nL.y) > 0.5) {
      base = uPaper * (0.95 + 0.06 * fbm(vLocal.xz * 30.0));
      /* The next document in the folder, seen once every leaf has been turned: a typed
         letter — a letterhead rule, then lines of type with ragged right ends and gaps
         between words. Faint, so it reads as paper underneath, not as a page to read. */
      vec2 q = vLocal.xz;
      float xn = (q.x + 0.4) / 0.8;
      float rowF = (q.y + 0.48) / 0.032;
      float row = floor(rowF);
      float inRow = fract(rowF);
      float len = 0.5 + 0.45 * hash(vec2(row, 1.0));
      float para = step(0.18, hash(vec2(floor(row / 5.0), 7.0))) * step(0.5, mod(row, 5.0) + 0.5);
      float text = step(0.0, xn) * step(xn, len) * step(-0.48, q.y) * step(q.y, 0.56)
                 * smoothstep(0.28, 0.36, inRow) * smoothstep(0.66, 0.58, inRow)
                 * step(0.22, vnoise(vec2(xn * 46.0, row * 3.1))) * step(0.5, para + 0.6);
      float head = step(abs(q.y + 0.56), 0.0022) * step(abs(q.x), 0.4);
      base *= 1.0 - 0.3 * text - 0.45 * head;
    } else {
      /* One line per sheet, each a slightly different white, each edge a little proud
         of or behind its neighbours — a stack of documents is never square. */
      float y = vLocal.y / 0.00105;
      float sheet = floor(y);
      float along = (abs(nL.x) > 0.5 ? vLocal.z : vLocal.x);
      float wob = vnoise(vec2(sheet * 1.7, along * 6.0));
      float gap = smoothstep(0.0, 0.32, fract(y)) * smoothstep(1.0, 0.68, fract(y));
      base = uPaper * (0.8 + 0.14 * hash(vec2(sheet, 3.0)) + 0.06 * wob) * mix(0.72, 1.0, gap);
    }
    vec3 col = roomShade(base, normalize(vNormalW), 0.7, 0.42);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Tabs, button, cord, gusset: a flat colour with a sheen of its own. */
const FLAT_FRAGMENT = /* glsl */ `
  ${SOLID_HEAD}
  uniform vec3 uColor;
  uniform float uSheen;
  uniform float uSheenPow;
  void main() {
    vec3 n = normalize(vNormalW);
    if (!gl_FrontFacing) n = -n;
    vec3 col = roomShade(uColor, n, 0.68, 0.5);
    col += uSun * roomSheen(n, uSheenPow) * uSheen;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * The loose papers stuffed in the folder — see SHEETS.
 *
 * Each is a plane laid in the stack at its own height, most of it inside the stack box
 * (and so hidden by it) and the rest poking out past the boards. Placed in the shader
 * (centre, turn, height) so one program draws them all. The part OUTSIDE the boards —
 * `out`, its distance past the folder's outline — is what moves: it droops under its own
 * weight (a sticky note curls up instead), and it flutters, a little all the time in the
 * draught from the window and properly while the folder is being moved (`uFlutter`). The
 * flutter's phase comes from the point's position, not the sheet, so two sheets lying on
 * top of each other flap together and never pass through one another.
 */
const SHEET_VERTEX = /* glsl */ `
  uniform vec3 uC;         // centre: x across, y height in the stack, z depth
  uniform float uRot;      // turned about the vertical
  uniform float uSag;      // >0 the free end droops, <0 it curls up
  uniform float uFlap;     // how readily it flutters
  uniform float uFlutter;  // shared: how much the folder is moving, 0 … 1
  uniform float uTime;
  varying vec2 vQ;         // sheet-local, from its centre; +y toward the near edge
  varying float vOut;      // distance past the folder's boards
  varying vec3 vWorld;
  void main() {
    vec2 q = vec2(position.x, -position.y);
    float c = cos(uRot);
    float sn = sin(uRot);
    vec2 e = uC.xz + vec2(c * q.x - sn * q.y, sn * q.x + c * q.y);
    vec2 o = vec2(e.x - ${L.toFixed(6)}, abs(e.y) - ${(HC / 2).toFixed(6)});
    float out_ = length(max(o, 0.0));
    float wave = sin(uTime * 6.3 + dot(e, vec2(11.0, 14.0)));
    float y = uC.y - uSag * out_ * out_ + uFlap * out_ * (0.04 + uFlutter) * 0.22 * wave;
    y = max(y, 0.0025);
    vQ = q;
    vOut = out_;
    vec4 w = modelMatrix * vec4(e.x, y, e.y, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const SHEET_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uPaper;
  uniform vec3 uInk;
  uniform float uKind;     // 0 letter, 1 notebook, 2 carbon form, 3 flyer, 4 graph, 5 ticket, 6 sticky
  uniform float uTorn;     // 1: its +x edge is torn, not cut
  uniform vec2 uHalf;
  uniform float uCovered;  // shared: 1 with the cover shut over the stack
  uniform sampler2D uDecal;
  uniform vec4 uStickyUV;
  uniform vec4 uTicketUV;
  varying vec2 vQ;
  varying float vOut;
  varying vec3 vWorld;
  ${ROOM_SHADING}

  float hline(float y, float w) { return 1.0 - smoothstep(w * 0.5, w, abs(y)); }

  void main() {
    vec2 q = vQ;
    vec3 base = uPaper * (0.95 + 0.06 * fbm(q * 40.0));
    float ink = 0.0;
    vec3 inkC = uInk;

    if (uTorn > 0.5) {
      /* Torn out of a pad: a ragged edge, two scales of raggedness, and a paler rim
         where the fibres were pulled. */
      float rag = 0.005 + 0.007 * vnoise(vec2(q.y * 36.0, 1.0)) + 0.004 * vnoise(vec2(q.y * 140.0, 5.0));
      float inside = uHalf.x - rag - q.x;
      if (inside < 0.0) discard;
      base *= 1.0 + 0.07 * (1.0 - smoothstep(0.0, 0.006, inside));
    }

    if (uKind < 0.5) {
      // A typed letter: lines of type with ragged right ends, and a signature in blue.
      float rowF = (q.y + uHalf.y - 0.1) / 0.026;
      float row = floor(rowF);
      float len = 0.55 + 0.4 * hash(vec2(row, 3.0));
      float xn = (q.x + uHalf.x - 0.09) / (2.0 * uHalf.x - 0.18);
      ink = step(0.0, xn) * step(xn, len) * step(0.0, rowF) * step(q.y, uHalf.y - 0.14)
          * hline(fract(rowF) - 0.5, 0.2) * step(0.25, vnoise(vec2(xn * 44.0, row * 3.1))) * 0.55;
      vec2 sg = q - vec2(uHalf.x * 0.35, uHalf.y - 0.09);
      float sig = hline(sg.y - 0.008 * sin(sg.x * 160.0) - 0.004 * sin(sg.x * 410.0), 0.0022)
                * step(abs(sg.x), 0.09);
      if (sig > 0.0) { ink = sig; inkC = vec3(0.12, 0.2, 0.5); }
    } else if (uKind < 1.5) {
      // A notebook page: blue rules, a red margin.
      ink = hline(mod(q.y, 0.028) - 0.014, 0.0016) * 0.55;
      float margin = hline(q.x + uHalf.x - 0.09, 0.0018);
      if (margin > 0.0) { ink = max(ink, margin * 0.7); inkC = vec3(0.8, 0.3, 0.3); }
    } else if (uKind < 2.5) {
      // A carbon copy: a header bar and boxes to fill in, in that blurred violet.
      float bar = step(q.y, -uHalf.y + 0.06) * step(-uHalf.y + 0.025, q.y);
      float rowsK = hline(mod(q.y + uHalf.y - 0.06, 0.045) - 0.0225, 0.0022) * step(-uHalf.y + 0.08, q.y);
      float colsK = hline(q.x - 0.06, 0.0022) + hline(q.x + 0.12, 0.0022);
      ink = max(bar * 0.6, max(rowsK, colsK * step(-uHalf.y + 0.06, q.y)) * 0.6);
    } else if (uKind < 3.5) {
      // A club flyer: a red masthead block at the top, bars of black type under it.
      float head = step(q.y, -uHalf.y + 0.15) * step(-uHalf.y + 0.02, q.y) * step(abs(q.x), uHalf.x - 0.03);
      float rowF = (q.y + uHalf.y - 0.19) / 0.04;
      float txt = step(0.0, rowF) * hline(fract(rowF) - 0.5, 0.35) * step(abs(q.x), uHalf.x * (0.4 + 0.5 * hash(vec2(floor(rowF), 9.0))));
      ink = max(head * 0.92, txt * 0.5);
      if (head < 0.5 && txt > 0.0) inkC = vec3(0.12);
    } else if (uKind < 4.5) {
      // Graph paper.
      vec2 g = mod(q, 0.012) - 0.006;
      vec2 G = mod(q, 0.06) - 0.03;
      ink = max(max(hline(g.x, 0.0008), hline(g.y, 0.0008)) * 0.3,
                max(hline(G.x, 0.0014), hline(G.y, 0.0014)) * 0.55);
    } else if (uKind < 5.5) {
      // A ticket stub: a red band at the torn-off end, perforations, ADMIT ONE.
      float band = step(uHalf.y - 0.055, q.y);
      float perf = step(length(vec2(mod(q.x, 0.014) - 0.007, q.y - (uHalf.y - 0.062))), 0.0024);
      float tl = uHalf.y * 2.0 * 0.72;
      vec2 lu = vec2(0.5 - (q.y + 0.03) / tl, 0.5 + q.x / (tl / ${DECAL_ASPECT.ticket.toFixed(4)}));
      float t = 0.0;
      if (lu.x > 0.0 && lu.x < 1.0 && lu.y > 0.0 && lu.y < 1.0)
        t = texture2D(uDecal, uTicketUV.xy + lu * uTicketUV.zw).a;
      ink = max(band * 0.85, t * 0.9);
      if (perf > 0.5) discard;
    } else {
      // A sticky note: the gummed strip along its top, and a scribble in ballpoint.
      base *= 1.0 - 0.06 * step(q.y, -uHalf.y + 0.03);
      // Written on the half that sticks out.
      vec2 lu = vec2(0.5 + (q.x - 0.024) / 0.11, 0.5 - (q.y - 0.006) / (0.11 / ${DECAL_ASPECT.sticky.toFixed(4)}));
      if (lu.x > 0.0 && lu.x < 1.0 && lu.y > 0.0 && lu.y < 1.0)
        ink = texture2D(uDecal, uStickyUV.xy + lu * uStickyUV.zw).a * 0.9;
    }
    base = mix(base, inkC, ink);

    /* In the folder's shade until it comes out from under the boards — much more with
       the cover shut over it. */
    float inside = 1.0 - smoothstep(0.0, 0.03, vOut);
    base *= 1.0 - inside * mix(0.12, 0.42, uCovered);

    // Facet normal of the drooped, fluttering sheet, turned to the viewer: paper is two-sided.
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    if (dot(n, cameraPosition - vWorld) < 0.0) n = -n;
    vec3 col = roomShade(base, n, 0.7, 0.5);
    col += uSun * roomSheen(n, 6.0) * 0.06;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * A board — the front cover or the back board — as a thick plate.
 *
 * The geometry is authored in the board's own frame: x = s along the board from the
 * spine, y = depth across it, z = t through its thickness; the normal attribute in
 * the same frame. The plate is bent by the exact-arc construction (tangent angle grows
 * linearly along s, so its length is preserved), rotated by uOpen·PI about the spine,
 * and its thickness is laid along the bent normal — so the edge walls bend too.
 */
const PLATE_VERTEX = /* glsl */ `
  uniform float uOpen;    // 0 lying on the right, 1 swung over onto the left
  uniform float uCurve;
  uniform float uHinge;   // height of the board's centre plane at the spine
  uniform float uDogEar;  // 1 on the cover: its near free corner is bent up (EAR)
  varying vec2 vPaper;    // s, depth
  varying float vFace;    // +1 the face that is up when shut, -1 the other, 0 an edge
  varying float vT;       // through the thickness, -T/2 … T/2
  varying float vEar;     // distance from the corner, in EAR's measure
  varying vec3 vNormalW;
  varying vec3 vWorld;
  const float PI = 3.141592653589793;
  void main() {
    float s = position.x;
    float depth = position.y;
    vPaper = vec2(s, depth);
    vFace = normal.z;
    vT = position.z;

    /* The bent corner: everything past the fold line is lifted off the board's plane,
       linearly, so the flap is flat and the fold is a crisp line. The faces' normals
       tilt by the lift's slope; the edge walls keep theirs. */
    float ear = ${(L).toFixed(6)} - s + ${(HC / 2).toFixed(6)} - depth;
    vEar = ear;
    float inEar = uDogEar * step(ear, ${EAR.toFixed(4)});
    float t = position.z + inEar * ${EAR_K.toFixed(4)} * (${EAR.toFixed(4)} - ear);
    vec3 nP = abs(normal.z) > 0.5
      ? normalize(vec3(-${EAR_K.toFixed(4)} * inEar, -${EAR_K.toFixed(4)} * inEar, 1.0) * normal.z)
      : normal;
    float A = uOpen * PI;
    float k = uCurve * sin(uOpen * PI);
    vec2 arc;
    float phi;
    if (abs(k) < 1e-4) {
      phi = A;
      arc = vec2(cos(A), sin(A)) * s;
    } else {
      phi = A + k * s;
      arc = vec2((sin(phi) - sin(A)) / k, (cos(A) - cos(phi)) / k);
    }
    vec2 tan2 = vec2(cos(phi), sin(phi));
    vec2 nrm2 = vec2(-sin(phi), cos(phi));
    vec3 local = vec3(arc + nrm2 * t + vec2(0.0, uHinge), depth);
    vec3 n = vec3(tan2 * nP.x + nrm2 * nP.z, nP.y);
    vNormalW = normalize(mat3(modelMatrix) * n);
    vec4 world = modelMatrix * vec4(local, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const PLATE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uKraft;
  uniform vec3 uKraftIn;
  uniform float uOuter;   // which face is the OUTSIDE of the folder: +1 the up face, -1 the down
  uniform float uDecals;  // 1 on the front cover: label outside, pocket and snapshots inside
  uniform vec3 uLabel;
  uniform vec3 uInk;
  uniform vec3 uPrint;
  uniform vec3 uSlip;
  uniform sampler2D uMark;
  uniform sampler2D uPhotoA;
  uniform sampler2D uPhotoB;
  uniform sampler2D uDecal;  // folderDecals.ts — the stamp and the typed line, as a mask
  uniform vec4 uStampUV;
  uniform vec4 uTypedUV;
  uniform float uDogEar;
  varying vec2 vPaper;
  varying float vFace;
  varying float vT;
  varying float vEar;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  ${ROOM_SHADING}
  ${KRAFT}

  const float W = ${L.toFixed(6)};
  const float HH = ${(HC / 2).toFixed(6)};
  const float R = ${CORNER_R.toFixed(6)};
  const float TT = ${T.toFixed(6)};

  float boxDist(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }

  vec2 rot(vec2 q, float a) {
    return vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  }

  /* A snapshot tucked into the inside pocket: a print with a white border, the picture
     desaturated to the black-and-white of an old campus photograph. Drawn on the INNER
     face, which is seen mirrored once the cover lies open, so the picture's u runs
     against s. rgb, plus coverage in a. */
  vec4 snapshot(vec2 p, vec2 c, vec2 hb, float a, sampler2D tex) {
    vec2 q = rot(p - c, a);
    float d = boxDist(q, hb);
    if (d > 0.0) return vec4(0.0);
    vec3 col = uPrint * (0.95 + 0.05 * fbm(q * 80.0));
    vec2 inner = hb - 0.016;
    if (boxDist(q, inner) < 0.0) {
      vec2 uv = vec2(0.5 - q.x / (2.0 * inner.x), 0.5 - q.y / (2.0 * inner.y));
      vec4 t = texture2D(tex, uv);
      float l = dot(t.rgb, vec3(0.3, 0.59, 0.11));
      vec3 bw = mix(vec3(l), t.rgb, 0.1) * vec3(1.0, 0.97, 0.91);
      col = mix(col * 0.9, bw, t.a);
    }
    return vec4(col, 1.0);
  }

  /* A coffee ring: where a mug was put down on the folder. Coffee dries to a dark TIDE
     LINE at the rim (the coffee-ring effect — the solids are carried outward as the drop
     dries) over a faint wash inside, the circle a little out of true, and heavier on the
     side the mug was tipped toward. A multiplier for the board's colour. */
  vec3 coffee(vec2 c, float R, float seed) {
    float r = length(c);
    float a = atan(c.y, c.x);
    float R0 = R + 0.0035 * sin(a * 3.0 + seed) + 0.004 * (vnoise(vec2(a * 2.6 + seed, seed)) - 0.5);
    float e = r - R0;
    float tide = exp(-(e * e) / (0.0036 * 0.0036));
    float wash = (1.0 - smoothstep(-0.008, 0.0, e)) * (0.45 + 0.55 * vnoise(c * 36.0 + seed));
    float side = 0.35 + 0.65 * smoothstep(-0.5, 0.9, sin(a + seed * 1.7));
    return mix(vec3(1.0), vec3(0.62, 0.48, 0.36), (tide * 0.95 + wash * 0.2) * side);
  }

  /* A decal from the mask atlas, centred at c, rotated by a, w wide: its coverage, or 0
     outside it. Text "up" is the board's far edge, the way the label reads. */
  float decal(vec2 p, vec2 c, float a, float w, float aspect, vec4 uvr, out vec2 q) {
    q = rot(p - c, a);
    vec2 hb = vec2(w * 0.5, w * 0.5 / aspect);
    if (abs(q.x) > hb.x || abs(q.y) > hb.y) return 0.0;
    vec2 lu = vec2(0.5 + q.x / (2.0 * hb.x), 0.5 - q.y / (2.0 * hb.y));
    return texture2D(uDecal, uvr.xy + lu * uvr.zw).a;
  }

  void main() {
    float s = vPaper.x;
    float depth = vPaper.y;
    vec2 p = vec2(s, depth);
    float face = vFace * uOuter;
    vec3 n = normalize(vNormalW);
    vec3 base;
    float h = 0.0;
    float sheenK = 0.11;

    // Distance in from the board's outline — rounded corners on the free side.
    vec2 cq = vec2(s - (W - R), abs(depth) - (HH - R));
    float edgeD = (cq.x > 0.0 && cq.y > 0.0) ? R - length(cq) : min(W - s, HH - abs(depth));
    // Worn rim: a board's edge is handled, scuffed and a shade darker.
    float rim = mix(0.78, 1.0, smoothstep(0.0, 0.014, edgeD));

    if (abs(vFace) < 0.5) {
      /* The board's EDGE: pressed kraft is laminated — two denser skins and a coarser
         core, the layers just visible as bands — and darker than the faces. */
      float tt = vT / TT + 0.5;
      float along = s + depth;
      float core = smoothstep(0.12, 0.28, tt) * smoothstep(0.88, 0.72, tt);
      vec3 skin = uKraft * 0.86;
      vec3 coreC = uKraft * 0.62 * (0.85 + 0.3 * vnoise(vec2(along * 900.0, tt * 7.0)));
      base = mix(skin, coreC, core) * (0.92 + 0.08 * sin(tt * 37.7));
      base *= 0.9 + 0.1 * fbm(vec2(along * 70.0, tt * 3.0));
    } else if (face > 0.0) {
      /* OUTSIDE. */
      vec2 k = kraftFH(p);
      base = uKraft * k.x * rim;
      h = k.y;
      if (uDecals > 0.5) {
        /* Wear. A folder that has been carried about is paler along its free edges and
           corners, where the top skin has been scuffed off the board and the lighter
           fibres show, in patches rather than an even band. */
        float nearEdge = 1.0 - smoothstep(0.0, 0.034, edgeD);
        if (nearEdge > 0.0) {
          float scuff = nearEdge * smoothstep(0.48, 0.78, vnoise(p * 55.0 + 13.0));
          float lum = dot(base, vec3(0.3, 0.59, 0.11));
          // Pale KRAFT, not grey: the fibres under the skin are the same pulp, lighter.
          base = mix(base, mix(base * 1.42, vec3(lum) * 1.3, 0.3), scuff * 0.6);
          h *= 1.0 - scuff * 0.6;
        }
        /* …and darker, with a faint polish, where a thumb opens it, beside the button. */
        float grime = 1.0 - smoothstep(0.03, 0.2, length((p - vec2(W - 0.06, 0.02)) * vec2(1.0, 0.75)));
        base *= 1.0 - 0.17 * grime;
        sheenK += 0.12 * grime;

        /* A mug was put down on it — twice, not quite in the same place. */
        vec2 cr = p - vec2(0.25, 0.44);
        if (dot(cr, cr) < 0.0144) {
          base *= coffee(cr, 0.083, 1.0);
          base *= mix(vec3(1.0), coffee(cr - vec2(0.019, 0.013), 0.081, 4.0), 0.55);
        }

        /* A rubber stamp, red, at an angle: pressed unevenly, with specks where the ink
           did not take — the mask is the shape, the noise is the stamping. */
        vec2 sq;
        float sm = decal(p, vec2(0.7, 0.3), 0.17, 0.36, ${DECAL_ASPECT.stamp.toFixed(4)}, uStampUV, sq);
        if (sm > 0.0) {
          float press = 0.62 + 0.38 * vnoise(sq * 9.0 + 2.0);
          float take = smoothstep(0.26, 0.46, vnoise(sq * 230.0));
          float ink = sm * press * mix(1.0, take, 0.5);
          base = mix(base, base * vec3(0.95, 0.2, 0.17) + vec3(0.13, 0.0, 0.0), ink * 0.95);
        }

        /* The label: a cream slip pasted on a little crooked, a rule printed round it,
           and the wordmark printed on it. Just outside it the kraft is a touch darker
           where the paste has soaked through. */
        vec2 q = rot(p - vec2(${(L * 0.53).toFixed(4)}, -0.34), -0.026);
        vec2 hb = vec2(0.27, 0.105);
        float d = boxDist(q, hb);
        base *= mix(0.88, 1.0, smoothstep(0.0, 0.012, d));
        if (d < 0.0) {
          vec3 label = uLabel * (0.92 + 0.1 * fbm(q * 60.0));
          float rule = 1.0 - smoothstep(0.0011, 0.0024, abs(boxDist(q, hb - 0.016)));
          label = mix(label, uInk, rule * 0.8);
          vec2 mu = vec2(q.x / 0.232 * 0.5 + 0.5, -q.y / (0.232 / ${WORDMARK_ASPECT.toFixed(4)}) * 0.5 + 0.5);
          if (mu.x > 0.0 && mu.x < 1.0 && mu.y > 0.0 && mu.y < 1.0) {
            vec4 m = texture2D(uMark, mu);
            label = mix(label, m.rgb, m.a);
          }
          base = label;
          h *= 0.25;
        }

        /* A typed line under it, on the board itself — a typewriter's ink sits in the
           fibres, so it is a little uneven. */
        vec2 tq;
        float tm = decal(p, vec2(${(L * 0.53).toFixed(4)}, -0.2), -0.026, 0.5, ${DECAL_ASPECT.typed.toFixed(4)}, uTypedUV, tq);
        base *= 1.0 - tm * 0.82 * (0.78 + 0.22 * vnoise(tq * 300.0));

        /* And a strip of masking tape over the label's top-left corner, because the paste
           gave up there: translucent, a little glossy, torn at both ends, with a fine
           crinkle across it and a hairline of shadow along its edges. */
        vec2 tp = rot(q - vec2(-0.27, -0.105), -0.62);
        vec2 thb = vec2(0.066, 0.019);
        float torn = 0.007 * vnoise(vec2(tp.y * 95.0, sign(tp.x) * 3.0));
        if (abs(tp.y) < thb.y && abs(tp.x) < thb.x - torn) {
          vec3 tape = vec3(0.9, 0.84, 0.67) * (0.95 + 0.06 * vnoise(tp * vec2(30.0, 420.0)));
          base = mix(base, tape, 0.7);
          h *= 0.3;
          sheenK += 0.16;
        } else if (abs(tp.x) < thb.x) {
          float te = (abs(tp.y) - thb.y) / 0.0016;
          base *= 1.0 - 0.14 * exp(-te * te);
        }

        /* The bent corner's fold: broken fibres, a pale line. */
        float fe = (vEar - ${EAR.toFixed(4)}) / 0.0022;
        base *= 1.0 + 0.16 * uDogEar * exp(-fe * fe);
      }
    } else {
      /* INSIDE: paler and smoother. On the front cover, a pocket across its lower half
         whose top edge throws a hairline of shadow, and what is in it. */
      vec2 k = kraftFH(p * 1.3 + 9.0);
      base = uKraftIn * k.x * rim;
      h = k.y * 0.6;
      if (uDecals > 0.5) {
        float top = 0.16 + 0.035 * cos((s - W * 0.5) * 2.6);
        vec2 slipQ = rot(p - vec2(0.8, -0.02), 0.05);
        float slip = boxDist(slipQ, vec2(0.045, 0.2));
        base *= mix(0.88, 1.0, smoothstep(0.0, 0.012, slip));
        if (slip < 0.0) base = uSlip * (0.92 + 0.1 * fbm(slipQ * 70.0));
        vec4 a1 = snapshot(p, vec2(0.6, 0.02), vec2(0.215, 0.15), 0.07, uPhotoA);
        vec4 a2 = snapshot(p, vec2(0.3, -0.02), vec2(0.15, 0.15), -0.1, uPhotoB);
        float sh1 = boxDist(rot(p - vec2(0.592, 0.026), 0.07), vec2(0.215, 0.15));
        float sh2 = boxDist(rot(p - vec2(0.292, -0.014), -0.1), vec2(0.15, 0.15));
        base *= mix(0.86, 1.0, smoothstep(-0.004, 0.012, min(sh1, sh2)));
        base = mix(base, a1.rgb, a1.a);
        base = mix(base, a2.rgb, a2.a);
        float inPocket = smoothstep(top - 0.002, top + 0.002, depth);
        float lip = 1.0 - smoothstep(0.0, 0.016, abs(depth - top - 0.008));
        // The pocket is the same board a shade darker — not a second evaluation of it.
        base = mix(base, uKraftIn * 0.9 * k.x * rim, inPocket);
        base *= 1.0 - lip * 0.18 * inPocket;
        h *= mix(0.4, 1.0, inPocket);
      }
    }

    if (h > 0.0 && uDetail > 0.5) n = bumpNormal(n, h);
    vec3 col = roomShade(base, n, 0.56, 0.86);
    col += uSun * roomSheen(n, 4.0) * sheenK;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/* ── Geometry ────────────────────────────────────────────────────────────────── */

/**
 * A board of thickness t as a closed solid in its own frame (x = s from the spine,
 * y = depth, z = through the thickness), with the free-side corners rounded and enough
 * columns along s for the cover to bend smoothly. Faces carry normal.z = ±1 (top and
 * bottom), the walls normal.z = 0 — which is how the shader tells them apart.
 */
function thickPlate(t: number) {
  const h = HC / 2;
  const r = CORNER_R;
  const straight = 64;
  const colSet: number[] = [];
  for (let i = 0; i <= straight; i++) colSet.push(((L - r) * i) / straight);
  for (let i = 1; i <= 10; i++) colSet.push(L - r + (r * i) / 10);
  // Denser toward the free edge, where the bent corner's fold has to land on a column.
  for (let i = 1; i < 10; i++) colSet.push(L - r - EAR * 1.3 + (EAR * 1.3 * i) / 10);
  const cols = [...new Set(colSet.map((v) => Math.round(v * 1e6) / 1e6))].sort((a, b) => a - b);
  const ext = (s: number) =>
    s <= L - r ? h : h - r + Math.sqrt(Math.max(0, r * r - (s - (L - r)) ** 2));

  /* Rows across the depth, as fractions of each column's extent (so the rounded corners
     stay exact). A board that only ever bent along s needed none — a face was one quad
     from edge to edge — but the bent corner varies with depth too, so the faces are
     cut into rows, dense near the near edge where the corner is. */
  const rowSet: number[] = [];
  for (let i = 0; i <= 12; i++) rowSet.push(-1 + (2 * i) / 12);
  for (let i = 1; i < 14; i++) rowSet.push(1 - ((EAR * 1.4) / h) * (i / 14));
  const rows = [...new Set(rowSet.map((v) => Math.round(v * 1e6) / 1e6))].sort((a, b) => a - b);

  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[]) => {
    const base = pos.length / 3;
    pos.push(...a, ...b, ...c, ...d);
    for (let i = 0; i < 4; i++) nor.push(...n);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  // The two faces, column strip by column strip, row by row.
  for (let i = 0; i < cols.length - 1; i++) {
    const s0 = cols[i];
    const s1 = cols[i + 1];
    const e0 = ext(s0);
    const e1 = ext(s1);
    for (let j = 0; j < rows.length - 1; j++) {
      const f0 = rows[j];
      const f1 = rows[j + 1];
      for (const z of [t / 2, -t / 2]) {
        quad([s0, f0 * e0, z], [s1, f0 * e1, z], [s1, f1 * e1, z], [s0, f1 * e0, z], [0, 0, Math.sign(z)]);
      }
    }
  }

  // The walls, round the outline: far edge out to the free end, the free end, the near
  // edge back, and the spine end.
  const outline: [number, number][] = [];
  for (const s of cols) outline.push([s, -ext(s)]);
  for (let i = cols.length - 1; i >= 0; i--) outline.push([cols[i], ext(cols[i])]);
  for (let i = 0; i < outline.length; i++) {
    const [s0, d0] = outline[i];
    const [s1, d1] = outline[(i + 1) % outline.length];
    const len = Math.hypot(s1 - s0, d1 - d0);
    if (len < 1e-7) continue;
    let ns = (d1 - d0) / len;
    let nd = -(s1 - s0) / len;
    // Point it outward, away from the plate's middle.
    const ms = (s0 + s1) / 2 - L / 2;
    const md = (d0 + d1) / 2;
    if (ns * ms + nd * md < 0) {
      ns = -ns;
      nd = -nd;
    }
    quad([s0, d0, t / 2], [s1, d1, t / 2], [s1, d1, -t / 2], [s0, d0, -t / 2], [ns, nd, 0]);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  // Bounds are meaningless once the shader bends it; the meshes are not frustum-culled.
  return g;
}

/** Point and normal on the cover's centre plane at distance s from the spine. */
function coverPoint(open: number, hinge: number, s: number) {
  const A = open * Math.PI;
  const k = COVER_CURVE * Math.sin(open * Math.PI);
  let phi = A;
  let x: number;
  let y: number;
  if (Math.abs(k) < 1e-4) {
    x = Math.cos(A) * s;
    y = Math.sin(A) * s;
  } else {
    phi = A + k * s;
    x = (Math.sin(phi) - Math.sin(A)) / k;
    y = (Math.cos(A) - Math.cos(phi)) / k;
  }
  return { x, y: hinge + y, phi };
}

/** The hinge drops from the top of the stack to the desk — but only once the cover is
 *  past upright, so it never sweeps through the pages it is lifting off. */
const hingeFor = (open: number) => {
  const t = Math.min(Math.max((open - 0.45) / 0.5, 0), 1);
  return THREE.MathUtils.lerp(COVER_SHUT_C, COVER_OPEN_C, t * t * (3 - 2 * t));
};

/**
 * The elastic cord, as a closed loop sewn to the back board's free edge.
 *
 * HOOKED: up the folder's edge, over the cover to the button, once round its stem
 * under the head, and back. RELEASED: lying slack in the back board's overhang beside
 * the pages, a long loop running toward the reader. Same number of points in both, so
 * the release is an interpolation — with a lift and an outward bow on the way, so the
 * cord comes UP off the button and OUT over the cover's edge instead of through it.
 */
const CORD_N = 14;
const cordPoses = (() => {
  const xb = L - BUTTON_IN;
  const yTop = COVER_TOP + 0.0035;
  const yMid = T + STACK_T * 0.5;
  const ring = [0.45, 1.5, 2.6, 3.6, 4.7, 5.8].map(
    (a) => new THREE.Vector3(xb + Math.cos(a) * 0.03, yTop, Math.sin(a) * 0.03),
  );
  const hooked = [
    new THREE.Vector3(L - 0.006, T * 0.5, 0.012),
    new THREE.Vector3(L + 0.0048, yMid, 0.013),
    new THREE.Vector3(L + 0.004, COVER_TOP + 0.0015, 0.013),
    new THREE.Vector3(L - 0.03, yTop, 0.012),
    ...ring,
    new THREE.Vector3(L - 0.03, yTop, -0.012),
    new THREE.Vector3(L + 0.004, COVER_TOP + 0.0015, -0.013),
    new THREE.Vector3(L + 0.0048, yMid, -0.013),
    new THREE.Vector3(L - 0.006, T * 0.5, -0.012),
  ];

  const yR = T + 0.0045;
  const cx = L - 0.024;
  const cz = 0.27;
  const end = Array.from({ length: 6 }, (_, i) => {
    const a = -0.3 + (i * (Math.PI + 0.6)) / 5;
    return new THREE.Vector3(cx + Math.cos(a) * 0.0115, yR, cz + Math.sin(a) * 0.0115);
  });
  const released = [
    hooked[0].clone(),
    new THREE.Vector3(L - 0.01, yR, 0.07),
    new THREE.Vector3(L - 0.012, yR, 0.16),
    new THREE.Vector3(L - 0.013, yR, 0.235),
    ...end,
    new THREE.Vector3(L - 0.035, yR, 0.235),
    new THREE.Vector3(L - 0.034, yR, 0.15),
    new THREE.Vector3(L - 0.03, yR, 0.06),
    hooked[CORD_N - 1].clone(),
  ];
  return { hooked, released };
})();

function cordGeometry(r: number) {
  const { hooked, released } = cordPoses;
  const lift = Math.sin(Math.PI * r);
  const pts = hooked.map((h, i) => {
    const w = Math.sin((Math.PI * i) / (CORD_N - 1));
    const p = h.clone().lerp(released[i], r);
    p.x += 0.05 * w * lift;
    p.y += 0.035 * w * lift;
    return p;
  });
  const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal");
  return new THREE.TubeGeometry(curve, 180, 0.0042, 7, true);
}

/** The documents' tabs, poking out of the stack's free edge. */
const TABS: ReadonlyArray<{ z: number; y: number; color: string }> = [
  { z: -0.52, y: 0.4, color: "#b41c14" },
  { z: -0.3, y: 0.72, color: "#d6a443" },
  { z: -0.1, y: 0.55, color: "#efe2c6" },
  { z: 0.45, y: 0.85, color: "#b41c14" },
];

/**
 * The loose papers stuffed in among the documents, poking out past the boards: a folder
 * that is actually used is never square. Positions are the edition's (spine x = 0, the
 * boards reach x = L and z = ±HC/2); `y` is the height in the stack as a share of
 * STACK_T. Every one sits below the deck and above the released cord (which lies on the
 * back board's overhang, z 0.06–0.27) and nothing crosses the right edge near z = 0, where
 * the hooked cord runs round the folder's edge. Heights differ by more than any flutter.
 *
 *   a sheet of graph paper     out of the right edge, low down
 *   a typed letter             out of the near edge, clipped (so it does not flutter)
 *   a page torn from a pad     out of the right edge and the far corner, ragged
 *   a pink carbon copy         out of the near edge
 *   a club flyer               out of the far edge, its red masthead showing
 *   a ticket stub              out of the near edge, at an angle
 *   a sticky note              out of the right edge, curling up
 */
type Sheet = {
  kind: number;
  x: number;
  z: number;
  w: number;
  d: number;
  rot: number;
  y: number;
  sag: number;
  flap: number;
  paper: string;
  ink: string;
  torn?: boolean;
};
const SHEETS: ReadonlyArray<Sheet> = [
  { kind: 4, x: L + 0.04 - 0.45, z: 0.37, w: 0.9, d: 0.66, rot: -0.03, y: 0.2, sag: 2.2, flap: 0.8, paper: "#eef0e6", ink: "#7d9f98" },
  { kind: 0, x: 0.5, z: 0.095, w: 0.96, d: 1.36, rot: 0.018, y: 0.35, sag: 0.8, flap: 0, paper: "#f4f1e8", ink: "#2a2a2e" },
  { kind: 1, x: L + 0.065 - 0.31, z: -0.42, w: 0.62, d: 0.7, rot: 0.05, y: 0.5, sag: 2.6, flap: 1, paper: "#f2ead2", ink: "#6f8fbf", torn: true },
  { kind: 2, x: 0.27, z: 0.61, w: 0.46, d: 0.34, rot: 0.08, y: 0.6, sag: 2.0, flap: 0.8, paper: "#efc8c0", ink: "#4d4b8c" },
  { kind: 3, x: 0.42, z: -0.39, w: 0.56, d: 0.76, rot: -0.06, y: 0.72, sag: 1.8, flap: 0.9, paper: "#efe3c4", ink: "#b41c14" },
  { kind: 5, x: 0.84, z: 0.64, w: 0.085, d: 0.32, rot: -0.22, y: 0.8, sag: 1.0, flap: 0.6, paper: "#ecd3a3", ink: "#9e1b12" },
  { kind: 6, x: L + 0.085 - 0.075, z: 0.3, w: 0.15, d: 0.15, rot: 0.13, y: 0.9, sag: -2.5, flap: 0.5, paper: "#f2d24e", ink: "#1f3a8a" },
];

/**
 * A paperclip on the typed letter's near edge, half on and half off the paper — a Gem
 * clip's three nested loops, as a wire. Built flat, pointing into the folder.
 */
function paperclipGeometry() {
  const letter = SHEETS[1];
  const y = T + STACK_T * letter.y + 0.0024;
  const pts: [number, number][] = [];
  const leg = (a: number, b0: number, b1: number) => {
    for (let i = 0; i <= 3; i++) pts.push([a, b0 + ((b1 - b0) * i) / 3]);
  };
  const turn = (ca: number, cb: number, r: number, from: number, to: number) => {
    for (let i = 1; i < 6; i++) {
      const t = from + ((to - from) * i) / 6;
      pts.push([ca + Math.cos(t) * r, cb + Math.sin(t) * r]);
    }
  };
  leg(0.004, 0.028, 0.08);
  turn(-0.0005, 0.08, 0.0045, 0, Math.PI);
  leg(-0.005, 0.08, 0.012);
  turn(0.0025, 0.012, 0.0075, Math.PI, 2 * Math.PI);
  leg(0.01, 0.012, 0.094);
  turn(0, 0.094, 0.01, 0, Math.PI);
  leg(-0.01, 0.094, 0.048);
  const a0 = 0.07;
  const x0 = 0.64;
  const z0 = 0.8;
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([a, b]) => {
      const lx = a;
      const lz = -b;
      return new THREE.Vector3(
        x0 + lx * Math.cos(a0) - lz * Math.sin(a0),
        y,
        z0 + lx * Math.sin(a0) + lz * Math.cos(a0),
      );
    }),
    false,
    "centripetal",
  );
  return new THREE.TubeGeometry(curve, 160, 0.0011, 6, false);
}

/** Print-paper stand-in for the pocket snapshots until they have loaded. */
const PRINT_BLANK = new THREE.DataTexture(new Uint8Array([241, 236, 225, 255]), 1, 1);
PRINT_BLANK.needsUpdate = true;

/* ── Component ───────────────────────────────────────────────────────────────── */

export default function Folder({
  posRef,
  lead,
  turns,
  light,
}: {
  posRef: React.RefObject<number>;
  lead: number;
  turns: number;
  light: RoomLight;
}) {
  const scene = useScene();
  // The one texture the first frame waits for (this suspends until it has decoded).
  const mark = useLoader(THREE.TextureLoader, WORDMARK_FIRST);
  useLayoutEffect(() => {
    for (const t of [mark]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.needsUpdate = true;
    }
  }, [mark]);

  const profile = useMemo(() => makeProfileTexture(light), [light]);

  /* One set of room uniforms, shared by reference across every folder material, so the
     clock is advanced once a frame for all of them. The window bars are near full
     strength here: the folder lies in the sun on the desk, nobody has to read it. */
  const shared = useMemo(() => roomUniforms(light, profile, 0.92), [light, profile]);
  const detail = scene.quality.detail;

  // The stamp, typed line, sticky scribble and ticket print — painted, not downloaded.
  const decals = useMemo(() => createFolderDecals(), []);
  useLayoutEffect(() => () => decals.dispose(), [decals]);

  /* Shared by reference across the loose papers, like the room uniforms: how much the
     folder is moving (they flutter) and how shut the cover is (they are in its shade). */
  const sheetShared = useMemo(() => ({ uFlutter: { value: 0 }, uCovered: { value: 1 } }), []);

  const mats = useMemo(() => {
    const solid = (fragmentShader: string, extra: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({
        vertexShader: SOLID_VERTEX,
        fragmentShader,
        uniforms: { ...shared, ...extra },
      });
    const flat = (color: string, sheen = 0.04, pow = 6) =>
      solid(FLAT_FRAGMENT, {
        uColor: { value: new THREE.Color(color) },
        uSheen: { value: sheen },
        uSheenPow: { value: pow },
      });
    const plate = (opts: {
      open: number;
      hinge: number;
      outer: number;
      decals: number;
      dogEar: number;
      kraft: string;
      kraftIn: string;
    }) =>
      new THREE.ShaderMaterial({
        vertexShader: PLATE_VERTEX,
        fragmentShader: PLATE_FRAGMENT,
        side: THREE.DoubleSide,
        uniforms: {
          ...shared,
          uOpen: { value: opts.open },
          uCurve: { value: COVER_CURVE },
          uHinge: { value: opts.hinge },
          uOuter: { value: opts.outer },
          uDecals: { value: opts.decals },
          uKraft: { value: new THREE.Color(opts.kraft) },
          uKraftIn: { value: new THREE.Color(opts.kraftIn) },
          uLabel: { value: new THREE.Color("#f1e6d0") },
          uInk: { value: new THREE.Color("#2b241c") },
          uPrint: { value: new THREE.Color("#f1ece1") },
          uSlip: { value: new THREE.Color("#b41c14") },
          uMark: { value: mark },
          // Plain print paper until the snapshots arrive (after the scene is up).
          uPhotoA: { value: PRINT_BLANK as THREE.Texture },
          uPhotoB: { value: PRINT_BLANK as THREE.Texture },
          uDecal: { value: decals.texture },
          uStampUV: { value: DECAL_UV.stamp },
          uTypedUV: { value: DECAL_UV.typed },
          uDogEar: { value: opts.dogEar },
          uDetail: { value: detail },
        },
      });
    return {
      /* Shut, the cover's up face is its outside. The kraft is a shade less orange than
         it was — pressed board is a brown, and the golden-hour light adds the orange. */
      cover: plate({ open: 0, hinge: COVER_SHUT_C, outer: 1, decals: 1, dogEar: 1, kraft: "#b5773a", kraftIn: "#c9915a" }),
      // The back board's outside is the face on the desk.
      board: plate({ open: 0, hinge: T / 2, outer: -1, decals: 0, dogEar: 0, kraft: "#a96f37", kraftIn: "#c48e57" }),
      stack: solid(STACK_FRAGMENT, { uPaper: { value: new THREE.Color("#efe6d3") } }),
      tabs: Object.fromEntries(TABS.map((t) => [t.color, flat(t.color, 0.03)])),
      sheets: SHEETS.map(
        (sh) =>
          new THREE.ShaderMaterial({
            vertexShader: SHEET_VERTEX,
            fragmentShader: SHEET_FRAGMENT,
            side: THREE.DoubleSide,
            uniforms: {
              ...shared,
              ...sheetShared,
              uC: { value: new THREE.Vector3(sh.x, T + STACK_T * sh.y, sh.z) },
              uRot: { value: sh.rot },
              uHalf: { value: new THREE.Vector2(sh.w / 2, sh.d / 2) },
              uSag: { value: sh.sag },
              uFlap: { value: sh.flap },
              uKind: { value: sh.kind },
              uTorn: { value: sh.torn ? 1 : 0 },
              uPaper: { value: new THREE.Color(sh.paper) },
              uInk: { value: new THREE.Color(sh.ink) },
              uDecal: { value: decals.texture },
              uStickyUV: { value: DECAL_UV.sticky },
              uTicketUV: { value: DECAL_UV.ticket },
            },
          }),
      ),
      clip: flat("#b3b7bb", 0.6, 40),
      gusset: flat("#8f5a28", 0.05, 5),
      button: flat("#1b1714", 0.22, 22),
      grommet: flat("#6d5838", 0.5, 30),
      cord: flat("#211b16", 0.1, 10),
    };
  }, [shared, sheetShared, mark, detail, decals]);

  useLayoutEffect(
    () => () => {
      for (const m of Object.values(mats)) {
        if (m instanceof THREE.Material) m.dispose();
        else for (const t of Object.values(m)) t.dispose();
      }
      profile.dispose();
    },
    [mats, profile],
  );

  /* After the first frame: the sharper label and the two pocket snapshots. They are
     only seen once the folder is lifted and opened, which is seconds away, so they never
     hold up the scene. A failure just leaves the small label and blank prints. */
  const coverForLoads = useRef<THREE.Mesh>(null);
  useEffect(() => {
    if (!scene.ready) return;
    let live = true;
    const got: THREE.Texture[] = [];
    const put = (uniform: string, url: string) =>
      loadTexture(url)
        .then((t) => {
          if (!live) return disposeTexture(t);
          got.push(t);
          const m = coverForLoads.current?.material as THREE.ShaderMaterial | undefined;
          if (m) m.uniforms[uniform].value = t;
        })
        .catch(() => {});
    void put("uMark", WORDMARK_URL);
    void put("uPhotoA", PHOTO_A);
    void put("uPhotoB", PHOTO_B);
    return () => {
      live = false;
      for (const t of got) disposeTexture(t);
    };
  }, [scene.ready]);

  const plateGeo = useMemo(() => thickPlate(T), []);
  useLayoutEffect(() => () => plateGeo.dispose(), [plateGeo]);
  const sheetGeos = useMemo(() => SHEETS.map((sh) => new THREE.PlaneGeometry(sh.w, sh.d, 14, 14)), []);
  const clipGeo = useMemo(() => paperclipGeometry(), []);
  useLayoutEffect(
    () => () => {
      for (const g of sheetGeos) g.dispose();
      clipGeo.dispose();
    },
    [sheetGeos, clipGeo],
  );
  const lastPos = useRef<number | null>(null);
  const flutter = useRef(0);
  const firstSheet = useRef<THREE.Mesh>(null);
  const initialCord = useMemo(() => cordGeometry(0), []);

  const coverMesh = useRef<THREE.Mesh>(null);
  const cord = useRef<THREE.Mesh>(null);
  const cordR = useRef(-1);
  const button = useRef<THREE.Group>(null);
  const gusset = useRef<THREE.Mesh>(null);

  useFrame((state, dt) => {
    const pos = posRef.current ?? 0;
    /* Opened at the start, closed again at the end — the same cover, the same swing,
       reversed: the deck never leaves the right-hand board, so there is nothing to fold
       the other half over. The cord comes off first and goes back on last. */
    const closing = closeProgress(pos, turns, lead);
    const open = coverOpenness(pos, turns, lead);
    const hinge = hingeFor(open);

    /* The loose papers flutter while the folder is moving: properly while it is lifted,
       carried, opened or set down (the lead steps), a little while a card is swept past
       them. Quick to rise, slow to settle — paper keeps moving after the hand stops. */
    const v = lastPos.current === null ? 0 : Math.abs(pos - lastPos.current) / Math.max(dt, 1 / 240);
    lastPos.current = pos;
    const carried = pos < lead || pos > turns + lead ? 1.6 : 0.45;
    const target = Math.min(1, v * carried);
    const e = flutter.current;
    flutter.current = e + (target - e) * (1 - Math.exp(-Math.min(dt, 0.1) * (target > e ? 8 : 2.2)));
    // Through a mesh, as with the cover below: the two uniforms are shared by every sheet.
    const sm = firstSheet.current;
    if (sm) {
      const su = (sm.material as THREE.ShaderMaterial).uniforms;
      su.uFlutter.value = flutter.current;
      su.uCovered.value = 1 - open;
    }

    /* Through the mesh, not the memo: the room uniforms are shared BY REFERENCE across
       every folder material, so advancing the clock on the cover advances it for all. */
    const cm = coverMesh.current;
    if (cm) {
      const u = (cm.material as THREE.ShaderMaterial).uniforms;
      u.uTime.value = state.clock.elapsedTime;
      u.uOpen.value = open;
      u.uHinge.value = hinge;
    }

    // The button rides the cover's own arc, standing on its outer face.
    const b = button.current;
    if (b) {
      const pt = coverPoint(open, hinge, L - BUTTON_IN);
      const off = T / 2 + 0.0004;
      b.position.set(pt.x - Math.sin(pt.phi) * off, pt.y + Math.cos(pt.phi) * off, 0);
      b.rotation.z = pt.phi;
    }

    // The gusset at the spine spans whatever is folded about it: the shut cover at the
    // start, nothing much while it lies open, the closed back half at the end.
    const gs = gusset.current;
    if (gs) {
      const top = hinge + T / 2;
      gs.scale.y = Math.max(top, 0.002);
      gs.position.y = gs.scale.y / 2;
    }

    // The cord: only rebuilt while it is actually moving.
    const r = cordRelease(folderProgress(pos, lead)) * (1 - cordHook(closing));
    const c = cord.current;
    if (c && Math.abs(r - cordR.current) > 1e-4) {
      cordR.current = r;
      c.geometry.dispose();
      c.geometry = cordGeometry(r);
    }
  });

  return (
    <group>
      {/* The back half: board, documents, tabs and the cord sewn to it. */}
      <group>
        <group>
          <mesh geometry={plateGeo} material={mats.board} frustumCulled={false} />

          <mesh material={mats.stack} position={[PAGE_W / 2 + 0.001, T + STACK_T / 2, 0]}>
            <boxGeometry args={[PAGE_W - 0.008, STACK_T, PAGE_H - 0.008]} />
          </mesh>

          {TABS.map((t) => (
            <mesh
              key={t.z}
              material={mats.tabs[t.color]}
              position={[PAGE_W + 0.006, T + STACK_T * t.y, t.z]}
            >
              <boxGeometry args={[0.032, 0.0011, 0.07]} />
            </mesh>
          ))}

          {/* The loose papers poking out, and the clip on the letter. Placed (and drooped)
              in the vertex shader, so their bounds mean nothing: never culled. */}
          {SHEETS.map((sh, i) => (
            <mesh
              key={sh.kind}
              ref={i === 0 ? firstSheet : undefined}
              geometry={sheetGeos[i]}
              material={mats.sheets[i]}
              frustumCulled={false}
            />
          ))}
          <mesh geometry={clipGeo} material={mats.clip} />

          <mesh ref={cord} geometry={initialCord} material={mats.cord} frustumCulled={false} />
        </group>
      </group>

      {/* The spine gusset: a strip of kraft standing at the fold. Height per frame. */}
      <mesh ref={gusset} material={mats.gusset} position={[-0.0025, 0, 0]}>
        <boxGeometry args={[0.005, 1, HC - 0.006]} />
      </mesh>

      {/* Front cover. */}
      <mesh
        ref={(m) => {
          coverMesh.current = m;
          coverForLoads.current = m;
        }}
        geometry={plateGeo}
        material={mats.cover}
        frustumCulled={false}
      />

      {/* The button, on the cover's outer face. */}
      <group ref={button}>
        <mesh material={mats.button} position={[0, 0.0018, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.0036, 20]} />
        </mesh>
        <mesh material={mats.button} position={[0, 0.0058, 0]}>
          <cylinderGeometry args={[BUTTON_R, BUTTON_R * 0.96, 0.0044, 40]} />
        </mesh>
        <mesh material={mats.grommet} position={[0, 0.0081, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.011, 0.0034, 10, 28]} />
        </mesh>
      </group>
    </group>
  );
}
