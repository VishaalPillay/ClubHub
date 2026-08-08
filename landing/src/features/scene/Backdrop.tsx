"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/**
 * The room behind the table.
 *
 * ── Why a blurred photo is nearly free ───────────────────────────────────────
 * A background that is out of focus carries no detail, so it needs no
 * resolution: a 640px image blurred looks identical to a 4K one blurred. The
 * photographic option therefore costs ~15-20KB rather than the megabytes people
 * assume, which is why it wins over a procedural gradient here.
 *
 * Blur also makes the PROJECTION irrelevant. A normal photograph mapped onto a
 * sphere would be visibly distorted if you could see it — but you cannot, so an
 * ordinary snapshot works where an equirectangular capture would normally be
 * required. What the image actually contributes is colour and broad tonal
 * shape, and those survive any mapping.
 *
 * ── Graceful upgrade ─────────────────────────────────────────────────────────
 * With no photo supplied the shader draws its own dark room, so the scene is
 * complete today. Point BACKDROP_SRC at a file and it blends in on top. Nothing
 * else changes, and there is no 404 in the meantime because the path is a
 * compile-time constant rather than a probe.
 */

/**
 * Set to "/backdrop/room.avif" once `npm run backdrop:prep` has produced it.
 * Left null so the build never requests a file that is not there.
 */
const BACKDROP_SRC: string | null = null;

const RADIUS = 60;

const vertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uLow;
  uniform vec3 uHigh;
  uniform vec3 uGlow;
  uniform sampler2D uPhoto;
  uniform float uPhotoMix;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

  void main() {
    // Vertical ramp. Darkest overhead, lifting toward the horizon the way a room
    // does when the only light is low and to one side.
    float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uLow, uHigh, pow(1.0 - h, 1.6));

    /* Two broad, very soft blooms standing in for out-of-focus light sources.
       No edges anywhere: the moment this has a recognisable shape it stops
       reading as distance and starts reading as a picture on a wall. */
    float key = max(dot(vDir, normalize(vec3(-0.55, 0.18, -0.75))), 0.0);
    col += uGlow * pow(key, 3.5) * 0.55;

    float fill = max(dot(vDir, normalize(vec3(0.8, 0.05, 0.3))), 0.0);
    col += uGlow * pow(fill, 6.0) * 0.18;

    if (uPhotoMix > 0.0) {
      // Standard equirectangular lookup. Distortion is invisible at this blur.
      vec2 uv = vec2(atan(vDir.z, vDir.x) / 6.2831853 + 0.5, asin(clamp(vDir.y, -1.0, 1.0)) / 3.14159265 + 0.5);
      vec3 photo = texture2D(uPhoto, uv).rgb;

      /* Knocked well down and pulled toward the room's own palette. A backdrop
         at full strength competes with eight pages of small type, which is the
         one thing on screen that has to stay readable. */
      photo = mix(vec3(dot(photo, vec3(0.299, 0.587, 0.114))), photo, 0.55) * 0.5;
      col = mix(col, col * 0.35 + photo, uPhotoMix);
    }

    // Dither. A ramp this dark and this smooth bands badly in 8-bit otherwise.
    col += (hash(gl_FragCoord.xy) - 0.5) * 0.012;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export default function Backdrop() {
  const [photo, setPhoto] = useState<THREE.Texture | null>(null);
  /* Mutated through a ref rather than a memo: the compiler forbids modifying a
     value that was handed to a hook, and the uniforms have to be written when
     the texture eventually arrives. */
  const material = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uLow: { value: new THREE.Color("#0d0907") },
      uHigh: { value: new THREE.Color("#2b1d13") },
      uGlow: { value: new THREE.Color("#7a5533") },
      uPhoto: { value: null as THREE.Texture | null },
      uPhotoMix: { value: 0 },
    }),
    [],
  );

  useEffect(() => {
    if (!BACKDROP_SRC) return;
    let cancelled = false;
    const tex = new THREE.TextureLoader().load(BACKDROP_SRC, (t) => {
      if (cancelled) return;
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      setPhoto(t);
    });
    return () => {
      cancelled = true;
      tex.dispose();
    };
  }, []);

  useEffect(() => {
    const m = material.current;
    if (!m || !photo) return;
    m.uniforms.uPhoto.value = photo;
    m.uniforms.uPhotoMix.value = 1;
  }, [photo]);

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[RADIUS, 32, 16]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertex}
        fragmentShader={fragment}
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={uniforms}
      />
    </mesh>
  );
}
