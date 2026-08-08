"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import Dust from "./Dust";
import { PAGE_H, PAGE_W } from "./sceneConfig";

/**
 * The delivery — the front page falls flat onto the table.
 *
 * This replaces a rolled bundle thrown in on a ballistic arc. That version was
 * scrapped for a reason worth recording: with no table edges in frame the scene
 * read as empty space, and a bounce off a surface nobody can see convinces
 * nobody. A sheet falling flat needs no such contract with the floor — you read
 * it as paper from the flutter alone.
 *
 * Three things sell it, and none of them are the fall itself:
 *   · it does not stay level. Real paper tips, catches air, and levels out late.
 *   · it does not slam. Air trapped underneath brakes it over the last few
 *     centimetres, so it settles rather than arrives.
 *   · the contact shadow tightens and darkens as it comes down, which is what
 *     tells the eye how far above the table it still is.
 */

const FALL_S = 1.05;

/** Starting height, in page widths. */
const START_Y = 2.6;

/**
 * How far the resting sheet floats above the table.
 *
 * Small enough to be invisible, large enough to sit clear of the contact
 * shadow. Roughly matches where leaf 0 rests in the real edition, so the
 * hand-off does not step.
 */
const REST_Y = 0.005;

/** Where the air cushion starts to bite, as a fraction of the fall. */
const CUSHION_FROM = 0.78;

const vertex = /* glsl */ `
  uniform float uBend;
  varying vec2 vUv;
  varying vec3 vNormalW;

  const float HALF_W = ${(PAGE_W / 2).toFixed(6)};

  void main() {
    vUv = uv;

    // Flat geometry, matching Leaf's resting state exactly so the hand-off to
    // the real edition is a no-op: same axes, same negated depth, same winding.
    float x = position.x;
    float depth = -position.y;

    /* A slack sheet sags along its long axis. One cosine lobe, strongest at the
       edges, vanishing as it settles — enough to stop it reading as a rigid
       board without pretending to be cloth simulation. */
    float sag = uBend * (1.0 - cos(vUv.x * 6.2831853)) * 0.5;
    float y = sag;

    vec3 n = normalize(vec3(uBend * sin(vUv.x * 6.2831853) * 2.0, 1.0, 0.0));
    vNormalW = normalize(mat3(modelMatrix) * n);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(x, y, depth, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D uFront;
  uniform sampler2D uBack;
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying vec3 vNormalW;

  void main() {
    vec2 uvB = vec2(1.0 - vUv.x, vUv.y);
    vec4 page = gl_FrontFacing ? texture2D(uFront, vUv) : texture2D(uBack, uvB);
    vec3 n = normalize(vNormalW) * (gl_FrontFacing ? 1.0 : -1.0);
    float lambert = max(dot(n, normalize(uLightDir)), 0.0);
    gl_FragColor = vec4(page.rgb * (0.72 + 0.38 * lambert), 1.0);
    #include <colorspace_fragment>
  }
`;

/** Soft elliptical contact shadow, no texture and no shadow map. */
const shadowFragment = /* glsl */ `
  precision highp float;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float d = length((vUv - 0.5) * vec2(2.0, 2.0));
    float a = smoothstep(1.0, 0.15, d) * uStrength;
    if (a < 0.004) discard;
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
  }
`;

const shadowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);

export interface DropProps {
  onLanded: () => void;
  onDone: () => void;
  heightRef: React.RefObject<number>;
}

