"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Folder from "./Folder";
import Leaf, { CARDS } from "./Leaf";
import { ROOM_LIGHT, type ClipTable, type RoomLight } from "./roomLight";
import {
  FOLDER_H,
  FOLDER_MARGIN,
  FOLDER_W,
  PAGE_W,
  cameraPositionFor,
  coverOpenness,
  openness,
} from "./sceneConfig";
import { HIGH_QUALITY, SceneContext, useScene, type SceneCtx, type SceneQuality } from "./sceneContext";
import { loadManifest, type PagesManifest } from "./textures";

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
 * Watches the frame rate the machine is actually holding.
 *
 * The boot script can only guess from what a browser admits to (memory, cores,
 * connection); plenty of laptops pass it and still cannot keep this scene smooth — an
 * old integrated GPU on a 4K panel, a battery saver, a dozen other tabs. So after the
 * first frame the real rate is measured in WINDOW-second windows, and two slow windows
 * in a row call `onSlow`. The shell steps the scene down first and only gives up on it
 * if the lighter scene is slow too.
 *
 * Windows are measured in SECONDS, not frames. The first version counted 120 frames per
 * window — fine at 60 fps, but at 5 fps that is 24 seconds a window, so a machine that
 * badly needed rescuing waited the better part of two minutes for it.
 *
 * Only pauses of over a second are skipped (a tab coming back, the machine waking).
 * Ordinary hitches — a texture upload, a shader recompiling after a step-down — stay in:
 * one 300 ms frame inside a two-second window barely moves the average, and skipping
 * every frame over a quarter-second (the first version) hid a machine at 3 fps entirely.
 */
/**
 * Brings the scroll position into the render loop — read fresh, first thing, every frame.
 *
 * It used to arrive the long way round: a scroll event, then framer's useScroll, then a
 * motion value on framer's NEXT frame, then a ref. Each hop is asynchronous to three's
 * own requestAnimationFrame, so on some frames the scene saw this frame's position and on
 * others the previous one — the paper moved two steps' worth, then none, then two. That
 * is what "uneven" scrolling was. Reading window.scrollY here, at priority -1 (before
 * every other useFrame in the scene), gives every frame one consistent, current value.
 */
function ScrollSync({
  posRef,
  readPos,
}: {
  posRef: React.RefObject<number>;
  readPos?: () => number;
}) {
  useFrame(() => {
    if (readPos) posRef.current = readPos();
  }, -1);
  return null;
}

const SLOW_FPS = 28;
const WINDOW = 2;
/**
 * …or this share of frames that are HITCHES (over 50 ms — three missed vsyncs, a jolt
 * anyone sees) in a window. An average hides stutter: a steady 50 fps with one frame in
 * seven stalled reads as choppy. It used to be "over 25 ms", which is not a hitch but
 * merely under 40 fps: at a smooth 37 fps every single frame counted as late, and the
 * scene was taken away from a machine running it perfectly well (DevTools open was
 * enough). Slowness only ever LIGHTENS the scene here; giving up is the shell's call.
 */
const HITCH_MS = 0.05;
const HITCH_SHARE = 0.1;

