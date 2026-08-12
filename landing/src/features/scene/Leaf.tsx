"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { PAGE_H, PAGE_W } from "./sceneConfig";
import type { RoomLight } from "./roomLight";

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
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorld;

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

    vNormalW = normalize(mat3(modelMatrix) * vec3(-sin(phi), cos(phi), 0.0));
    vec4 world = modelMatrix * vec4(arc.x, arc.y, depth, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(arc.x, arc.y, depth, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D uFront;
  uniform sampler2D uBack;
  uniform vec3 uLightDir;
  uniform vec3 uTint;
  uniform float uGoboK;
  uniform float uGoboP;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorld;

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
    float bar = 0.5 + 0.5 * cos(dot(vWorld.xz, vec2(-lh.y, lh.x)) / uGoboP * 6.2831853);
    bar = smoothstep(0.16, 0.86, bar);

    gl_FragColor = vec4(
      page.rgb * (0.72 + 0.38 * lambert) * (1.0 - uGoboK * (1.0 - bar)) * uTint, 1.0);

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

export default function Leaf({ index, frontUrl, backUrl, posRef, lead, light }: LeafProps) {
  const [front, back] = useLoader(THREE.TextureLoader, [frontUrl, backUrl]);

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

  const uniforms = useMemo(
    () => ({
      uTurn: { value: 0 },
      uCurve: { value: CURVATURE },
      uFront: { value: front },
      uBack: { value: back },
      uLightDir: { value: new THREE.Vector3(...light.dir).normalize() },
      uTint: { value: new THREE.Color(light.paperTint) },
      uGoboK: { value: light.goboPaper },
      uGoboP: { value: light.goboPeriod },
    }),
    [front, back, light],
  );

  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.ShaderMaterial>(null);

  useFrame(() => {
    const m = material.current;
    const g = group.current;
    if (!m || !g) return;

    /* Each leaf derives its own turn rather than being handed one. Leaf k turns
       across pos [k, k+1], so no shared array has to be built, indexed during
       render, and kept in step. */
    const t = THREE.MathUtils.clamp((posRef.current ?? 0) - lead - index, 0, 1);
    m.uniforms.uTurn.value = t;

    // Unturned leaves stack on the right in reading order; turned ones pile on
    // the left in the order they were turned. Lerping between the two keeps a
    // leaf from ever being exactly coplanar with a neighbour.
    g.position.y = THREE.MathUtils.lerp((LEAVES - index) * SEPARATION, (index + 1) * SEPARATION, t);
  });

  return (
    <group ref={group}>
      {/* No position and no rotation: the spine is the world origin and the
          shader already places every vertex in world-aligned axes. */}
      <mesh frustumCulled={false}>
        <planeGeometry args={[PAGE_W, PAGE_H, SEGMENTS, 1]} />
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
