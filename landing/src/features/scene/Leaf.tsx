"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  LEAF_BASE_RIGHT,
  PAGE_H,
  PAGE_W,
  closeProgress,
  folderProgress,
  pageBow,
} from "./sceneConfig";
import type { RoomLight } from "./roomLight";
import { ROOM_SHADING, makeProfileTexture, roomUniforms } from "./roomShading";
import { createCollegeStrip, resolveUiFont, type CollegeStrip } from "./collegeStrip";
import { disposeTexture, loadManifest, loadTexture, type PagesManifest } from "./textures";

/**
 * One card of the deck — a single page, the edition read one page at a time.
 *
 * The motion is in `cardPose` below: the top card is taken off, drawn out to the side,
 * and slid back under the deck, the way you go through a pack of cards. The card is
 * a plane deformed in the vertex shader, which can also BEND it — an exact circular arc,
 * derived rather than faked: give the sheet a tangent angle that grows linearly along it,
 * phi(u) = A + k*u, and integrate (arc length is preserved, so the paper bows without
 * stretching). Here A stays 0 — a card is never turned over — and k is the slight bow of
 * a card being pulled from the pile. The surface normal falls out of the same tangent,
 * so the room's light bends with it.
 *
 * The back face is plain paper (uBack): a card's back is never what you read.
 */

/** Segments across the sheet. The arc is evaluated per vertex, so this is the
 *  only thing standing between a smooth curl and a visible polygon fan. */
const SEGMENTS = 72;

/** Vertical gap between stacked leaves. Large enough that no two sheets are ever
 *  coplanar (which z-fights), small enough that the stack reads as paper rather
 *  than a staircase. */
const SEPARATION = 0.0016;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * Where a card is, as the reader works through the deck.
 *
 * ── Why a deck, and not a book ───────────────────────────────────────────────
 * The edition's pages are loose cards in a folder, read one at a time, and you go
 * through a deck the way you go through any deck of cards: take the top one, move it
 * to the back. So every page stays on the one pile on the right; nothing is turned
 * over and nothing lands on the left. For the card on top, `t` of the way through
 * its move:
 *
 *   0.00–0.16  picked up        it lifts off the deck toward the reader
 *   0.08–0.50  drawn out        it slides out over the open cover (DRAW_DIR), the wrist twisting a few
 *                               degrees and the card bowing slightly as it is pulled
 *   0.46–0.58  lowered          clear of the deck, it drops to the bottom of the pile
 *   0.52–0.95  slid back under  and is pushed back in, beneath everything — the card
 *                               that was under it is now on top, and is what you read
 *
 * Nothing passes through anything: the card only changes height while it is entirely
 * clear of the deck (drawn out by more than a page width).
 *
 * ── Heights ──────────────────────────────────────────────────────────────────
 * A card's place in the pile is its RANK from the bottom. Before its own move, card i
 * has the unmoved cards below it plus every card already sent to the back; after, it
 * has only the cards sent back after it. `u` is continuous, so ranks — and therefore
 * heights — slide smoothly as cards come and go, and the pile never z-fights.
 */
export const CARDS = 8;

function rankOf(i: number, u: number) {
  const t = u - i;
  if (t <= 0) return CARDS - 1 - i + Math.max(0, Math.min(u, i));
  if (t >= 1) return Math.max(0, Math.min(u - 1 - i, CARDS - 1));
  return THREE.MathUtils.lerp(CARDS - 1, 0, t);
}

const heightOf = (rank: number) => LEAF_BASE_RIGHT + (rank + 1) * SEPARATION;

/**
 * Which way the top card is drawn out: −1 is LEFT, over the open cover.
 *
 * It used to go right, off the deck's free edge. But the reading pose now slides the open
 * folder right to balance it in the frame (READ_SHIFT in NewspaperScene), and that left
 * no room on that side: at the peak of the move half the card was off the screen. The
 * open cover is the empty half of the composition, and lying flat at the board's height it
 * sits well below anything a card is carried at (≥ LEAF_BASE_RIGHT), so the card is drawn
 * out over it — fully in frame, the way you would slide a card onto the table beside the
 * deck — and pushed back under the deck from that side.
 */
const DRAW_DIR = -1;

