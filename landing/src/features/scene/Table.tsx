"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { DESK_BASE } from "./sceneConfig";

/**
 * The table — a real object, not a floor.
 *
 * The previous version was an 80-unit plane, and it was the single biggest thing
 * wrong with the scene: with no edge anywhere in frame there was nothing to read
 * as a surface, so the paper appeared to float in a brown void. That is also why
 * the thrown-bundle physics never convinced — a bounce means nothing if the thing
 * it bounces off has no visible extent.
 *
 * So it is a box with real thickness, standing on legs. The far edge and both
 * side edges sit inside the frame, and the thickness catches a different tone
 * from the top. Those three lines of silhouette are what make it a table.
 */

/** Top surface sits at y = 0; everything in the scene measures from there. */
/* Only just bigger than an open spread (2.0 x 1.38). A generous table is a
   realistic table and a useless one: if its edges fall outside the frame there
   is no silhouette, and the scene goes back to looking like an infinite floor —
   which is exactly the failure this component was written to fix. */
export const TABLE_W = 3.05;
export const TABLE_D = 2.15;
export const TABLE_THICK = 0.1;
const LEG = 0.16;
const LEG_H = 1.5;

const vertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormalW;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  uniform vec3 uBase;
  uniform vec3 uLightDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  void main() {
    vec3 n = normalize(vNormalW);
    bool top = abs(n.y) > 0.5;

    /* Grain is sampled from WORLD xz, so it runs continuously across the top
       regardless of how the box's own UVs are laid out — box UVs restart per
       face and would put a visible seam down the middle of the table. */
    vec2 g = top ? vWorld.xz : vec2(vWorld.x + vWorld.z, vWorld.y * 6.0);

    /* Frequencies are per WORLD UNIT, and one unit is a page width — so a table
       is only about three units across. The first pass reused numbers tuned for
       an 80-unit plane and produced roughly two ring cycles over the whole top,
       which read as broad diagonal smears rather than timber. */
    /* Frequencies are per WORLD UNIT, and one unit is a page width — so a table
       is only about three units across. Warp has to stay small: it shifts the
       ring PHASE, so a large multiplier swamps the base frequency and the grain
       turns into a few big cartoon waves instead of timber. */
    float warp = noise(g * vec2(1.6, 7.0)) * 0.35;
    float rings = sin(g.y * 62.0 + warp * 5.0 + noise(g * 1.2) * 1.6);
    float grain = smoothstep(0.15, 1.0, rings) * 0.028;
    float blotch = noise(g * 2.1) * 0.04 - 0.02;

    vec3 col = uBase * (1.0 + blotch) + grain;

    // The edges are the whole point of having thickness, so they get their own
    // tone rather than being shaded into invisibility.
    if (!top) col *= 0.52;

    float lambert = max(dot(n, normalize(uLightDir)), 0.0);
    col *= 0.55 + 0.6 * lambert;

    // Falls off toward the far corners so the surface has depth without the
    // heavy vignette the old plane needed to hide its edges.
    float d = length(vWorld.xz) / 3.4;
    col *= 1.0 - smoothstep(0.55, 1.5, d) * 0.45;

    gl_FragColor = vec4(col, 1.0);

    /* three converts hex colours to LINEAR working space on construction, and
       the renderer expects a linear value it can encode on the way out. A raw
       ShaderMaterial gets none of that automatically — without this include the
       linear value is written straight into an sRGB framebuffer and the whole
       scene renders dark and muddy. Every shader in this folder needs it. */
    #include <colorspace_fragment>
  }
`;

export default function Table() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uBase: { value: new THREE.Color(DESK_BASE) },
          uLightDir: { value: new THREE.Vector3(-3, 5, 2.5).normalize() },
        },
      }),
    [],
  );

  /** Legs inset from the corners, the way a real table's are. */
  const legs = useMemo(() => {
    const x = TABLE_W / 2 - LEG * 2.2;
    const z = TABLE_D / 2 - LEG * 2.2;
    return [
      [-x, z],
      [x, z],
      [-x, -z],
      [x, -z],
    ] as const;
  }, []);

  return (
    <group>
      <mesh position={[0, -TABLE_THICK / 2, 0]}>
        <boxGeometry args={[TABLE_W, TABLE_THICK, TABLE_D]} />
        <primitive object={material} attach="material" />
      </mesh>

      {legs.map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, -TABLE_THICK - LEG_H / 2, z]}>
          <boxGeometry args={[LEG, LEG_H, LEG]} />
          <primitive object={material} attach="material" />
        </mesh>
      ))}
    </group>
  );
}
