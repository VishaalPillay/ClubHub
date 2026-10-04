"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { PAGE_H, PAGE_W } from "./sceneConfig";
import type { RoomLight } from "./roomLight";
import { createCollegeStrip, resolveUiFont, type CollegeStrip } from "./collegeStrip";

/**
 * One leaf — a physical sheet with a page printed on each side.
 *
 * ── The curl ────────────────────────────────────────────────────────────────
 * This is the thing CSS structurally could not do, and the reason for the whole
 * rewrite: the page BENDS as it turns instead of pivoting rigidly.
 *
 * The bend is an exact circular arc, derived rather than faked. Parameterise the
 * sheet by arc length s from the spine and give it a tangent angle that grows
 * linearly along it — phi(s) = A + k*s — then integrate:
 *
 *     X(s) = INTEGRAL cos(phi) ds = ( sin(A + k*s) - sin(A) ) / k
 *     Y(s) = INTEGRAL sin(phi) ds = ( cos(A) - cos(A + k*s) ) / k
 *
 * Because it is integrated from a unit-speed tangent, arc length is preserved
 * exactly — the paper bends without stretching, which is precisely what the
 * cheap "displace along a sine wave" approach gets wrong. A is the rigid
 * rotation about the spine (0 to PI across a turn) and k is curvature, peaking
 * mid-turn and vanishing at both ends so a resting page is dead flat.
 *
 * The surface normal falls out of the same tangent — (-sin phi, cos phi, 0) — so
 * the lighting bends with the paper for free.
 *
 * ── One mesh, two pages ──────────────────────────────────────────────────────
 * gl_FrontFacing picks the texture in the fragment shader, so a leaf is a single
 * double-sided plane rather than two meshes back to back. No z-fighting along
 * the fold, and nothing to keep in sync.
 */

/** Segments across the sheet. The arc is evaluated per vertex, so this is the
 *  only thing standing between a smooth curl and a visible polygon fan. */
const SEGMENTS = 72;

/** Peak curvature mid-turn, in 1/units. Higher bends the paper harder; too high
 *  and the free edge curls back through the sheet. */
const CURVATURE = 1.55;

/** Vertical gap between stacked leaves. Large enough that no two sheets are ever
 *  coplanar (which z-fights), small enough that the stack reads as paper rather
 *  than a staircase. */
const SEPARATION = 0.0016;

const LEAVES = 4;