function cardPose(i: number, u: number) {
  const half = PAGE_W / 2;
  const t = THREE.MathUtils.clamp(u - i, 0, 1);
  const rest = heightOf(rankOf(i, u));
  if (t <= 0 || t >= 1) {
    return { a: 0, k: 0, cx: half, cy: rest, yaw: 0, calm: 1, t };
  }
  const out = smooth(0.08, 0.5, t);
  const back = smooth(0.52, 0.95, t);
  const lifted = heightOf(CARDS) + 0.07;
  const up = THREE.MathUtils.lerp(heightOf(CARDS - 1), lifted, smooth(0, 0.16, t));
  const cy = THREE.MathUtils.lerp(up, heightOf(0), smooth(0.46, 0.58, t));
  const carry = Math.sin(Math.PI * t);
  return {
    a: 0,
    // Bowed a little by the pull, and only while in the hand.
    k: -0.22 * carry,
    // Out past the deck's edge by a little more than a page, then back.
    cx: half + DRAW_DIR * PAGE_W * 1.08 * (out - back),
    cy,
    // The wrist: a few degrees one way going out, easing back as it is pushed home.
    yaw: -DRAW_DIR * 0.09 * Math.sin(Math.PI * out) * (1 - back),
    calm: 1 - smooth(0, 0.1, t) * (1 - smooth(0.9, 1, t)),
    t,
  };
}