export default function Drop({ onLanded, onDone, heightRef }: DropProps) {
  const [front, back] = useLoader(THREE.TextureLoader, ["/pages/01.avif", "/pages/02.avif"]);
  const [dust, setDust] = useState(false);

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
      uBend: { value: 0.06 },
      uFront: { value: front },
      uBack: { value: back },
      uLightDir: { value: new THREE.Vector3(-3, 5, 2.5).normalize() },
    }),
    [front, back],
  );

  const shadowUniforms = useMemo(() => ({ uStrength: { value: 0 } }), []);

  const group = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const shadowMat = useRef<THREE.ShaderMaterial>(null);

  const phase = useRef<"fall" | "wait" | "done">("fall");
  const clock = useRef(0);

  /** A little variation per load, so it is not the same fall every visit.
   *  Rolled in an effect rather than in a memo: the compiler will not allow an
   *  impure call during render, and replacing `.current` wholesale is the ref
   *  mutation it does permit. */
  const seed = useRef({ tiltX: 0.2, tiltZ: -0.15, yaw: 0.05, driftX: 0.1, driftZ: -0.08 });

  useLayoutEffect(() => {
    seed.current = {
      tiltX: (Math.random() - 0.5) * 0.5,
      tiltZ: (Math.random() - 0.5) * 0.42,
      yaw: (Math.random() - 0.5) * 0.16,
      driftX: (Math.random() - 0.5) * 0.5,
      driftZ: (Math.random() - 0.5) * 0.35,
    };
  }, []);

  /**
   * Hands straight over. There is no opening animation any more, and there
   * should not be: the sheet is already flat and already in leaf 0's resting
   * position, so the old half-second "open" phase animated nothing — it just
   * held the scroll locked while the reader was trying to use it. Scrolling now
   * takes effect on the first gesture.
   */
  const open = useCallback(() => {
    if (phase.current !== "wait") return;
    phase.current = "done";
    onDone();
  }, [onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key === "Tab") return;
      e.preventDefault();
      open();
    };
    const passive = { passive: true } as const;
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", open, passive);
    window.addEventListener("wheel", open, passive);
    window.addEventListener("touchstart", open, passive);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", open);
      window.removeEventListener("wheel", open);
      window.removeEventListener("touchstart", open);
    };
  }, [open]);

  useFrame((_, delta) => {
    const g = group.current;
    const m = material.current;
    const sm = shadowMat.current;
    const sh = shadow.current;
    if (!g || !m || !sm || !sh) return;

    clock.current += Math.min(delta, 0.05);

    if (phase.current === "fall") {
      const p = Math.min(clock.current / FALL_S, 1);

      /* Gravity for most of it, then an air cushion. A sheet this size traps a
         layer of air under itself and decelerates hard over the last stretch —
         which is exactly why paper lands with a sigh and a coin does not. */
      const fall =
        p < CUSHION_FROM
          ? (p / CUSHION_FROM) * (p / CUSHION_FROM) * CUSHION_FROM
          : CUSHION_FROM + (1 - CUSHION_FROM) * easeOutCubic((p - CUSHION_FROM) / (1 - CUSHION_FROM));

      const h = START_Y * (1 - fall);
      g.position.set(
        seed.current.driftX * (1 - fall),
        h + REST_Y,
        seed.current.driftZ * (1 - fall),
      );

      // Tips on the way down and levels out late, the way a dropped sheet does.
      const level = easeOutCubic(Math.min(p / 0.92, 1));
      g.rotation.set(seed.current.tiltX * (1 - level), seed.current.yaw * (1 - level), seed.current.tiltZ * (1 - level));

      // Sag decays to exactly zero, so the resting sheet cannot meet the shadow.
      m.uniforms.uBend.value = 0.075 * (1 - level);

      // Shadow: broad and faint when high, tight and dark on contact.
      const k = 1 - h / START_Y;
      sh.scale.setScalar(1.5 - 0.55 * k);
      sm.uniforms.uStrength.value = 0.05 + 0.4 * k * k;

      heightRef.current = h;

      if (p >= 1) {
        phase.current = "wait";
        clock.current = 0;
        setDust(true);
        onLanded();
      }
      return;
    }

    /* At rest the sheet is DEAD FLAT, and that is a bug fix rather than a
       simplification. Keeping a residual sag meant the page arched to `uBend` in
       the middle and 0 at its edges, while the contact shadow sat at a fixed
       height — so the shadow quad sliced clean through the arch and painted a
       dark band down each side of the page. Flat paper cannot intersect it, and
       REST_Y keeps the whole sheet above the shadow regardless. */
    g.position.set(0, REST_Y, 0);
    g.rotation.set(0, 0, 0);
    m.uniforms.uBend.value = 0;
    sm.uniforms.uStrength.value = 0.45;
    sh.scale.setScalar(0.95);
    heightRef.current = 0;
  });

  return (
    <group>
      <group ref={group}>
        <mesh frustumCulled={false}>
          <planeGeometry args={[PAGE_W, PAGE_H, 48, 1]} />
          <shaderMaterial
            ref={material}
            vertexShader={vertex}
            fragmentShader={fragment}
            side={THREE.DoubleSide}
            uniforms={uniforms}
          />
        </mesh>
      </group>

      {/* Sits just above the table, under the page, and never moves with it —
          a shadow stays on the surface that casts it. */}
      <mesh ref={shadow} position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PAGE_W * 1.5, PAGE_H * 1.3]} />
        <shaderMaterial
          ref={shadowMat}
          vertexShader={shadowVertex}
          fragmentShader={shadowFragment}
          uniforms={shadowUniforms}
          transparent
          depthWrite={false}
        />
      </mesh>

      <Dust active={dust} radius={PAGE_W * 0.55} />
    </group>
  );
}