function FrameWatch({ enabled, onSlow }: { enabled: boolean; onSlow: (fps: number) => void }) {
  const acc = useRef({ n: 0, sum: 0, late: 0, slow: 0 });
  useFrame((_, dt) => {
    if (!enabled || document.hidden || dt > 1) return;
    const a = acc.current;
    a.n++;
    a.sum += dt;
    if (dt > HITCH_MS) a.late++;
    if (a.sum < WINDOW) return;
    const fps = a.n / a.sum;
    const lateShare = a.late / a.n;
    a.n = 0;
    a.sum = 0;
    a.late = 0;
    a.slow = fps < SLOW_FPS || lateShare > HITCH_SHARE ? a.slow + 1 : 0;
    if (a.slow >= 2) {
      a.slow = 0;
      onSlow(fps);
    }
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
 * The folder and the deck of cards in it, held so the deck is centred.
 *
 * The deck sits on the right half of the open folder, x ∈ [0, W] from the spine, and
 * is read one card at a time — so the group is held half a page left, always, and the
 * card being read is in the middle of the frame. (The two-page spread this used to pan
 * between is gone with the page turn.)
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
  const scene = useScene();

  return (
    <group position={[-PAGE_W / 2, 0, 0]}>
      {/* The ONLY thing the first frame waits for is the shut folder — its label is
          the one texture it needs. No page is visible on that frame, so the leaves do
          not suspend at all: each fetches a preview once the scene is up and its full
          size when the reader gets near it (Leaf.tsx, textures.ts). */}
      <Suspense fallback={null}>
        <Folder posRef={posRef} lead={lead} turns={turns} light={light} />
        <SignalReady onReady={onReady} />
      </Suspense>
      {Array.from({ length: CARDS }, (_, k) => (
        <Leaf
          key={k}
          index={k}
          manifest={scene.manifest}
          ready={scene.ready}
          full={scene.quality.full}
          onFail={scene.fail}
          posRef={posRef}
          lead={lead}
          turns={turns}
          light={light}
        />
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

/** How much smaller than the solved read scales the edition is held, so the folder's
 *  overhang stays in frame. See FloatingEdition. */
const READ_FIT = 0.955;

/**
 * How far the OPEN folder slides right, in page widths, as its cover opens.
 *
 * The page is centred on the lens, and the open cover lies to the left of the spine — so
 * the open folder as a whole sat a full half-page left of centre, its cover running off
 * the left edge of the screen and empty room on the right. Sliding the whole edition right
 * by the cover's openness balances the folder in the frame while the PAGE stays the
 * largest, most central thing on it: this is a little under a third of the way to
 * centring the folder exactly (that would be ~0.5, and push the page well off to the side).
 *
 * Capped by the frame, so a narrow window never pushes the page's edge off screen; at
 * phone-like aspects the cap is 0 and the page simply stays centred.
 */
const READ_SHIFT = 0.3;
/** The share of the frame's half-width the folder's right edge may reach. */
const READ_EDGE = 0.96;

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

  /** Half-extents of the shadow quad, in world units. What lies on the desk is the
   *  shut FOLDER, a margin bigger than a page on its three open sides. */
  const halfW = (FOLDER_W * clip.restScale * SHADOW_QUAD) / 2;
  const halfH = (FOLDER_H * clip.restScale * SHADOW_QUAD) / 2;

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
          uniform vec3 uColor;
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

            /* Plus a faint halo that is NOT displaced: the sky fills a shadow from
               every side, so there is a soft darkening hugging the paper on the
               lit edge too. It is the difference between a shadow that is a
               rectangle cut out of the light and one that is the paper sitting
               on something. */
            float ring = max(abs((vUv.x - 0.5) * 2.0), abs((vUv.y - 0.5) * 2.0)) / CORE;
            float halo = (1.0 - smoothstep(0.985, 1.0 + 0.1 * mix(1.0, 3.0, uSpread), ring)) * uStrength * 0.62;
            /* And a very tight, very dark line hugging the edge itself: the few
               millimetres where paper meets table are the darkest place on the
               whole shadow, and a shadow without that line has nothing to say the
               paper is touching anything. */
            float seam = (1.0 - smoothstep(0.995, 1.0 + 0.028, ring)) * uStrength * 0.55 * (1.0 - uSpread);
            a = max(a, max(halo, seam));

            if (a < 0.004) discard;
            gl_FragColor = vec4(uColor, a);
          }
        `,
        uniforms: {
          uStrength: { value: light.shadowStrength },
          uColor: { value: new THREE.Color(light.shadowTint) },
          uSpread: { value: 0 },
          uOffset: { value: new THREE.Vector2() },
          uPenumbra: { value: light.shadowPenumbra },
        },
        transparent: true,
        depthWrite: false,
      }),
    [light.shadowStrength, light.shadowPenumbra, light.shadowTint],
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

  useFrame((state) => {
    const g = group.current;
    const sh = shadow.current;
    if (!g || !sh) return;

    const pos = posRef.current ?? 0;
    const open = openness(pos, turns, lead);


    /* Scaled down a few percent from the solved read scales, which were fitted to a
       bare sheet: the folder's boards overhang the pages, and that kraft border is
       the point — it has to stay on screen above and below the spread. */
    // One card at a time, so always the single-page read scale.
    const readScale = READ_FIT * clip.readScaleClosed;

    const tilt = THREE.MathUtils.degToRad(clip.readTiltDeg) * open;
    const scale = THREE.MathUtils.lerp(clip.restScale, readScale, open);
    let y = THREE.MathUtils.lerp(clip.rest[1], clip.read[1], open);

    /* The sheet tilts about its CENTRE, so as it starts to lift its near edge swings
       DOWN — by half its height times sin(tilt), which for the first stretch of the
       lift is more than the centre has risen. The edge went through the table: a
       paper digging into the desk it is supposed to be leaving, and (before the
       draw-order fix) the cause of the grey band. Here the sheet is held up just far
       enough that the near edge clears the surface, for as long as the contact
       shadow exists, and the correction is faded out before it matters — the reading
       pose, which was solved against the lens, is untouched. The margin ramps in from
       zero so a sheet at rest still lies ON the table. */
    const nearDrop = (FOLDER_H / 2) * scale * Math.sin(tilt);
    const margin = 0.012 * THREE.MathUtils.smoothstep(open, 0, 0.05);
    const peel = Math.max(0, nearDrop + margin - y) * (1 - THREE.MathUtils.smoothstep(open, 0.12, 0.42));
    y += peel;

    /* READ_SHIFT, capped by how much frame there is to the right of the page. The read
       pose sits on the view axis, so the half-width of the frame at its depth is
       distance × tan(fov/2) × aspect; the folder's right edge (half a page plus the
       board's overhang, from the page centre) has to stay inside it. */
    const cam = state.camera as THREE.PerspectiveCamera;
    const depth = Math.hypot(
      cam.position.x - clip.read[0],
      cam.position.y - clip.read[1],
      cam.position.z - clip.read[2],
    );
    const halfFrame = depth * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * cam.aspect;
    const room = (halfFrame * READ_EDGE) / readScale - (PAGE_W / 2 + FOLDER_MARGIN);
    const shift = Math.min(READ_SHIFT, Math.max(room, 0)) * coverOpenness(pos, turns, lead);

    g.position.set(
      THREE.MathUtils.lerp(clip.rest[0], clip.read[0], open) + shift * scale,
      y,
      THREE.MathUtils.lerp(clip.rest[2], clip.read[2], open),
    );
    g.rotation.x = tilt;
    g.scale.setScalar(scale);

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
    // Under the shut folder's centre: the edition rests panned half a page left, and
    // the folder reaches FOLDER_W from the spine.
    sh.position.set(
      clip.rest[0] + clip.restScale * (FOLDER_W - PAGE_W) * 0.5,
      0.002,
      clip.rest[2],
    );
    sh.scale.setScalar(grow);
    sh.visible = gone < 1;

    /* A constant offset even at rest: paper has thickness, and the sliver of
       shadow it throws on its shaded edge is exactly the cue that says it is
       sitting ON something rather than printed onto it. At golden hour that
       sliver is long — the sun is 24 degrees up — so it comes from the rig. */
    const throwLen = (light.shadowRest + lift * shadowAxis.perHeight) / grow;
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
  quality = HIGH_QUALITY,
  onReady: onReadyOut,
  onFail = () => {},
  watchdog = false,
  onSlow = () => {},
  readPos,
}: {
  /** The live scroll position in steps, read straight from the page — see ScrollSync. */
  readPos?: () => number;
  /** Measure the frame rate once the scene is up. */
  watchdog?: boolean;
  /** The frame rate has stayed under SLOW_FPS. */
  onSlow?: (fps: number) => void;
  posRef: React.RefObject<number>;
  /** Steps that turn a leaf. */
  turns: number;
  /** Steps at each end that only move the camera. */
  lead: number;
  /** How much the device can take — see sceneContext.ts and the shell's tiering. */
  quality?: SceneQuality;
  /** The first frame is on screen. */
  onReady?: () => void;
  /** Something the scene cannot recover from. */
  onFail?: (reason: string) => void;
}) {
  /* One rig, matched to the one clip RoomBackdrop plays. Neither layer chooses
     it any more, so neither can disagree with the other. */
  const light = ROOM_LIGHT;

  /* Held back until the shut folder exists. The room is already on screen by now —
     painted by the boot script before React ran — so fading the canvas up over it
     is a hand-off rather than an arrival. */
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => {
    setReady(true);
    onReadyOut?.();
  }, [onReadyOut]);

  /* The page manifest is fetched straight away (the boot script has usually
     preloaded it); the pages themselves wait for `ready`. */
  const [manifest, setManifest] = useState<PagesManifest | null>(null);
  useEffect(() => {
    let live = true;
    void loadManifest().then((m) => {
      if (!live) return;
      if (m?.pages?.length) setManifest(m);
      else onFail("manifest");
    });
    return () => {
      live = false;
    };
  }, [onFail]);

  const ctx = useMemo<SceneCtx>(
    () => ({ ready, manifest, quality, fail: onFail }),
    [ready, manifest, quality, onFail],
  );

  /* A lost context means the GPU took it away — unless WE are the ones tearing the
     canvas down. R3F calls forceContextLoss() ~500 ms after the Canvas unmounts, which
     fires the same event; read as a GPU failure, merely narrowing the window (DevTools
     docked to the side) switched the scene off for the rest of the session. So the
     listener is removed the moment this component unmounts, before that timer runs. */
  const contextLost = useRef<{ el: HTMLCanvasElement; fn: () => void } | null>(null);
  useEffect(
    () => () => {
      const c = contextLost.current;
      if (c) c.el.removeEventListener("webglcontextlost", c.fn);
      contextLost.current = null;
    },
    [],
  );

  return (
    <div className={ready ? "np-canvas is-ready" : "np-canvas"}>
    <Canvas
      /* Capped at 2 on a capable machine: the pages are the expensive surface and a 3x
         device would be magnifying texture detail that does not exist in the source.
         Lower on an ordinary laptop, where fill rate is what runs out first. */
      dpr={quality.dpr}
      onCreated={({ gl }) => {
        /* A GPU reset, a driver crash, too many WebGL contexts in other tabs: the
           context can be taken away at any time, and the scene cannot draw without it. */
        const fn = () => onFail("context-lost");
        gl.domElement.addEventListener("webglcontextlost", fn, { once: true });
        contextLost.current = { el: gl.domElement, fn };
      }}
      /* Transparent, because the room is a video BEHIND this canvas rather
         than geometry inside it. Without alpha the clear colour paints over it
         and the whole backdrop disappears. */
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: light.clipTable.fov, near: 0.1, far: 200 }}
    >
      <SceneContext.Provider value={ctx}>
        <ScrollSync posRef={posRef} readPos={readPos} />
        <CameraRig clip={light.clipTable} />
        <FrameWatch enabled={watchdog && ready} onSlow={onSlow} />

        {/* No lights. Every material in this scene is a raw ShaderMaterial with
            its own lighting model fed from roomLight — scene lights would cost a
            uniform update per frame and illuminate nothing. */}

        <FloatingEdition
          posRef={posRef}
          turns={turns}
          lead={lead}
          light={light}
          clip={light.clipTable}
          onReady={onReady}
        />
      </SceneContext.Provider>
    </Canvas>
    </div>
  );
}