const vertex = /* glsl */ `
  // The sheet's pose, computed per frame in sheetPose() — see there for the motion.
  uniform float uA;         // how far it has been turned over, 0 … PI, about its own middle
  uniform float uK;         // its sag while carried, in 1/units
  uniform vec2 uC;          // where its middle is: x across the desk, y up off it
  uniform float uYaw;       // the twist of the wrist that carries it
  uniform float uCalm;      // 1 lying on a pile, 0 in the hand
  uniform float uBow;       // how far the free edges of resting paper rise
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  varying float vLift;      // 0 where the sheet touches the pile, 1 at its most raised

  void main() {
    vUv = uv;

    // Plane geometry is authored in XY; the shader emits edition axes directly
    // (x across the desk from the spine, y up off it, z depth), so the mesh carries
    // no rotation. depth IS negated: that keeps the recto's winding facing up and
    // puts local +Y — the masthead — at the far edge of the desk.
    float u = position.x;                              // from the sheet's middle
    float s = u + ${(PAGE_W / 2).toFixed(6)};          // from its spine edge
    float depth = -position.y;

    /* A sheet held by its middle and turned over: the tangent angle is the turn plus
       a constant curvature (the sag), integrated outward from the middle, so the
       paper bends without stretching — the same exact-arc construction the old
       spine-hinged turn used, centred on the hand instead of the spine. */
    float phi = uA + uK * u;
    vec2 d;
    if (abs(uK) < 1e-4) {
      d = vec2(cos(uA), sin(uA)) * u;
    } else {
      d = vec2((sin(phi) - sin(uA)) / uK, (cos(uA) - cos(phi)) / uK);
    }
    vec2 nrm = vec2(-sin(phi), cos(phi));

    /* Resting paper is not flat: the free edge and the far and near edges rise a
       little while the middle and spine side stay down, so it touches the pile and
       lifts off it toward the edges. Only while it is lying down. */
    float freeE = max(0.0, 2.0 * s - 1.0);
    float halfH = ${(PAGE_H / 2).toFixed(6)};
    float dn = depth / halfH;
    float bowK = 0.4 * freeE * freeE + 0.6 * dn * dn;
    vLift = bowK * uCalm;
    float bowH = uBow * uCalm * bowK;
    float dhds = uBow * uCalm * 0.4 * 4.0 * freeE;
    float dhdd = uBow * uCalm * 0.6 * 2.0 * dn / halfH;
    // UP, whichever face is up — not along the sheet's normal, which points down once
    // it lies face-down and would bend its edges through the cover beneath it.
    d.y += bowH;
    vec3 bowN = vec3(-dhds * cos(phi), 0.0, -dhdd) * sign(cos(phi));

    // The twist of the wrist, about the vertical through the sheet's middle.
    float cy = cos(uYaw);
    float sy = sin(uYaw);
    vec3 local = vec3(uC.x + d.x * cy + depth * sy, uC.y + d.y, -d.x * sy + depth * cy);
    vec3 n = vec3(nrm.x, nrm.y, 0.0) + bowN;
    n = vec3(n.x * cy + n.z * sy, n.y, -n.x * sy + n.z * cy);

    vNormalW = normalize(mat3(modelMatrix) * n);
    vec4 world = modelMatrix * vec4(local, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(local, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D uFront;
  uniform sampler2D uBack;
  uniform sampler2D uStrip;   // live "Available at" ticker (page 1 only)
  uniform vec4 uStripRect;    // its patch of the front texture: u0, v0, du, dv
  uniform float uStripOn;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  varying float vLift;

  ${ROOM_SHADING}

  void main() {
    // The recto needs no correction at all: u = 0 sits at the spine, which is a
    // right-hand page's left edge, and the vertex shader already put local +Y at
    // the far edge of the desk.
    //
    // The verso is mirrored in u alone. A turned leaf occupies world x from -W
    // to 0, so u = 0 (the spine) lands on the RIGHT of the screen — and a
    // left-hand page carries its spine on the right, so the image has to run the
    // other way. Depth is untouched by the turn (the sheet rotates about an axis
    // parallel to world Z), so v is the same on both faces.
    vec2 uvB = vec2(1.0 - vUv.x, vUv.y);
    vec4 page = gl_FrontFacing ? texture2D(uFront, vUv) : texture2D(uBack, uvB);

    // The page texture is a photograph, so the ticker on it is a still. Where a live
    // patch exists it replaces that rectangle of the recto, nothing else.
    if (gl_FrontFacing && uStripOn > 0.5) {
      vec2 q = (vUv - uStripRect.xy) / uStripRect.zw;
      if (q.x >= 0.0 && q.x <= 1.0 && q.y >= 0.0 && q.y <= 1.0) {
        page = texture2D(uStrip, q);
      }
    }

    vec3 n = normalize(vNormalW) * (gl_FrontFacing ? 1.0 : -1.0);

    /* The room's light (roomShading.ts), shared with the folder the pages sit in.
       The floor is high (0.84) on purpose. The sun is low and BEHIND the table, so a
       page stood up to face the lens faces away from it and the sun term is zero
       there; paper held up in a bright room still takes bounce light off the desk
       and the walls, and a floor of 0.70 made the open spread read as dim and
       brown exactly when it has to be read. */
    vec3 col = roomShade(page.rgb, n, 0.84, 0.28);
    /* Where the sheet touches the table it is shut off from the sky — a few percent
       darker than where its edges stand clear — and its very rim, being an edge, takes
       a little shade. Both are small and both are the sort of thing the eye uses to
       decide a sheet is lying on something rather than floating over it. The rim is
       gone once the page is lifted: held up to the lens it is not in contact with
       anything. */
    vec2 ed = min(vUv, 1.0 - vUv);
    float rim = smoothstep(0.0, 0.0045, min(ed.x, ed.y));
    float rest = (1.0 - smoothstep(0.0, 0.32, vWorld.y));
    col *= mix(1.0, mix(0.9, 1.0, rim), rest);
    col *= mix(1.0, mix(0.93, 1.0, smoothstep(0.0, 0.7, vLift)), rest);
    col += uSun * roomSheen(n, 7.0) * 0.07;
    gl_FragColor = vec4(col, 1.0);

    /* The texture is decoded to LINEAR on sample (it is tagged SRGBColorSpace),
       so the result has to be encoded back on the way out. A raw ShaderMaterial
       does not get this for free, and without it the pages render dull and warm
       instead of crisp newsprint. */
    #include <colorspace_fragment>
  }
`;

export interface LeafProps {
  /** Card index, 0-based — the page number it carries. Card 0 is page 1, on top. */
  index: number;
  /** The page-texture manifest (textures.ts), or null until it has arrived. */
  manifest: PagesManifest | null;
  /** The scene is on screen. Nothing is downloaded for a page until then. */
  ready: boolean;
  /** The size read at: "l" (3x) on a capable laptop, "m" (2x) otherwise. */
  full: "l" | "m";
  /** A page could not be shown at all — the scene should give way to the plain document. */
  onFail: (reason: string) => void;
  /** Scroll position in step units. Read per frame, never during render. */
  posRef: React.RefObject<number>;
  /** Steps of camera-only lead-in before leaf 0 begins to turn. */
  lead: number;
  /** Steps that move a leaf — needed to know when the folder is closing at the end. */
  turns: number;
  /** The hour's light rig, shared with the table and the room behind it. */
  light: RoomLight;
}

