"use client";

import { Suspense, useLayoutEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Backdrop from "./Backdrop";
import Drop from "./Drop";
import Leaf from "./Leaf";
import Table from "./Table";
import {
  CAMERA_FOV,
  PAGE_W,
  SPREAD_CORNERS,
  SPREAD_FRAME_FILL,
  TABLE_CORNERS,
  cameraPositionFor,
} from "./sceneConfig";

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
 * Solves camera distance and look-target for a set of corners on the table.
 *
 * Iterative rather than closed form, because a sheet lying flat projects to a
 * shape no simple formula describes: the near edge is closer to the lens and so
 * magnified, and the resulting trapezoid is asymmetric about the frame centre.
 * Projecting the corners and shrinking to fit handles that exactly. It also
 * re-centres vertically — without the shift the trapezoid sits low and the folio
 * along the bottom of the page runs off the screen.
 */
function solveFit(camera: THREE.PerspectiveCamera, corners: readonly [number, number, number][]) {
  const pts = corners.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const probe = new THREE.Vector3();

  let distance = 4;
  let lookZ = 0;

  for (let i = 0; i < 20; i++) {
    camera.position.set(...cameraPositionFor(distance));
    camera.lookAt(0, 0, lookZ);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      probe.copy(p).project(camera);
      minX = Math.min(minX, probe.x);
      maxX = Math.max(maxX, probe.x);
      minY = Math.min(minY, probe.y);
      maxY = Math.max(maxY, probe.y);
    }

    const centreY = (minY + maxY) / 2;
    const fill = Math.max((maxX - minX) / 2, (maxY - minY) / 2) / SPREAD_FRAME_FILL;

    if (Math.abs(fill - 1) < 0.004 && Math.abs(centreY) < 0.004) break;

    distance *= fill;
    // Positive NDC y is up, and pushing the look target toward the far edge of
    // the table moves the image up the screen.
    lookZ -= centreY * 0.5;
  }

  return { distance, lookZ };
}

/**
 * Frames the paper, and pulls back for the drop.
 *
 * Much simpler than the version that chased a thrown bundle around the table:
 * the page now falls straight down onto the middle, so there is nothing to
 * track laterally. The camera only has to be wide enough to hold the sheet while
 * it is still high, and it closes in as it comes down — driven by the sheet's
 * own height, so the move cannot drift out of step with the fall.
 */