const vertex = /* glsl */ `
  uniform float uTurn;      // 0 = flat on the right. 1 = flat on the left.
  uniform float uCurve;     // peak curvature
  uniform float uBow;       // how far the free edges of resting paper rise
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  varying float vLift;      // 0 where the sheet touches the table, 1 at its most raised

  const float PI = 3.141592653589793;

  void main() {
    vUv = uv;

    // Plane geometry is authored in XY. The shader emits world-aligned axes
    // directly — x across the desk from the spine, y up off it, z depth — so the
    // mesh itself carries NO rotation. Rotating it as well would transform this
    // output a second time.
    //
    // depth IS negated, and it has to be. Without the flip, a CCW triangle
    // A(0,0) B(1,0) C(0,1) maps to a world normal of
    // (1,0,0) x (0,0,1) = (0,-1,0) — pointing down, away from a camera that is
    // above the desk. Every sheet then presents its BACK face, gl_FrontFacing
    // reads inverted, and each leaf renders the wrong page, mirrored. Negating
    // reverses the winding so the normal is (0,+1,0) and the recto faces up.
    //
    // It also fixes the vertical mapping for free: local +Y becomes world -Z,
    // the FAR edge of the desk, so the masthead prints at the top of the page
    // with no UV flip needed in the fragment shader.
    float s = position.x + ${(PAGE_W / 2).toFixed(6)};
    float depth = -position.y;

    float A = uTurn * PI;
    float k = uCurve * sin(uTurn * PI);

    vec2 arc;
    float phi;
    if (abs(k) < 1e-4) {
      // Zero curvature is a straight line, and the integrated form divides by k.
      // Resting pages land here every frame, so it is the common case.
      phi = A;
      arc = vec2(cos(A), sin(A)) * s;
    } else {
      phi = A + k * s;
      arc = vec2((sin(phi) - sin(A)) / k, (cos(A) - cos(phi)) / k);
    }

    /* Resting paper is not flat. The free edge and the far and near edges rise a
       little; the middle, and the spine side, stay down — so it still TOUCHES the
       table, and lifts off it toward the edges, which is what gives the contact
       shadow something to be under. It is added in the sheet's own frame (the group
       carries the tilt), and fades to nothing as the leaf turns, where the arc is
       already bending it far more than this could. */
    float calm = 1.0 - sin(uTurn * PI);
    float freeE = max(0.0, 2.0 * s - 1.0);
    float halfH = ${(PAGE_H / 2).toFixed(6)};
    float dn = depth / halfH;
    float bowK = 0.4 * freeE * freeE + 0.6 * dn * dn;
    vLift = bowK * calm;
    float bowH = uBow * calm * bowK;
    float dhds = uBow * calm * 0.4 * 4.0 * freeE;
    float dhdd = uBow * calm * 0.6 * 2.0 * dn / halfH;
    // Horizontal part of the upward normal of the bowed surface; flips with the leaf.
    vec3 bowN = vec3(-dhds * cos(phi), 0.0, -dhdd) * sign(cos(phi));

    vec3 local = vec3(arc.x, arc.y + bowH, depth);
    vNormalW = normalize(mat3(modelMatrix) * (vec3(-sin(phi), cos(phi), 0.0) + bowN));
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
  uniform vec3 uLightDir;
  uniform vec3 uTint;
  uniform vec3 uSun;
  uniform sampler2D uProfile; // the clip's own window-light pattern across the desk
  uniform vec3 uProf;         // tMin, 1/(tMax-tMin), ref
  uniform float uGoboK;
  uniform float uGoboP;
  uniform float uTime;
  uniform float uDapple;
  uniform float uDappleScale;
  uniform float uDappleSpeed;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  varying float vLift;

  // Cheap value noise, three octaves. Only ever read at one soft threshold, so
  // it does not need to be good noise — it needs to be smooth and cost nothing.
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y);
  }
  float fbm(vec2 p) {
    return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.03 + 7.1) + 0.15 * vnoise(p * 4.1 + 3.3);
  }

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
    float lambert = max(dot(n, normalize(uLightDir)), 0.0);

    // Generous ambient: this is printed paper under room light, not a studio
    // subject, and crushing the shadow side would cost legibility.
    /* The room tints the paper too, but far more gently than it tints the
       table — uTint stays close to white. Deliberate: these eight pages are the
       only thing on screen anyone has to be able to read. */
    /* The same window bars that cross the table cross the paper. Far weaker —
       this is the only thing on screen anyone has to read — but continuity of
       light across the two surfaces is most of what makes them one scene rather
       than a page pasted onto a photograph. */
    vec3 Ln = normalize(uLightDir);
    vec2 lh = normalize(vec2(Ln.x, Ln.z));
    /* The bars creep. A window's light on a desk is never perfectly still — the
       sun moves, the glass flexes, the trees outside shift — so the phase drifts
       a few percent of a period back and forth. Slow enough to read as the room
       breathing rather than as an effect. */
    float drift = 0.045 * sin(uTime * 0.21) + 0.03 * sin(uTime * 0.083 + 1.7);
    /* The MEASURED bars (see lightProfile in roomLight.ts): where this point of the
       paper falls across the window's shadow stripes, read off the same pattern that
       is lying on the mat beside it. Only close to the desk — a page stood up to the
       lens is not in the bars' plane — so it fades out over the first few tenths of
       a unit of lift, and the open spread is lit evenly. */
    float tc = dot(vWorld.xz, vec2(-lh.y, lh.x)) + drift * uGoboP;
    float pf = texture2D(uProfile, vec2(clamp((tc - uProf.x) * uProf.y, 0.0, 1.0), 0.5)).r;
    float deskward = 1.0 - smoothstep(0.0, 0.32, vWorld.y);
    float bar = 1.0 - deskward * (1.0 - clamp(pf / uProf.z, 0.0, 1.0));

    /* Leaf-shadow dapple, drifting along the light's own bearing — the leaves are
       between the sun and the desk, so their shadows travel the way the light
       travels. One soft threshold: blotches, not noise. */
    vec2 dq = vWorld.xz * uDappleScale + lh * (uTime * uDappleSpeed * 0.06)
            + vec2(0.35 * sin(uTime * 0.17), 0.3 * cos(uTime * 0.13));
    float leaf = smoothstep(0.40, 0.64, fbm(dq));
    float dapple = 1.0 - uDapple * (1.0 - leaf);

    /* Low orange sun: the side facing the window takes the sun's colour, the side
       turned away stays neutral. The same lambert that shades the page drives
       it, so the warmth bends with the paper as it curls. */
    vec3 lit = mix(vec3(1.0), uSun, 0.55 * lambert);

    /* A faint glint where the page catches the sun toward the lens. Paper is not
       a mirror, so this is a broad, weak lobe, not a highlight — but golden hour
       paper has a sheen, and without it the page looks matte-printed on screen. */
    vec3 V = normalize(cameraPosition - vWorld);
    float sheen = pow(max(dot(reflect(-normalize(uLightDir), n), V), 0.0), 7.0);

    /* The floor is high (0.84) on purpose. The sun is low and BEHIND the table, so a
       page stood up to face the lens faces away from it and the sun term is zero
       there; paper held up in a bright room still takes bounce light off the desk
       and the walls, and a floor of 0.70 made the open spread read as dim and
       brown exactly when it has to be read. */
    vec3 col = page.rgb * (0.84 + 0.28 * lambert) * lit * mix(1.0, bar, uGoboK) * dapple * uTint;
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
    col += uSun * sheen * 0.07;
    gl_FragColor = vec4(col, 1.0);

    /* The texture is decoded to LINEAR on sample (it is tagged SRGBColorSpace),
       so the result has to be encoded back on the way out. A raw ShaderMaterial
       does not get this for free, and without it the pages render dull and warm
       instead of crisp newsprint. */
    #include <colorspace_fragment>
  }
`;