/** A 1x1 stand-in so the shader's sampler is always bound, whether or not a strip exists. */
const BLANK = new THREE.DataTexture(new Uint8Array([248, 238, 223, 255]), 1, 1);
BLANK.needsUpdate = true;

/**
 * Starts the live ticker for the leaf that carries page 1. Fails quietly: if the metadata,
 * the font or the canvas is unavailable the baked (still) ticker simply stays on the page.
 */
function useCollegeStrip(enabled: boolean): CollegeStrip | null {
  const [strip, setStrip] = useState<CollegeStrip | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let made: CollegeStrip | null = null;

    (async () => {
      try {
        const rect = (await loadManifest())?.colleges;
        if (!rect) return;
        const family = resolveUiFont();
        await document.fonts.load(`700 24px ${family}`);
        if (cancelled) return;
        made = createCollegeStrip(rect, family);
        setStrip(made);
      } catch {
        /* keep the baked frame */
      }
    })();

    return () => {
      cancelled = true;
      made?.dispose();
    };
  }, [enabled]);

  return strip;
}

type Tier = "s" | "m" | "l";

/**
 * When a card wants its full-size page, in steps of its own move (d = u − index):
 * from two cards before it reaches the top until one card after it has gone to the
 * back — loaded while the reader is still on an earlier page, not as this one arrives.
 * Released again past FAR; the gap is hysteresis, so scrolling back and forth across one
 * page does not reload it. At most four cards' worth of full textures are on the GPU.
 */
const NEAR_BEFORE = 2.2;
const NEAR_AFTER = 1.3;
const FAR_BEFORE = 3.2;
const FAR_AFTER = 2.3;

/**
 * A finished download is swapped in — which is when its pixels are uploaded to the GPU,
 * a 1722x2376 upload with mipmaps that costs a visible frame — only while the scroll is
 * still, or when the card is about to be seen and it must be there regardless. Uploading
 * the moment it lands put that hitch in the middle of a scroll.
 */
const STILL_FRAMES = 6;
const MUST_SHOW = -1.05;

