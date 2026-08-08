"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The dust the paper kicks up when it lands.
 *
 * Points rather than billboard puffs, and no texture at all: the sprite is a
 * soft circle computed from `gl_PointCoord` in the fragment shader, so this
 * costs one draw call and zero bytes of asset. Dust motes off a table read
 * better as many small specks than as a few smoke clouds anyway.
 *
 * Emitted in a flat ring at the paper's edge — air squeezed out from under a
 * falling sheet escapes sideways, so the puff belongs at the perimeter rather
 * than the centre.
 */

const COUNT = 140;
const LIFE = 1.25;

/** Slight upward bias; most of the energy is outward. */
const RISE = 0.55;
const GRAVITY = -0.55;
const DRAG = 1.9;

/**
 * Deterministic pseudo-random, not `Math.random`.
 *
 * Two reasons, and the second is the real one. React's compiler refuses impure
 * calls during render, so a `Math.random` scatter built in a `useMemo` will not
 * even lint. And nobody has ever looked at a puff of dust and wished it were
 * differently arranged — the variety that matters is between particles, not
 * between page loads.
 */
function rand(i: number) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const vertex = /* glsl */ `
  attribute float aSeed;
  attribute vec3 aVel;
  uniform float uTime;
  uniform float uSize;
  varying float vFade;

  void main() {
    float t = uTime;

    // Integrated analytically rather than stepped: exponential drag has a closed
    // form, and it means the whole puff is one uniform update instead of 140
    // positions written from the CPU every frame.
    float k = ${DRAG.toFixed(2)};
    float decay = (1.0 - exp(-k * t)) / k;
    vec3 pos = position + aVel * decay + vec3(0.0, 0.5 * ${GRAVITY.toFixed(2)} * t * t, 0.0);

    vFade = clamp(1.0 - t / ${LIFE.toFixed(2)}, 0.0, 1.0);
    // Ease the fade so it thins out rather than switching off.
    vFade = vFade * vFade;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.5 + aSeed) / max(-mv.z, 0.1);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  varying float vFade;

  void main() {
    // Soft round mote, straight from the point's own coordinates.
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.12, d) * vFade * 0.5;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export default function Dust({ active, radius }: { active: boolean; radius: number }) {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const time = useRef(0);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      const a = rand(i) * Math.PI * 2;
      // Along the paper's edge, with a little scatter inward and outward.
      const r = radius * (0.75 + rand(i + 97) * 0.35);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 0.005 + rand(i + 211) * 0.02;
      pos[i * 3 + 2] = Math.sin(a) * r * 0.72;

      const speed = 0.35 + rand(i + 383) * 0.85;
      vel[i * 3] = Math.cos(a) * speed;
      vel[i * 3 + 1] = RISE * (0.35 + rand(i + 557));
      vel[i * 3 + 2] = Math.sin(a) * speed * 0.72;

      seed[i] = rand(i + 719);
    }

    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aVel", new THREE.BufferAttribute(vel, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [radius]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: LIFE },
      uSize: { value: 34 },
      uColor: { value: new THREE.Color("#d9c9ae") },
    }),
    [],
  );

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    const m = material.current;
    if (!m) return;

    /* Stays VISIBLE even when idle, parked past the end of its life so every
       fragment discards. three skips invisible objects entirely, so hiding it
       would defer the shader compile to the frame the paper lands — the one
       frame in the sequence that must not stall. Costs one draw call of
       instantly-discarded fragments in exchange. */
    if (!active) {
      time.current = 0;
      m.uniforms.uTime.value = LIFE;
      return;
    }

    time.current += Math.min(delta, 0.05);
    m.uniforms.uTime.value = time.current;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}