export interface LeafProps {
  /** Leaf index, 0-based. */
  index: number;
  frontUrl: string;
  backUrl: string;
  /** Scroll position in step units. Read per frame, never during render. */
  posRef: React.RefObject<number>;
  /** Steps of camera-only lead-in before leaf 0 begins to turn. */
  lead: number;
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
        const res = await fetch("/pages/meta.json");
        if (!res.ok) return;
        const rect = (await res.json())?.colleges;
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

export default function Leaf({ index, frontUrl, backUrl, posRef, lead, light }: LeafProps) {
  const [front, back] = useLoader(THREE.TextureLoader, [frontUrl, backUrl]);
  const strip = useCollegeStrip(index === 0);

  /* Texture setup is a mutation, so it belongs in an effect rather than a memo.
     Anisotropy matters more than usual here: the pages are read at a steep angle
     and without it the type along the far edge turns to mush. */
  useLayoutEffect(() => {
    for (const t of [front, back]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.needsUpdate = true;
    }
  }, [front, back]);

  /* The profile as a 64x1 texture. One byte a sample is plenty for a gradient that
     is only ever read through a linear filter. */
  const profileTex = useMemo(() => {
    const d = new Uint8Array(light.lightProfile.samples.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)));
    const t = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat, THREE.UnsignedByteType);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }, [light.lightProfile]);

  const uniforms = useMemo(
    () => ({
      uTurn: { value: 0 },
      uCurve: { value: CURVATURE },
      uBow: { value: light.restBow },
      uFront: { value: front },
      uBack: { value: back },
      uStrip: { value: BLANK as THREE.Texture },
      uStripRect: { value: new THREE.Vector4() },
      uStripOn: { value: 0 },
      uLightDir: { value: new THREE.Vector3(...light.dir).normalize() },
      uTint: { value: new THREE.Color(light.paperTint) },
      uSun: { value: new THREE.Color(light.sunColor) },
      uProfile: { value: profileTex },
      uProf: {
        value: new THREE.Vector3(
          light.lightProfile.tMin,
          1 / (light.lightProfile.tMax - light.lightProfile.tMin),
          light.lightProfile.ref,
        ),
      },
      uGoboK: { value: light.goboPaper },
      uGoboP: { value: light.goboPeriod },
      uTime: { value: 0 },
      uDapple: { value: light.dapple },
      uDappleScale: { value: light.dappleScale },
      uDappleSpeed: { value: light.dappleSpeed },
    }),
    [front, back, light, profileTex],
  );

  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.ShaderMaterial>(null);

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
    const g = group.current;
    if (!m || !g) return;

    /* Each leaf derives its own turn rather than being handed one. Leaf k turns
       across pos [k, k+1], so no shared array has to be built, indexed during
       render, and kept in step. */
    const t = THREE.MathUtils.clamp((posRef.current ?? 0) - lead - index, 0, 1);
    m.uniforms.uTurn.value = t;
    m.uniforms.uTime.value = state.clock.elapsedTime;

    // The ticker is only on the recto, so only repaint while that face is up.
    if (strip && t < 0.6) strip.update(state.clock.elapsedTime);

    // Unturned leaves stack on the right in reading order; turned ones pile on
    // the left in the order they were turned. Lerping between the two keeps a
    // leaf from ever being exactly coplanar with a neighbour.
    g.position.y = THREE.MathUtils.lerp((LEAVES - index) * SEPARATION, (index + 1) * SEPARATION, t);
  });

  return (
    <group ref={group}>
      {/* No position and no rotation: the spine is the world origin and the
          shader already places every vertex in world-aligned axes. */}
      <mesh frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[PAGE_W, PAGE_H, SEGMENTS, 1]} />
        {/* `transparent` with an alpha of exactly 1 — it blends as opaque. It is set for the
            DRAW ORDER: three draws opaque objects first and transparent ones after,
            and the contact shadow is transparent, so with an opaque paper the shadow
            was drawn LAST and painted itself over any part of the paper that dipped
            below its plane while it tilted up (a grey band across the bottom edge for
            a few frames). Transparent, and a higher renderOrder than the shadow's -1,
            the paper is drawn after it and always wins where they overlap. */}
        <shaderMaterial
          ref={material}
          vertexShader={vertex}
          fragmentShader={fragment}
          side={THREE.DoubleSide}
          uniforms={uniforms}
          transparent
        />
      </mesh>
    </group>
  );
}