export default function Leaf({
  index,
  manifest,
  ready,
  full,
  onFail,
  posRef,
  lead,
  turns,
  light,
}: LeafProps) {
  // The live ticker paints its own logos — after the scene is up, not competing with it.
  const strip = useCollegeStrip(index === 0 && ready);

  const profileTex = useMemo(() => makeProfileTexture(light), [light]);

  const uniforms = useMemo(
    () => ({
      uA: { value: 0 },
      uK: { value: 0 },
      uC: { value: new THREE.Vector2() },
      uYaw: { value: 0 },
      uCalm: { value: 1 },
      uBow: { value: light.restBow },
      // Paper-coloured until the preview lands. Nobody sees it: on the first frame
      // every leaf is under the folder's shut cover.
      uFront: { value: BLANK as THREE.Texture },
      uBack: { value: BLANK as THREE.Texture },
      uStrip: { value: BLANK as THREE.Texture },
      uStripRect: { value: new THREE.Vector4() },
      uStripOn: { value: 0 },
      ...roomUniforms(light, profileTex),
    }),
    [light, profileTex],
  );

  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.ShaderMaterial>(null);

  /**
   * Which size of this leaf's two pages is on the GPU, and which is on its way.
   *
   * A ref, not state: it changes from the render loop and nothing React renders depends
   * on it — the textures go straight into the material's uniforms.
   */
  const tex = useRef({
    tier: null as Tier | null,
    pending: null as Tier | null,
    current: null as THREE.Texture | null,
    /** Downloaded and decoded, waiting for a still moment to be swapped in. */
    ready: null as { tier: Tier; t: THREE.Texture } | null,
    fullFailed: false,
    gone: false,
    lastPos: Number.NaN,
    still: 0,
  });

  useEffect(() => {
    const s = tex.current;
    s.gone = false;
    return () => {
      s.gone = true;
      disposeTexture(s.current);
      disposeTexture(s.ready?.t);
      s.current = null;
      s.ready = null;
      s.tier = s.pending = null;
    };
  }, []);

  /** Start fetching this card's page at `tier`; it is swapped in by the frame loop. */
  const want = (tier: Tier) => {
    const s = tex.current;
    const url = manifest?.pages[index]?.[tier];
    if (!url || s.pending === tier || s.tier === tier || s.ready?.tier === tier) return;
    s.pending = tier;
    loadTexture(url)
      .then((t) => {
        if (s.gone || s.pending !== tier) return disposeTexture(t);
        s.pending = null;
        disposeTexture(s.ready?.t);
        s.ready = { tier, t };
      })
      .catch(() => {
        if (s.gone) return;
        s.pending = null;
        // A missing full size is survivable — the preview stays. A missing preview means
        // this page cannot be shown at all.
        if (tier === "s") onFail("texture");
        else s.fullFailed = true;
      });
  };

  // Bind the live ticker once it exists. Uniforms are mutated rather than rebuilt so the
  // material is not recompiled for a patch of one page.
  useEffect(() => {
    const m = material.current;
    if (!m || !strip) return;
    m.uniforms.uStrip.value = strip.texture;
    m.uniforms.uStripRect.value.copy(strip.uvRect);
    m.uniforms.uStripOn.value = 1;
    return () => {
      m.uniforms.uStripOn.value = 0;
      m.uniforms.uStrip.value = BLANK;
    };
  }, [strip]);

  useFrame((state) => {
    const m = material.current;
    if (!m) return;

    /* Each leaf derives its own move rather than being handed one. Leaf k is
       handled across pos [k, k+1], so no shared array has to be built, indexed
       during render, and kept in step. */
    const pos = posRef.current ?? 0;
    /* Capped at the last card. Past it is the lead-out, where the cover closes over the
       deck — and uncapped, the lead-out step read as "move the last card", so page 8
       was drawn out from under a closing cover. */
    const p = cardPose(index, Math.min(pos - lead, turns));
    const t = p.t;
    m.uniforms.uA.value = p.a;
    m.uniforms.uK.value = p.k;
    m.uniforms.uC.value.set(p.cx, p.cy);
    m.uniforms.uYaw.value = p.yaw;
    m.uniforms.uCalm.value = p.calm;
    m.uniforms.uTime.value = state.clock.elapsedTime;
    // Pressed flat while a board is anywhere near it; a bowed edge would push through.
    m.uniforms.uBow.value =
      light.restBow * pageBow(folderProgress(pos, lead), closeProgress(pos, turns, lead));

    // The ticker is on page 1 only, so only repaint while that card is anywhere near the top.
    if (strip && t < 0.6 && pos - lead < 1.2) strip.update(state.clock.elapsedTime);

    /* Textures, just in time. Every leaf gets its preview once the scene is up; the
       full size only while the reader is within NEAR of this leaf's move, and it is
       given back (the preview is re-fetched from cache) once they are past FAR — so at
       most three leaves' worth of full textures are ever on the GPU. */
    if (!ready || !manifest) return;
    const s = tex.current;
    const d = pos - lead - index;

    s.still = Math.abs(pos - s.lastPos) < 1e-4 ? s.still + 1 : 0;
    s.lastPos = pos;
    // The first texture always goes straight in; after that, only when still or needed.
    if (s.ready && (!s.current || s.still >= STILL_FRAMES || d > MUST_SHOW)) {
      const { tier, t: nt } = s.ready;
      s.ready = null;
      disposeTexture(s.current);
      s.current = nt;
      s.tier = tier;
      m.uniforms.uFront.value = nt;
    }

    const near = d > -NEAR_BEFORE && d < NEAR_AFTER;
    const far = d < -FAR_BEFORE || d > FAR_AFTER;
    if (!s.tier && !s.ready) want("s");
    else if (near && s.tier !== full && !s.fullFailed) want(full);
    else if (far && s.tier && s.tier !== "s") want("s");
  });


  return (
    <group ref={group}>
      {/* No position and no rotation: the spine is the world origin and the
          shader already places every vertex in world-aligned axes. */}
      <mesh frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[PAGE_W, PAGE_H, SEGMENTS, 1]} />
        {/* OPAQUE, and that is a performance decision. Eight cards lie stacked on each
            other; three draws transparent objects back to front, so as "transparent" (an
            old fix for the paper dipping below the contact shadow, which no longer can:
            the deck rides on the folder, well above the shadow plane) the GPU fully shaded
            all eight on every pixel of the page. Opaque, they are drawn front to back and
            every card under the top one is rejected by the depth test before it is
            shaded. */}
        <shaderMaterial
          ref={material}
          vertexShader={vertex}
          fragmentShader={fragment}
          side={THREE.DoubleSide}
          uniforms={uniforms}
        />
      </mesh>
    </group>
  );
}
