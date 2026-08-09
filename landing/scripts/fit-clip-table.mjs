/**
 * Solves the camera that lays the scene's y = 0 plane onto the table in a clip.
 *
 *   npm run clip:fit -- <phase> [aspect]      aspect defaults to 0.58
 *
 * Only needed for clips that contain their own table. Measure the tabletop's
 * four corners in a frame, add them to TARGETS below, and read the camera off
 * the chosen row into `clipTable` in timeOfDay.ts. Keeping the measurements here
 * rather than passing them on the command line means the numbers behind every
 * camera in the scene stay written down.
 *
 * ── The degeneracy, and why this sweeps ──────────────────────────────────────
 * A single image of a rectangle does NOT determine the camera. The trapezoid
 * fixes the horizon, but pitch and focal length then trade against each other
 * along a whole family of solutions that all reproduce the same four corners to
 * within a pixel. Fitting them freely picks an arbitrary member of that family —
 * the first pass here landed on one implying a table only 0.29 as deep as it is
 * wide, which put the newspaper's own depth at twice the table's.
 *
 * The extra constraint has to come from outside the image: the table's real
 * aspect. So this sweeps plausible aspects and reports the camera each implies,
 * along with whether a page actually fits on the result. Pick the row where the
 * residual is still small AND the paper sits on the table.
 */
import * as THREE from "three";

const W = 1280, H = 720;

/**
 * Measured tabletop corners, per clip: far-left, far-right, near-right,
 * near-left, in source pixels.
 *
 * Both clips film the SAME physical table from different framings, which is why
 * they share an aspect below. If a future clip shows a different table, that
 * assumption goes with it.
 */
const TARGETS = {
  night: [
    [405, 393],
    [867, 393],
    [885, 504],
    [373, 504],
  ],
  morning: [
    [412, 329],
    [860, 329],
    [893, 470],
    [378, 470],
  ],
};

const phase = process.argv[2] ?? "night";
const TARGET = TARGETS[phase];
if (!TARGET) {
  console.error(`Unknown phase "${phase}". Known: ${Object.keys(TARGETS).join(", ")}`);
  process.exit(1);
}
console.log(`\n  fitting: ${phase}`);

/** Fixes the scale of the world. Distance would otherwise trade against it. */
const A = 1.2;

const PAGE_W = 1, PAGE_H = 1.38;

const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 200);
const v = new THREE.Vector3();
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

function project(pts, [pitch, fov, dist, cx, cz], b) {
  cam.fov = fov;
  const r = (pitch * Math.PI) / 180;
  cam.position.set(0, dist * Math.sin(r), dist * Math.cos(r));
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return pts.map(([sx, sz]) => {
    v.set(cx + sx * A, 0, cz + sz * b).project(cam);
    return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H];
  });
}

function solve(b) {
  const cost = (par) => {
    const [pitch, fov, dist] = par;
    if (pitch < 4 || pitch > 85 || fov < 8 || fov > 75 || dist < 0.4) return 1e9;
    const got = project(CORNERS, par, b);
    let e = 0;
    for (let i = 0; i < 4; i++)
      e += (got[i][0] - TARGET[i][0]) ** 2 + (got[i][1] - TARGET[i][1]) ** 2;
    return e;
  };

  let best = null;
  // Restarts, because the surface has a long shallow valley along the
  // pitch/fov trade and a single descent stalls partway down it.
  for (const p0 of [15, 25, 35, 45, 55]) {
    let par = [p0, 30, 5, 0, 0];
    let step = [6, 6, 1.5, 0.5, 0.5];
    for (let pass = 0; pass < 600; pass++) {
      let improved = false;
      for (let i = 0; i < par.length; i++)
        for (const d of [1, -1]) {
          const t = par.slice();
          t[i] += d * step[i];
          if (cost(t) < cost(par)) { par = t; improved = true; }
        }
      if (!improved) step = step.map((s) => s * 0.72);
      if (step[0] < 1e-5) break;
    }
    if (!best || cost(par) < cost(best)) best = par;
  }
  return { par: best, rms: Math.sqrt(cost(best) / 4) };
}

console.log(
  "\n  aspect  pitch    fov     dist   rms      page vs table depth   page % of width",
);
for (const aspect of [0.30, 0.38, 0.45, 0.52, 0.58, 0.65, 0.72]) {
  const b = A * aspect;
  const { par, rms } = solve(b);
  const [pitch, fov, dist] = par;
  // Largest page scale that still fits the table's depth, with a little margin.
  const fit = (b * 2 * 0.92) / PAGE_H;
  console.log(
    `  ${aspect.toFixed(2)}    ${pitch.toFixed(1).padStart(5)}  ${fov.toFixed(1).padStart(5)}  ` +
      `${dist.toFixed(2).padStart(6)}  ${rms.toFixed(2).padStart(6)}px   ` +
      `${(PAGE_H * fit).toFixed(2)} / ${(b * 2).toFixed(2)}          ` +
      `${((PAGE_W * fit) / (A * 2) * 100).toFixed(0)}%   (scale ${fit.toFixed(2)})`,
  );
}
console.log("\n  centre offsets are re-solved per row; read them from the chosen aspect below.\n");

const chosen = Number(process.argv[3] ?? 0.58);
const b = A * chosen;
const { par, rms } = solve(b);
console.log(`  chosen aspect ${chosen}`);
console.log("    pitch    ", par[0].toFixed(2));
console.log("    fov      ", par[1].toFixed(2));
console.log("    distance ", par[2].toFixed(3));
console.log("    centre   ", par[3].toFixed(3), par[4].toFixed(3));
console.log("    rms      ", rms.toFixed(2), "px");
const got = project(CORNERS, par, b);
for (let i = 0; i < 4; i++)
  console.log(`    corner ${i}  want ${TARGET[i].join(",")}  got ${got[i].map((n) => n.toFixed(1)).join(",")}`);