function CameraRig({
  posRef,
  steps,
  delivery,
  dropHeightRef,
}: {
  posRef: React.RefObject<number>;
  steps: number;
  delivery: boolean;
  dropHeightRef: React.RefObject<number>;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  const fits = useRef({ closed: { distance: 4, lookZ: 0 }, open: { distance: 5, lookZ: 0 } });

  useLayoutEffect(() => {
    if (!height) return;
    fits.current = {
      // Closed = the whole table, so the scene establishes itself. Open = the
      // spread, pushing in to read. See TABLE_CORNERS.
      closed: solveFit(camera, TABLE_CORNERS),
      open: solveFit(camera, SPREAD_CORNERS),
    };
  }, [camera, width, height]);

  useFrame(() => {
    const { closed, open: wide } = fits.current;

    if (delivery) {
      const h = Math.max(dropHeightRef.current ?? 0, 0);
      // Wide while the sheet is still up, tightening onto the page as it lands.
      const widen = Math.min(2.4, h * 0.8);
      camera.position.set(...cameraPositionFor(closed.distance + widen));
      // Tilt up toward the falling sheet so it stays in frame on the way down.
      camera.lookAt(0, h * 0.3, closed.lookZ);
      return;
    }

    const pos = posRef.current ?? 0;

    /* How open the paper is, on the same curve as the spread's pan: shut on
       either cover, open everywhere between. The camera pulls back as it opens,
       so the front page fills the frame and the spread still fits. */
    const open = THREE.MathUtils.clamp(Math.min(pos / 0.5, (steps - pos) / 0.5), 0, 1);

    camera.position.set(
      ...cameraPositionFor(THREE.MathUtils.lerp(closed.distance, wide.distance, open)),
    );
    camera.lookAt(0, 0, THREE.MathUtils.lerp(closed.lookZ, wide.lookZ, open));
  });

  return null;
}

/**
 * Hides a subtree without letting its shaders go uncompiled.
 *
 * This exists because of a real, visible bug. three skips invisible objects
 * entirely, so a plain `visible={false}` means the leaf shader is not compiled
 * until the frame it first appears — and the frame the delivery hands over is
 * exactly that frame. Compiling a program mid-flight stalls the GPU for long
 * enough to drop frames, which showed up as a stutter and a flash of banding
 * across the paper.
 *
 * So: make it visible, force a compile, hide it again, all before first paint.
 * `gl.compile` walks only VISIBLE objects, which is the whole reason for the
 * dance rather than simply calling it on the hidden group.
 */
function Precompile({ hidden, children }: { hidden: boolean; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const done = useRef(false);

  useLayoutEffect(() => {
    const g = group.current;
    if (!g || done.current) return;
    done.current = true;
    const was = g.visible;
    g.visible = true;
    gl.compile(scene, camera);
    g.visible = was;
  }, [gl, scene, camera]);

  return (
    <group ref={group} visible={!hidden}>
      {children}
    </group>
  );
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
function Edition({ posRef, steps }: { posRef: React.RefObject<number>; steps: number }) {
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const pos = posRef.current ?? 0;
    const half = PAGE_W / 2;

    g.position.x =
      pos <= 0.5
        ? THREE.MathUtils.lerp(-half, 0, THREE.MathUtils.clamp(pos / 0.5, 0, 1))
        : pos >= steps - 0.5
          ? THREE.MathUtils.lerp(0, half, THREE.MathUtils.clamp((pos - (steps - 0.5)) / 0.5, 0, 1))
          : 0;
  });

  return (
    <group ref={group}>
      {Array.from({ length: LEAVES }, (_, k) => (
        <Leaf
          key={k}
          index={k}
          frontUrl={pageUrl(k * 2)}
          backUrl={pageUrl(k * 2 + 1)}
          posRef={posRef}
        />
      ))}
    </group>
  );
}

export default function NewspaperScene({
  posRef,
  steps,
  delivery,
  onDeliveryLanded,
  onDeliveryDone,
}: {
  posRef: React.RefObject<number>;
  steps: number;
  /** True while the delivery animation is still on screen. */
  delivery: boolean;
  onDeliveryLanded: () => void;
  onDeliveryDone: () => void;
}) {
  /** The falling sheet's height above the table, for the camera. */
  const dropHeight = useRef(0);

  return (
    <Canvas
      className="np-canvas"
      /* Capped at 2: the pages are the expensive surface and a 3x device would
         be magnifying texture detail that does not exist in the source. */
      dpr={[1, 2]}
      gl={{ antialias: true }}
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 200 }}
    >
      <CameraRig posRef={posRef} steps={steps} delivery={delivery} dropHeightRef={dropHeight} />

      {/* Lit from the upper left at a shallow angle, matching the fall the table
          shader bakes in and the direction the leaf shader shades against. */}
      <ambientLight intensity={1.05} />
      <directionalLight position={[-3, 5, 2.5]} intensity={1.4} />

      <Backdrop />
      <Table />

      {/* The table paints immediately; the pages stream in behind it. Without
          the boundary the whole canvas would stay blank until eight textures
          had decoded.

          The edition stays MOUNTED through the delivery rather than being
          swapped in at the end — it is only hidden. Mounting it late would put
          eight texture decodes on the exact frame the paper settles, which is
          the one frame in the sequence that must not stutter. */}
      <Suspense fallback={null}>
        <Precompile hidden={delivery}>
          <Edition posRef={posRef} steps={steps} />
        </Precompile>
      </Suspense>

      {delivery && (
        <Suspense fallback={null}>
          <Drop
            onLanded={onDeliveryLanded}
            onDone={onDeliveryDone}
            heightRef={dropHeight}
          />
        </Suspense>
      )}
    </Canvas>
  );
}
