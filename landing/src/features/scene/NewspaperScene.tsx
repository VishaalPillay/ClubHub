"use client";

import { Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Leaf from "./Leaf";
import { ROOM_LIGHT, type ClipTable, type RoomLight } from "./roomLight";
import { PAGE_H, PAGE_W, cameraPositionFor, openness } from "./sceneConfig";

/**
 * The 3D scene: a newspaper on a table, in a room.
 *
 * Mounted only from NewspaperShell, and only through
 * `dynamic(…, { ssr: false })` — three.js touches `window` on import and there
 * is nothing here worth prerendering. The server keeps rendering plain mode,
 * which is both the crawlable document and the fallback for every device that
 * does not get this scene.
 *
 * Scroll arrives as a REF, not a prop. The scroll position changes every frame
 * and React must not see it: the whole scene would re-render sixty times a
 * second for a value only the render loop consumes. `useFrame` reads it
 * directly, the same reason the CSS version drove everything from MotionValues.
 */

const LEAVES = 4;

/** `public/pages/01.avif` … `08.avif`, produced by `npm run pages:render`. */
const pageUrl = (page0: number) => `/pages/${String(page0 + 1).padStart(2, "0")}.avif`;



/**
 * The camera, nailed to the one solved against the clip's own table.
 *
 * It NEVER moves. The room is a video, a video has no parallax, and any camera
 * move slides the scene off the table it is meant to be resting on — which is
 * why the PAPER travels instead (see FloatingEdition). The numbers come from
 * `npm run clip:fit`; nudging them by hand puts the paper on a plane the table
 * is not on.
 */
function CameraRig({ clip }: { clip: ClipTable }) {
  useFrame((state) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    if (Math.abs(camera.fov - clip.fov) > 1e-4) {
      camera.fov = clip.fov;
      camera.updateProjectionMatrix();
    }
    camera.position.set(...cameraPositionFor(clip.distance, clip.pitch));
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/**
 * Fires once its Suspense boundary has resolved.
 *
 * Which is the only honest signal that the scene has something to show: R3F's
 * own `onCreated` fires when the renderer exists, long before any page texture
 * has decoded, and revealing on that put an empty table on screen.
 */
function SignalReady({ onReady }: { onReady: () => void }) {
  useLayoutEffect(() => onReady(), [onReady]);
  return null;
}

/**
 * The bound edition, and the pan that keeps it centred.
 *
 * An unturned leaf occupies x ∈ [0, W] and a turned one [−W, 0], so an open
 * spread straddles the spine symmetrically but a CLOSED one — the front and back
 * covers — sits a half-page off to one side. The group slides to compensate, so
 * the paper opens outward from the middle instead of the whole scene appearing
 * to drift.
 */
function Edition({
  posRef,
  turns,
  lead,
  light,
  onReady,
}: {
  posRef: React.RefObject<number>;
  turns: number;
  lead: number;
  light: RoomLight;
  onReady: () => void;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    /* Everything below is in TURN space — scroll position minus the lead-in.
       The pan tracks the paper opening, not the camera coming in, so it has to
       be measured from where the first leaf actually starts to move. */
    const t = THREE.MathUtils.clamp((posRef.current ?? 0) - lead, 0, turns);
    const half = PAGE_W / 2;

    g.position.x =
      t <= 0.5
        ? THREE.MathUtils.lerp(-half, 0, THREE.MathUtils.clamp(t / 0.5, 0, 1))
        : t >= turns - 0.5
          ? THREE.MathUtils.lerp(0, half, THREE.MathUtils.clamp((t - (turns - 0.5)) / 0.5, 0, 1))
          : 0;
  });

  return (
    <group ref={group}>
      {/* One boundary PER LEAF, not one around all four. Eight textures in a
          single boundary means nothing appears until the last of them decodes —
          and leaves 1-3 are hidden behind leaf 0 at rest anyway, so waiting on
          them delayed the only page anyone can see. */}
      {Array.from({ length: LEAVES }, (_, k) => (
        <Suspense key={k} fallback={null}>
          <Leaf
            index={k}
            frontUrl={pageUrl(k * 2)}
            backUrl={pageUrl(k * 2 + 1)}
            posRef={posRef}
            lead={lead}
            light={light}
          />
          {k === 0 && <SignalReady onReady={onReady} />}
        </Suspense>
      ))}
    </group>
  );
}


/**
 * How much bigger the shadow quad is than the paper.
 *
 * It has to hold the caster's footprint plus the whole penumbra plus however far
 * the shadow is displaced, and the shader needs the ratio to know where the
 * caster's edge falls inside it.
 */
const SHADOW_QUAD = 1.55;

/**
 * The variant used when the clip already contains the table.
 *
 * The camera is nailed down — a video has no parallax, so moving it slides the
 * scene off the very table it is meant to rest on — and the PAPER does the
 * travelling instead: it lies flat on the clip's tabletop at rest, then lifts
 * and tilts up into the lens as you scroll. That reads as picking a newspaper
 * up, which is a better mechanic than the room rushing at you, and it is also
 * the only one available here.
 *
 * The contact shadow is what actually welds the paper to the clip's table.
 * Nothing in the scene can cast onto a video, so it is drawn: tight and dark
 * while the paper is down, spreading and fading as it rises. That spread is the
 * single strongest cue that the paper has left the surface.
 */
function FloatingEdition({
  posRef,
  turns,
  lead,
  light,
  clip,
  onReady,
}: {
  posRef: React.RefObject<number>;
  turns: number;
  lead: number;
  light: RoomLight;
  clip: ClipTable;
  onReady: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);

  /** Half-extents of the shadow quad, in world units. */
  const halfW = (PAGE_W * clip.restScale * SHADOW_QUAD) / 2;
  const halfH = (PAGE_H * clip.restScale * SHADOW_QUAD) / 2;

  const shadowMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          precision highp float;
          uniform float uStrength;
          uniform float uSpread;
          uniform vec2 uOffset;
          uniform float uPenumbra;
          varying vec2 vUv;

          /** The caster's half-extent, as a fraction of this quad's. */
          const float CORE = ${(1 / SHADOW_QUAD).toFixed(4)};

          void main() {
            /* A BOX falloff, not a radial one: the caster is a rectangle, and a
               radial gradient on a rectangle leaves its opaque core inside the
               paper's own footprint — the shadow ends up drawn entirely
               underneath and none of it is ever visible.

               DISPLACED, not centred. A shadow centred under its caster is what
               you get from a light directly overhead, and neither clip has one:
               the sun comes through a window off to one side, so the paper's
               shadow belongs down and to the left and there should be nothing at
               all on the lit edge. That asymmetry is most of what sells the
               paper as being IN the room rather than pasted onto it. */
            vec2 p = (vUv - 0.5) * 2.0 - uOffset;
            float box = max(abs(p.x), abs(p.y)) / CORE;

            // The penumbra widens as the caster lifts away, as a real one does.
            float pen = uPenumbra * mix(1.0, 7.0, uSpread);
            float a = (1.0 - smoothstep(1.0, 1.0 + pen, box)) * uStrength;
            if (a < 0.004) discard;
            gl_FragColor = vec4(0.0, 0.0, 0.0, a);
          }
        `,
        uniforms: {
          uStrength: { value: light.shadowStrength },
          uSpread: { value: 0 },
          uOffset: { value: new THREE.Vector2() },
          uPenumbra: { value: light.shadowPenumbra },
        },
        transparent: true,
        depthWrite: false,
      }),
    [light.shadowStrength, light.shadowPenumbra],
  );

  useLayoutEffect(() => () => shadowMaterial.dispose(), [shadowMaterial]);

  /**
   * Where the shadow falls, and how far.
   *
   * Direction is the light's horizontal bearing, reversed. Length is the
   * caster's height over the tangent of the light's elevation — real shadow
   * geometry, halved, because a physically exact one at full lift is off frame
   * long before it has faded and reads as a separate object rather than as this
   * page's shadow.
   *
   * The quad's local +y maps to world -z once it is laid flat, hence the sign
   * flip on the second component.
   */
  const shadowAxis = useMemo(() => {
    const [lx, ly, lz] = light.dir;
    const horiz = Math.hypot(lx, lz) || 1e-6;
    return {
      u: -lx / horiz,
      v: lz / horiz,
      perHeight: (horiz / Math.max(ly, 1e-6)) * 0.5,
    };
  }, [light.dir]);

  useFrame(() => {
    const g = group.current;
    const sh = shadow.current;
    if (!g || !sh) return;

    const pos = posRef.current ?? 0;
    const open = openness(pos, turns, lead);

    /* A spread is twice the width of a closed cover, so a single read scale
       would either shrink the front page or run the spread off the sides. */
    const spread = THREE.MathUtils.clamp(pos - lead, 0, 1);
    const readScale = THREE.MathUtils.lerp(clip.readScaleClosed, clip.readScaleOpen, spread);

    g.position.set(
      THREE.MathUtils.lerp(clip.rest[0], clip.read[0], open),
      THREE.MathUtils.lerp(clip.rest[1], clip.read[1], open),
      THREE.MathUtils.lerp(clip.rest[2], clip.read[2], open),
    );
    g.rotation.x = THREE.MathUtils.degToRad(clip.readTiltDeg) * open;
    g.scale.setScalar(THREE.MathUtils.lerp(clip.restScale, readScale, open));

    /**
     * The shadow's whole life happens in the first part of the lift.
     *
     * It is a flat quad lying on the table, and it belongs to the paper only
     * while the paper is ON the table. Carried the full length of the travel it
     * behaves exactly like what it is: a big dark slab left lying in the room,
     * spreading to two and a half times the table's own size and still a third
     * as dark by the time the page is up against the lens. That reads as the
     * shadow following the paper to camera, because nothing else in frame is
     * moving.
     *
     * So it blurs out and is gone while the page is barely off the table
     * — which is also what a real one does, just faster: a shadow softens and
     * weakens as its caster leaves the surface, and this one has the good taste
     * to finish the job before anyone can look at it.
     */
    const gone = THREE.MathUtils.smoothstep(open, 0, 0.18);
    const lift = g.position.y;

    /* The quad stays put under where the paper rested; the DISPLACEMENT is done
       in the shader, so the shadow can slide within it without the geometry
       having to chase the caster around. Growth is capped for the same reason
       the fade is: past this it stops being a contact shadow and starts being a
       rectangle on the floor. */
    const grow = 1 + gone * 0.85;
    sh.position.set(clip.rest[0], 0.002, clip.rest[2]);
    sh.scale.setScalar(grow);
    sh.visible = gone < 1;

    /* A small constant offset even at rest: paper has thickness, and the sliver
       of shadow it throws on its shaded edge is exactly the cue that says it is
       sitting ON something rather than printed onto it. */
    const throwLen = (0.05 + lift * shadowAxis.perHeight) / grow;
    const m = sh.material as THREE.ShaderMaterial;
    m.uniforms.uOffset.value.set(
      (shadowAxis.u * throwLen) / halfW,
      (shadowAxis.v * throwLen) / halfH,
    );
    m.uniforms.uStrength.value = light.shadowStrength * (1 - gone);
    m.uniforms.uSpread.value = gone;
  });

  return (
    <group>
      <mesh
        ref={shadow}
        rotation={[-Math.PI / 2, 0, 0]}
        material={shadowMaterial}
        renderOrder={-1}
      >
        <planeGeometry args={[halfW * 2, halfH * 2]} />
      </mesh>

      <group ref={group}>
        <Edition posRef={posRef} turns={turns} lead={lead} light={light} onReady={onReady} />
      </group>
    </group>
  );
}

export default function NewspaperScene({
  posRef,
  turns,
  lead,
}: {
  posRef: React.RefObject<number>;
  /** Steps that turn a leaf. */
  turns: number;
  /** Steps at each end that only move the camera. */
  lead: number;
}) {
  /* One rig, matched to the one clip RoomBackdrop plays. Neither layer chooses
     it any more, so neither can disagree with the other. */
  const light = ROOM_LIGHT;

  /* Held back until the front page exists. The room is already on screen by
     now — painted by the boot script before React ran — so fading the canvas up
     over it is a hand-off rather than an arrival. */
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  return (
    <div className={ready ? "np-canvas is-ready" : "np-canvas"}>
    <Canvas
      /* Capped at 2: the pages are the expensive surface and a 3x device would
         be magnifying texture detail that does not exist in the source. */
      dpr={[1, 2]}
      /* Transparent, because the room is a video BEHIND this canvas rather
         than geometry inside it. Without alpha the clear colour paints over it
         and the whole backdrop disappears. */
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: light.clipTable.fov, near: 0.1, far: 200 }}
    >
      <CameraRig clip={light.clipTable} />

      {/* No lights. Every material in this scene is a raw ShaderMaterial with
          its own lighting model fed from roomLight — scene lights would cost a
          uniform update per frame and illuminate nothing. */}

      {/* Suspense lives per leaf, inside Edition. */}
      <FloatingEdition
        posRef={posRef}
        turns={turns}
        lead={lead}
        light={light}
        clip={light.clipTable}
        onReady={onReady}
      />
    </Canvas>
    </div>
  );
}
