import * as THREE from "three";

/**
 * Everything the 3D scene downloads after its first frame, and how.
 *
 * ── Why nothing here suspends ────────────────────────────────────────────────
 * The first frame is the SHUT folder: no page is visible, so no page texture is
 * needed to show it. Only the folder's label blocks readiness (see Folder.tsx).
 * Pages arrive afterwards, in two steps per page — a ~20 KB preview for every page
 * as soon as the scene is up, then the full texture for the pages near where the
 * reader is (Leaf.tsx). Everything is loaded imperatively and swapped into a
 * uniform when it lands, so a slow file delays a page's sharpness, never the scene.
 *
 * ── Decoded off the main thread ──────────────────────────────────────────────
 * A 1722x2376 AVIF decoded on the main thread is a visible hitch in the middle of a
 * scroll. `createImageBitmap` decodes on a worker; only the GPU upload is left on
 * the main thread. The bitmap is decoded already flipped, so the texture is not.
 * Browsers without it get the ordinary TextureLoader.
 */

/** Where a page's three sizes are: see render-pages.mjs. */
export interface PageFiles {
  l: string;
  m: string;
  s: string;
}

export interface PagesManifest {
  /** The "Available at" window on page 1, as fractions of the sheet. */
  colleges: { x: number; y: number; w: number; h: number } | null;
  pages: PageFiles[];
}

let manifest: Promise<PagesManifest | null> | null = null;

/** /pages/meta.json, fetched once. It is the only unhashed file the scene needs. */
export function loadManifest(): Promise<PagesManifest | null> {
  manifest ??= fetch("/pages/meta.json")
    .then((r) => (r.ok ? (r.json() as Promise<PagesManifest>) : null))
    .catch(() => null);
  return manifest;
}

const bitmapOk =
  typeof createImageBitmap === "function" && typeof THREE.ImageBitmapLoader === "function";

const bitmapLoader = bitmapOk
  ? new THREE.ImageBitmapLoader().setOptions({ imageOrientation: "flipY" })
  : null;
const plainLoader = new THREE.TextureLoader();

/** One texture, configured for the scene: sRGB, mipmapped, anisotropic. */
export function loadTexture(url: string, anisotropy = 8): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const finish = (t: THREE.Texture) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = anisotropy;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      t.needsUpdate = true;
      resolve(t);
    };
    if (bitmapLoader) {
      bitmapLoader.load(
        url,
        (bitmap) => {
          const t = new THREE.Texture(bitmap as ImageBitmap);
          t.flipY = false; // decoded flipped already
          finish(t);
        },
        undefined,
        reject,
      );
    } else {
      plainLoader.load(url, finish, undefined, reject);
    }
  });
}

/** Free a texture and, if it owns one, the decoded bitmap behind it. */
export function disposeTexture(t: THREE.Texture | null | undefined) {
  if (!t) return;
  const img = t.image as { close?: () => void } | undefined;
  t.dispose();
  img?.close?.();
}
