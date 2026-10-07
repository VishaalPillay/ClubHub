import * as THREE from "three";
import type { RoomLight } from "./roomLight";

/**
 * The room's light, as GLSL every surface in the scene shares.
 *
 * The pages, the kraft folder, its cord and its button all sit in the same patch
 * of golden-hour sun, crossed by the same window bars and the same leaf shadows.
 * If each surface lit itself the folder would visibly not belong to the room the
 * pages are in, so this is the one copy: Leaf.tsx and Folder.tsx both include it.
 *
 * Includers must declare `varying vec3 vWorld;` before this chunk.
 */
export const ROOM_SHADING = /* glsl */ `
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

  // Cheap value noise, three octaves. Only ever read at soft thresholds, so it
  // does not need to be good noise — it needs to be smooth and cost nothing.
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

  /*
   * The diffuse light on a surface with normal n:
   *
   *   · a lambert term against the low sun, with a FLOOR for the bounce light a
   *     bright room puts on everything (pages use a high floor, for legibility);
   *   · the MEASURED window bars (lightProfile in roomLight.ts) — where this point
   *     falls across the stripes lying on the mat beside it. Only near the desk: a
   *     surface lifted toward the lens is not in the bars' plane, so they fade out
   *     over the first few tenths of a unit of lift. The phase drifts a few percent
   *     of a period, the room breathing;
   *   · leaf-shadow dapple drifting along the light's own bearing;
   *   · the sun's colour on whatever faces the window.
   */
  vec3 roomShade(vec3 albedo, vec3 n, float floorK, float gain) {
    vec3 Ln = normalize(uLightDir);
    float lambert = max(dot(n, Ln), 0.0);
    vec2 lh = normalize(vec2(Ln.x, Ln.z));

    float drift = 0.045 * sin(uTime * 0.21) + 0.03 * sin(uTime * 0.083 + 1.7);
    float tc = dot(vWorld.xz, vec2(-lh.y, lh.x)) + drift * uGoboP;
    float pf = texture2D(uProfile, vec2(clamp((tc - uProf.x) * uProf.y, 0.0, 1.0), 0.5)).r;
    float deskward = 1.0 - smoothstep(0.0, 0.32, vWorld.y);
    float bar = 1.0 - deskward * (1.0 - clamp(pf / uProf.z, 0.0, 1.0));

    vec2 dq = vWorld.xz * uDappleScale + lh * (uTime * uDappleSpeed * 0.06)
            + vec2(0.35 * sin(uTime * 0.17), 0.3 * cos(uTime * 0.13));
    float leaf = smoothstep(0.40, 0.64, fbm(dq));
    float dapple = 1.0 - uDapple * (1.0 - leaf);

    vec3 lit = mix(vec3(1.0), uSun, 0.55 * lambert);
    return albedo * (floorK + gain * lambert) * lit * mix(1.0, bar, uGoboK) * dapple * uTint;
  }

  /* A broad, weak lobe where a surface catches the sun toward the lens. Paper is
     not a mirror; golden-hour paper still has a sheen. Returns the lobe only —
     callers scale it for their material. */
  float roomSheen(vec3 n, float power) {
    vec3 V = normalize(cameraPosition - vWorld);
    return pow(max(dot(reflect(-normalize(uLightDir), n), V), 0.0), power);
  }
`;

/** The window-bar profile as a 64x1 texture. One byte a sample is plenty for a
 *  gradient that is only ever read through a linear filter. */
export function makeProfileTexture(light: RoomLight) {
  const d = new Uint8Array(
    light.lightProfile.samples.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)),
  );
  const t = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat, THREE.UnsignedByteType);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

/** The uniforms ROOM_SHADING reads. `goboK` defaults to the paper's own strength. */
export function roomUniforms(light: RoomLight, profile: THREE.Texture, goboK = light.goboPaper) {
  return {
    uLightDir: { value: new THREE.Vector3(...light.dir).normalize() },
    uTint: { value: new THREE.Color(light.paperTint) },
    uSun: { value: new THREE.Color(light.sunColor) },
    uProfile: { value: profile },
    uProf: {
      value: new THREE.Vector3(
        light.lightProfile.tMin,
        1 / (light.lightProfile.tMax - light.lightProfile.tMin),
        light.lightProfile.ref,
      ),
    },
    uGoboK: { value: goboK },
    uGoboP: { value: light.goboPeriod },
    uTime: { value: 0 },
    uDapple: { value: light.dapple },
    uDappleScale: { value: light.dappleScale },
    uDappleSpeed: { value: light.dappleSpeed },
  };
}
