/**
 * The desk SURFACE — one place to point at the photography if it ever lands in
 * `landing/public/desk/`.
 *
 * Everything here is OPTIONAL on purpose. With `plate` unset the stage falls
 * back to a procedural wood surface, which is what ships today and what the
 * whole scene is lit and coloured for.
 *
 * What used to live alongside this — a `DESK_PROPS` manifest of cut-out PNGs,
 * on the argument that "a CSS-drawn mug reads as clipart next to a photographic
 * desk" — is gone. The photographic desk never arrived, so the premise never
 * held, and the objects are now drawn (see deskObjects.ts) in a register that
 * belongs to a newspaper: engraved ink on newsprint. If a real plate is ever
 * dropped in here, that decision is worth revisiting as a pair — swapping one
 * without the other is what the original warning was actually about.
 */

export const DESK = {
  /** Landscape desk photo, ≥ 2400px wide, centre ~55% clear. */
  plate: undefined as string | undefined,
  /** Portrait crop for < 1024px. Not a downscale — a different framing. */
  platePortrait: undefined as string | undefined,
  /** Mean colour of the plate. Painted immediately so first paint is desk-toned
   *  rather than white, and it fills the `100lvh − 100svh` sliver on mobile. */
  base: "#6b4a2f",
  /** Tiny inline blur placeholder; swap for a real one when the plate lands. */
  blurDataURL:
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjMiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjMiIGZpbGw9IiM2YjRhMmYiLz48L3N2Zz4=",
};
