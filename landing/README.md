# ClubHub — Landing Site

The public marketing page: a newspaper lying on a developer's desk, eight pages, deep-linkable.
It is a **separate Next.js project** from `frontend/`, statically exported and hosted on
Cloudflare Pages at the apex domain.

```bash
npm install
npm run dev      # http://localhost:3001  (frontend/ runs on 3000, so both fit side by side)
npm run build    # -> out/   (fully static, no Node server)
npm run lint
```

## Why it is separate

The landing page has **no** dependency on the application: no API calls, no auth, no TanStack
Query, no `lib/`, no shared components. It imports `next/image`, `react`, `framer-motion`, and
its own files. Splitting it out buys three things:

1. **It stays up when the app doesn't.** The app and API share one droplet. The marketing site
   is on Cloudflare's CDN with unlimited free bandwidth, so an outage — or a redeploy — never
   takes down the front door.
2. **It ships less.** Inside `frontend/`, the root layout wrapped every route in `QueryProvider`
   and loaded the Material Symbols stylesheet. The landing used neither, but paid for both on
   its LCP path. Here it carries no client provider and no render-blocking font request.
3. **It is fully static.** `frontend/` can't be: `/c/[clubId]` is a dynamic segment with no
   `generateStaticParams`, so the app needs a Node server. This project has one route.

## The CSS contract with `frontend/` — read before you "fix" the duplication

`src/features/newspaper/newspaper.css` moved here **verbatim**, and it consumes seven custom
properties it does not define:

| Token | Defined in |
|---|---|
| `--font-display`, `--font-body`, `--font-ui`, `--font-mono` | `src/app/globals.css` (fed by `next/font` variables set in `layout.tsx`) |
| `--color-black`, `--color-white`, `--color-link-blue` | `src/app/globals.css` |

In the app these come from Tailwind v4's `@theme` block. Here they are plain custom properties,
because **the landing uses zero Tailwind utility classes** — every selector is `.np-*` — so this
project carries no Tailwind, PostCSS, or config for it.

### `--color-white` is the one token that deliberately does NOT match the app

The app took its canvas from this project: `frontend/`'s `--color-paper` is this file's
`--np-paper` (`#f5f2ec`), and every white surface in the application is now that beige. As part of
that, `frontend/`'s `--color-white` was retired to a deprecated alias pointing at the same beige.

**Here it stays `#ffffff`, and it must.** Its sole consumer is `.np-scope { background }` — the
backdrop *behind* the sheets in plain mode. That is the desk the paper lies on, not the paper;
painting it `--np-paper` would flatten the sheet into its own background and lose the border-and-
edge reading that makes plain mode legible at all. The two projects disagree on this one value on
purpose. Everything else in the table is still a hand-sync.

**The cascade-layer order is load-bearing.** `globals.css` opens with:

```css
@layer theme, base, components, utilities;
```

`newspaper.css` puts all of its rules in `@layer components` *specifically* so they beat the
base reset's `a { text-decoration: underline }` and `*:focus { outline: none }` **without
`!important`**. Move the reset out of `@layer base`, or drop the order declaration, and links
across all eight pages pick up double underlines and focus rings reappear. It builds fine
either way — the failure is purely visual, which is what makes it easy to miss.

To verify after touching any CSS, check a link's computed style in the **production** build
(`npm run build && npx serve out`), not just dev — the bundler splits layer statements across
chunks differently in each:

```bash
node -e "1" # then in the browser console:
# getComputedStyle(document.querySelector('.np-cta')).textDecorationLine  -> "none"
```

The duplication between this file's tokens and `frontend/src/app/globals.css` is **deliberate**.
Do not resolve it by importing across projects — that would recouple two deployments that are
separate on purpose, and Cloudflare Pages builds only this directory.

### The wordmark is a third hand-synced pair — but a generated one

`src/features/newspaper/wordmarkPaths.ts` and
`frontend/src/components/ui/wordmarkPaths.ts` are **byte-identical generated files**, and
`Wordmark.tsx` exists in both projects against the same geometry (`.np-wordmark*` here,
`.wired-wordmark*` there). Do not hand-edit either copy — regenerate both together:

```bash
npm i --no-save potrace                 # one-off; deliberately not a project dependency
node ../scripts/gen-wordmark.mjs        # from this directory — sharp resolves out of landing/
```

The mark is **supplied artwork**, traced: `scripts/assets/wordmark-master.png` is the source of
truth, and the letters, their angles, the scraps they are pasted on and the drop shadows under them
all come out of it. This used to *compose* the mark instead — four display webfonts fetched from
Google at generation time, one glyph outlined from each, tilted and dropped onto scraps by hand —
which is why no `Alfa Slab One` / `Bevan` / `Playfair Display` / `Special Elite` appears in either
`layout.tsx`. Nothing about that changed: outlines, not text, so the nameplate cannot reflow or
flash mid-load, and it survives `pages:render` at print resolution where a bitmap sized for a 240px
navbar would fall apart.

**It traces as two layers, not one path with holes.** `WORDMARK_TILES` is every scrap as a solid
silhouette, letters filled in; `WORDMARK_LETTERS` is drawn on top. Holes would be less path data,
but the letters would then be whatever is behind the mark, and `invert` — which the controls bar
and the app's ink footers both need — would have nothing to flip.

**The two colours are set inline by the component, and that is deliberate.** They used to live in
`newspaper.css` as `--wm-ink` / `--wm-knock`. When that stylesheet is missing or merely stale — a
dev server that has not picked the file up yet is enough — both paths fall back to the SVG default
of black, the letters vanish into their own scraps, and the mark renders as a row of black slabs
with only the fragments of letter that overhang a tile still visible. A logo should not have that
dependency. The `var()` in the component keeps `--np-ink` in charge where it resolves; the literal
beside it is what the mark falls back to when nothing does. What is left in the stylesheet is
`display`/`width`/`height`.

There is **no hover animation**, and no `uid` prop. The mark used to crumple on pointer entry — an
SVG turbulence filter warping the paper while a CSS keyframe balled it up — which is why every call
site had to pass a page-unique id: SVG ids are global, and two marks sharing a filter id would
crumple together. With the filter gone there are no ids in the markup at all, so the prop went with
it. `Wordmark` is still a server component, so its ~9KB of path data never reaches the client
bundle.

**After changing the wordmark, re-run `npm run build && npm run pages:render`.** The nameplate is
baked into `public/pages/*.avif` — and `pages:render` photographs `out/`, not the dev server, so
without the build first it re-bakes the *previous* mark. Paper mode then keeps showing it, a silent
staleness that only appears in 3D mode.

One trap when regenerating, because it fails silently and looks like a bad trace rather than a bad
parse: potrace writes runs of curves as **one `C` followed by six numbers per segment**. The
remapper in `gen-wordmark.mjs` therefore keeps consuming coordinate groups until it sees the next
command letter. Read one group per letter instead and every coordinate after the first run lands in
the wrong axis — the mark renders as a shredded smear.

### The browser icons are a generated pair as well

`src/app/{favicon.ico,icon.png,apple-icon.png}` are **not hand-made and not landing-specific** —
they are cut from `scripts/assets/favicon-master.png` at the repo root and written into this
project and `frontend/` together:

```bash
node ../scripts/gen-favicon.mjs        # from this directory; sharp is resolved out of landing/
```

Next's metadata file convention finds them by filename and emits the `<link>` tags, so `layout.tsx`
has no icon markup to keep in step.

The tab icon is a **disc** — the artwork is a torn sheet with collage crowding all four corners,
and those corners are both the least legible part at tab size and the part that makes the icon read
as a rectangle competing with the tab's own edges. `apple-icon.png` is the one square left, on
purpose: iOS composites a transparent apple-touch-icon onto black and then applies its own squircle
mask. The `.ico` carries **six** entries (16/20/24/32/48/64) because Windows renders a 16 CSS px
favicon at 20 device px at 125% scaling and 24 at 150%, and rescaling a 16 or a 32 to reach them is
exactly what a slightly soft, slightly grey favicon looks like.

Two traps, both of which cost a build:

- **`public/favicon.ico` must not come back.** A public file and an app file at the same route
  conflict and Next refuses to build. The old default icon was deleted for this reason.
- **The PNGs inside the `.ico` must be RGBA.** Next decodes the file to write its `sizes`
  attribute and fails with *"The PNG is not in RGBA format!"* — naming no file — on a
  three-channel payload. `render()` calls `ensureAlpha()` after flattening for exactly this.

## The scroll contract — Lenis owns the scroll position

Paper mode runs [Lenis](https://github.com/darkroomengineering/lenis) in its **native-scroll** mode
(`src/features/newspaper/useLenis.ts`): it intercepts the wheel, applies a lerp, and writes the
result to the real `scrollTop`. That choice is load-bearing. `.np-stage` is `position: sticky`,
which a transform-based smooth-scroll breaks outright, and because true scroll position still moves,
framer's `useScroll` — and therefore `pos` and everything derived from it — needs
no changes at all.

Three things follow, and all three are already done. Undoing any of them re-breaks the scroll:

- **No CSS `scroll-snap`.** A snap engine and a lerp both writing the same `scrollTop` judder at
  every page boundary. Its replacement is the debounced settle in `useLenis.ts`, which rounds `pos`
  to the nearest page once the reader stops pushing. That is strictly more correct than
  `proximity` snap ever was: at `pos 3.5` the sheet is edge-on, so there is no readable state
  between pages and the only real question was *when* to land.
- **No `scroll-behavior: smooth`.** Native smooth scrolling fights Lenis for the same property.
  Programmatic jumps go through `lenis.scrollTo`, via `goTo()` in `NewspaperShell`.
- **`html.lenis { height: auto }` lives in `src/app/globals.css`**, hand-written into `@layer base`
  rather than importing `lenis/dist/lenis.css` — that stylesheet is unlayered and would outrank
  every layered rule in this project.

Lenis is **never constructed in plain mode**, which is where reduced-motion, print and no-JS all
land. If you are debugging and the paper will not scrub, check `requestAnimationFrame` first:
Lenis advances only from `lenis.raf()`, which is driven from framer's own frame loop, and a hidden
or non-compositing tab freezes that loop completely — along with every motion-driven inline style,
including the stack pan below. A headless or backgrounded tab will report `transform: none` on
`.np-stack` for exactly this reason and nothing is wrong.

## Pages, leaves and spreads — read this before touching the geometry

**A sheet is a physical leaf and carries two pages, one per side.** Leaf `k` prints page `2k` on the
front and page `2k+1` on the back, so eight pages bind into four leaves. Turning a leaf reveals its
own other side — which is what a newspaper does, and why the verso is real copy rather than the
faked show-through it used to hold. `edition.ts` owns the pagination and its helpers
(`sheetForPage`, `spreadForPage`, `rectoForSpread`).

An unturned leaf rests **centred**, with the binding at its own left edge (`transform-origin: 0
50%`), so a turned leaf swings across and lands flush against it. The open pair straddles that
binding:

| Leaves turned | Left leaf | Right leaf |
|---|---|---|
| 0 | — | page 1 (closed, front cover) |
| 1 | page 2 | page 3 |
| 2 | page 4 | page 5 |
| 3 | page 6 | page 7 |
| 4 | page 8 | — (closed, back cover) |

Because the pair straddles the binding, the pair is off-centre by half a page even though a single
leaf is not. `NewspaperShell` therefore pans `.np-stack` right by half a page while the paper is
open and a full page at the very end. **Zero is both the starting value of that pan and the safe
one**: if `pageW` has not been measured the pan collapses and you get a single centred page, not a
page shoved off the edge. Do not "simplify" this by putting the spine at 50% — that inverts the
failure mode.

### Two layouts, one mechanic

| | Wide (≥1024px) | Narrow |
|---|---|---|
| Shows | Both leaves of the open pair | One page |
| One step is | One spread | One page |
| `steps` | 6 (4 turns + 2 lead) | 7 |
| Leaf `k` turns over | `pos [k+1, k+2]` | `pos [2k, 2k+1]`, then a step with no turn |

### The lead-in and lead-out — why `steps` is not the number of turns

**Paper mode spends one whole step at each end moving the camera and turning
nothing.** Without it the first leaf begins turning on the very first scroll,
while the camera is still out at the establishing angle — so the front page is
never legible at *any* scroll position, which rather defeats a front page. The
lead-out gives the camera a step to pull back out over the back cover.

That is why the shell distinguishes three quantities, and mixing them up is the
easiest bug to write here:

| | |
|---|---|
| `turns` | Steps that actually turn a leaf — the old `steps` |
| `lead` | Camera-only steps at each end. **1 in paper mode, 0 otherwise** |
| `steps` | `turns + lead * 2` — what the scroll track is measured in |

Everything the reader sees is in **turn space**: `pos - lead`, clamped to
`[0, turns]`. Leaf turns, the spread pan and the page indicator all use it, and
`posForPage` adds the lead back on so deep links land in the reading position
rather than the establishing shot. The camera is the one thing that reads raw
`pos`, because the lead-in *is* its move.

`lead` is 0 outside paper mode: there is no camera in the plain document to
move.

The scene's leaf shader reconciles them from `pos` directly. Everything else —
the corners, `SectionRule`, `FrontTeasers`, `PageControls`, deep links — speaks
in **page numbers**; `goTo` converts. Never make a caller do that conversion
itself.

`NewspaperSheet` itself is now a STATIC document component. The CSS-3D turn it
used to drive (framer transforms, cast shadows, face shading, a compositing
budget) lives in the WebGL scene — and for a while the component kept animating
anyway, driving per-frame inline styles and GPU layer promotion on content
clipped to one pixel inside `.np-sr`, where nobody could ever see it. If you are
tempted to give it motion again, the visible page turn is a shader in
`Leaf.tsx`; this component renders the crawlable document and the accessibility
surface, nothing else.

One consequence worth knowing: on a spread, `depth` alone tells you a leaf is on screen but not
which of its two pages you are reading, and on a narrow screen only one page is centred at a time.
`frontVisible` / `backVisible` in `NewspaperSheet` is the single place that decides, and it drives
both `inert` and which dog-ear is offered.

## The 3D scene

Paper mode is a three.js scene (`src/features/scene/`), mounted from
`NewspaperShell` via `dynamic(…, { ssr: false })`. Plain mode is unchanged and is
still both the crawlable document and the fallback — `readingMode.ts` returns
`plain` for reduced-motion, viewports under 1024px, **and browsers without
WebGL**.

| | |
|---|---|
| `Leaf.tsx` | Four bound leaves, two pages each. The turn is an arc-length-preserving vertex-shader curl, so the paper bends without stretching. |
| `roomLight.ts` | The clip, the camera solved against its table, and the light rig that has to match it. One module, because the layers only read as one scene if they agree. |
| `NewspaperScene.tsx` | The canvas: fixed camera, the floating edition, the paper's drawn shadow. Wrapped in `SceneBoundary` (NewspaperShell) — in React 19 an uncaught render error unmounts the entire root, so one flaky texture 404 would otherwise blank the whole page instead of degrading to the room video and the plain document. |

There is no drawn table. The clip films a real one, and the scene that drew its
own (the chabudai, the timber shader, the establishing camera that rose to read)
was deleted once it became unreachable — `clipTable` is a required field on the
light rig, which is deliberate: the fit is the one thing a new clip genuinely
requires.

**There is exactly one room, and it plays at every hour.** The site used to pick
between a morning clip and a night one off the visitor's clock, with an
`evening` rig written but unreachable. All of that is gone — the `Phase` type,
the hour boundaries, the availability fallback, the `phase` prop threaded from
the shell into both layers, and the boot script's baked hour→phase table. What
is left is a constant: `ROOM_LIGHT`, `ROOM_VIDEO`, `ROOM_POSTER`. If a second
room is ever wanted, it is a table keyed by clip name and something to choose
with — not a resurrection of the clock, which is where the bugs were.

**Every shader here must end with `#include <colorspace_fragment>`.** three
converts hex colours to linear on construction and decodes sRGB textures on
sample, but a raw `ShaderMaterial` gets no re-encode on the way out — without it
the linear value is written straight into an sRGB framebuffer and the whole scene
renders dark and muddy. This was a real bug that survived several rounds of
tuning before being spotted.

### The camera does two jobs

`sceneConfig.ts` defines two shots, and `CameraRig` lerps between them by how
open the paper is. **Pitch and field of view travel with the distance** — that is
the whole point, because one angle cannot do both jobs:

| | Establish (paper shut) | Read (spread open) |
|---|---|---|
| Pitch | 48° | 66° |
| Lens | 34° — wide, keystones the table edges into *furniture* | 23° — long, keeps the page square |
| Frames | The table, its front edge and its legs | The spread |
| Depth foreshortens to | 74% | 91% |

The establishing shot frames `TABLE_FRAME_CORNERS`, not `TABLE_CORNERS`. Fitting
the top surface alone is by construction a fit that ends *exactly* at the front
edge, which puts the thickness and the legs off the bottom of the screen — and
those are the entire reason for taking a low angle.

**The establishing pitch and the leg inset are one decision, not two.** The
tabletop overhangs its legs, so the front edge occludes them down to
`y = -THICK - (inset + LEG) x tan(pitch)`. At 53° that swallowed the legs whole
and the table appeared to rest on nothing. Change either number and check the
legs are still visible.

Two traps worth knowing, both of which produced visible artefacts:

- **`camera.fov` and the projection matrix drift apart silently.** `solveFit`
  mutates the fov while it iterates. Restoring the field without calling
  `updateProjectionMatrix` leaves the matrix built for the *last shot solved*,
  and the frame loop's "has the lens changed?" guard then sees no change and
  never corrects it — the scene renders 1.6× magnified and the table overflows
  the frame. Always leave the camera with a matrix that matches its own fov.
- **No backticks inside the GLSL template literals.** Obvious in hindsight, cost
  two round trips: a shader comment written as ``// `along` runs with the
  board`` terminates the template string, and TypeScript reports it as a stray
  syntax error dozens of lines from anything that looks wrong. Use quotes.

### Scripts

```bash
npm run pages:render                  # rasterise the 8 pages to public/pages/*.avif
npm run scene:shot -- <step> [out]    # screenshot at a scroll position
npm run clip:fit -- [clip] [aspect]   # solve the camera against the table in the clip
npm run perf:timeline                 # what the page looks like frame by frame while loading
npm run backdrop:prep                 # process backdrop-src/morning.* into public/backdrop/
```

`scene:shot` exists because a WebGL scene cannot be checked by reading the DOM —
camera framing, the curl, which texture landed on which face and the lighting are
all invisible to `getComputedStyle`.

### The room behind the table

A looping clip of a real room, played by a `<video>` in the DOM **behind** a
transparent canvas — not mapped onto geometry inside the scene. Putting it in
three would re-upload a full frame to the GPU every render and weld playback to
the WebGL loop, so any hitch in the scene becomes a hitch in the room. As a
sibling, the browser decodes it independently, throttles it when the tab is
hidden, and gives us `poster` for free. Being outside the scene costs exactly one
thing — a DOM layer is nailed to the viewport, so the room would sit still while
the camera rises — and `RoomBackdrop` pays it with a few percent of scale and
drift on `CAMERA_TRAVEL`, the same curve the camera uses.

`npm run backdrop:prep` reads `backdrop-src/morning.mp4` and writes
`public/backdrop/morning.mp4` plus a poster. The name is load-bearing on both
sides — it is what `ROOM_VIDEO` asks for. Sources are gitignored; outputs are
committed, because Cloudflare Pages has no ffmpeg. The binaries come from
`ffmpeg-static`, so no system install is needed.

The chain is **delogo → loop-fold → scale → blur → grade**, and the order is not
arbitrary:

- **delogo runs first, at full resolution.** It rebuilds the covered box by
  interpolating from its edges, so it needs the original neighbouring pixels;
  downscaling first smears the watermark into them and leaves nothing clean to
  interpolate from. The box is stored as *fractions* of the frame, so it survives
  a source at another resolution.
- **The clip is CUT to its own loop point, not reshaped.** It is generated to
  loop and very nearly does, and two earlier attempts were solving a problem
  that did not exist. A crossfade from tail to head dissolved two
  completely different moments and ghosted anything with an edge. Playing
  forwards then backwards removed the seam but introduced a reversal — the
  curtain visibly changing direction twice a cycle, which is worse, because
  reversed motion is something the eye is genuinely good at spotting.

  What the clip needs is its wrap point *found*. A generated loop is usually a
  few frames out, so `findLoopPoint` compares every plausible start frame against
  every plausible end frame (128x72 greyscale, mean absolute difference) and cuts
  where they actually match. No dissolve, no reversal, every second of unique
  motion kept.
- **Then a very short dissolve across the join.** Measured, the best available
  wrap is still about 2x an ordinary frame step — small, but small is not nothing
  on a clip that plays all day. Six frames of blend, a quarter of a second,
  placed at the FRONT of the output so playback wraps on an ordinary consecutive
  step rather than on a join. This is not the earlier crossfade retried: it works
  precisely because the two ends already match, so it is smoothing a small step
  rather than disguising a large one.
- **The result is measured on the encoded file**, not on the plan — the script
  decodes what ffmpeg actually produced and reports the wrap against the clip's
  own typical frame step. Currently **1.6x**, down from 5.8x uncut. A loop is
  exactly the kind of thing that is easy to get subtly wrong and never notice.
- **Grade AFTER the blur, and push values UP.** This is the counter-intuitive
  one. Blur is an averaging operation, so it pulls the golden shafts and the
  shadows between them toward each other: a clip that is vivid sharp comes out
  flat and grey once defocused. The `eq` filter runs last and lifts saturation
  and contrast *above* 1 — restoring what the blur removed, not stylising.

**Shipping the clip sharp was tried and reverted.** Rack-focusing from crisp to
soft as the camera pushes in sounds better than it looks: a photographic room at
full detail behind a shaded 3D table reads as two images stuck together, because
it is. Out of focus, the mismatch simply is not visible. Baking the blur back in
also cut the file from **715 KB to 160 KB** — blur strips exactly the
high-frequency detail an encoder spends bits on, and makes resolution
irrelevant, so 960x540 blurred is indistinguishable from 4K blurred.

`RoomBackdrop` still racks a few more pixels in on scroll, as a top-up. It is a
CSS filter, so `will-change` must name `filter` as well as `transform` — without
it Chrome re-rasterises the layer on every change instead of animating the one it
already has.

### The one way to have a table

The clip films the table, and the scene is built on that fact alone:

| | |
|---|---|
| Table | Filmed. The scene draws none |
| Camera | **Fixed. Never moves** — solved against the filmed tabletop |
| What travels | **The paper** — it lifts off the clip's table and tilts into the lens |
| Clip ships | Sharp, ~1 MB, defocused at runtime as the paper lifts |
| Grounding | The paper's drawn contact shadow, gone by a fifth of the lift |

**The camera cannot move.** A video has no parallax, so any camera move slides
the scene off the very table it is supposed to be resting on and the illusion
dies in a single frame. Having the paper travel instead is not a workaround for
that — it is the better mechanic anyway. It reads as picking a newspaper up
rather than as the room rushing at you.

#### Fitting the camera to a filmed table

`npm run clip:fit` solves it. Measure the tabletop's four corners in a frame, add
them to the script's `TARGETS`, and read the camera off the chosen row. The
measurements live in the script rather than on the command line so the numbers
behind the scene's camera stay written down.

**A single image of a rectangle does not determine a camera**, and this is the
trap. The trapezoid fixes the horizon, but pitch and focal length then trade
against each other along a family of solutions that all reproduce those four
corners to within a few pixels — every table aspect from 0.30 to 0.72 fitted the
measured corners inside 4px. Fitting freely picks an arbitrary member of that
family, and the first pass here chose one implying a table 0.29 as deep as it is
wide, which made the newspaper twice as deep as the table it was lying on. The
extra constraint has to come from outside the image: assume a plausible table
aspect, and take the branch where a real page actually fits.

The 0.58 aspect that fixed it was checked against a **second framing of the same
physical table** — the since-retired night clip, which it fitted at 3.9px against
morning's 0.6px. That agreement across two cameras is the only independent check
this method has ever had, and it is why the number is trusted; a clip of a
different table would need its own.

Two other things were solved rather than eyeballed, after eyeballing them
failed. The paper's **read position sits on the view axis** — the camera aims at
the origin from 21°, so the centre of frame at that depth is a specific world
point, and guessing put the masthead off the top of the screen. And the paper's
**read scale is bound by HEIGHT, not width**: a spread is twice as wide as a
cover but exactly as tall, so both land on nearly the same number.

The contact shadow uses a **box falloff, not a radial one**. The caster is a
rectangle; a radial gradient keeps its opaque core inside the paper's own
footprint, so the shadow is drawn entirely underneath and none of it is ever
visible.

### The paper's shadow

Its **direction is derived, never configured** — from `dir`, reversed, with a
length of the caster's height over the tangent of the light's elevation. A
shadow that does not fall away from the light is the single most obvious way to
give away that a scene is composited, and it is not something to leave to a
number someone can nudge.

Two details matter more than they look:

- **It is displaced, not centred.** A shadow centred under its caster is what an
  overhead light gives you, and neither clip has one — the sun comes through a
  window off to one side, so the paper's shadow belongs down and to the left with
  *nothing at all* on the lit edge. That asymmetry is most of what sells the
  paper as being in the room rather than pasted onto it.
- **The falloff is a box, not a radial.** The caster is a rectangle; a radial
  gradient keeps its opaque core inside the paper's own footprint, so the whole
  shadow ends up drawn underneath and none of it is ever visible.

- **Its whole life is the first third of the lift.** It is a flat quad on the
  table and it belongs to the paper only while the paper is on the table. Carried
  the full length of the travel it behaves like exactly what it is — a big dark
  slab left lying in the room, spread to two and a half times the table's size
  and still a third as dark by the time the page is against the lens. With
  nothing else in frame moving, that reads as the shadow *following the paper to
  camera*. So it blurs out and is gone by roughly a third of the way up, which is
  what a real one does anyway, just faster.

Only its character is configured: `shadowStrength` and `shadowPenumbra`. Direct
sun through a window is dark with a tight edge, and that is what this room has.

### Making the two layers one scene

Colour-matching is not compositing, it is lighting. `roomLight.ts` defines both
the clip and the light rig that goes with it — key direction and colour, ambient,
the pool of light on the tabletop, and the **window gobo** — in one module, so
they cannot be changed apart.

**Measure the gobo off the clip; do not eyeball it.** The bars of window light
on the floor run about 17° off vertical in frame, which pins the key's horizontal
bearing at roughly `x:z = 0.3:-1`, and they are close to 50/50 light-to-dark
about two world units apart. An eyeballed first pass put the bearing near
`0.55:-1` and threw the table's shadows across at twice the angle of the room's,
which is the single most visible way for these two layers to disagree. Crop a
frame of the floor and look at it before touching `dir` or `goboPeriod`.

The gobo is the strongest single tie between the layers. The room in the clip is
full of hard bars of window light; a table standing in that room with a perfectly
even top does not belong there no matter how well its colour is matched. So the
same bars are thrown across the tabletop *and*, far more weakly, across the
paper. Their direction is derived from the light direction rather than hardcoded,
so moving the key moves them with it.

Two things are deliberate and will look wrong if you "fix" them:

- **The key sits on the FAR side of the table** (negative z). That is where the
  window is in the clip.
- **The floor shadow is offset and stretched along the light**, not a symmetric
  blob under the middle. Nothing in the scene can cast onto a video, so the
  table's grounding is drawn by hand — and every other shadow in the room falls
  toward the near-left, so one that did not was immediately wrong.
- **`paperTint` stays near white.** Eight pages of small type are the only thing
  on screen anyone has to be able to read, so the paper is lit for legibility
  before it is lit for physics. Cinema lights faces brighter than physics allows
  for the same reason.

Neither layer chooses its room any more: `RoomBackdrop` plays `ROOM_VIDEO` and
the scene shades with `ROOM_LIGHT`, both constants out of the same module. That
replaced a `phase` resolved once in `NewspaperShell` and threaded into both — a
correct arrangement whose whole purpose was to stop the two layers disagreeing
about the hour, and which nothing needs now that there is no hour.

### Scope

Three things were planned and are **cancelled**: first-person hands, the coffee
cup, and any opening animation at all.

The last of those went through two full builds — a rolled bundle thrown in on a
ballistic arc, then a sheet falling flat with a dust puff — and both were scrapped
for the same reason. An intro is a toll on every visit after the first, it has to
hold the scroll while it plays, and it delays the only thing anyone came for. The
paper is simply **already on the table** on the first frame.

What is left is worth stating plainly, because it is the whole brief: a newspaper
on a table, in a blurred room, that turns properly.

## The first second — read before touching the boot path

The server always sends the **plain eight-page document**. That is correct: it
is the crawlable one, the no-JS one, and the fallback. But a desktop visitor is
going to get the scene, and reading mode can only be decided on the client —
reduced-motion, viewport width, whether WebGL works. `useSyncExternalStore`
handles that correctly, and "correctly" means the decision lands at *hydration*.

Which meant a full-screen cream broadsheet for **1.6 seconds**, then a dark room,
then the newspaper two seconds after that. Nothing was broken: the build passed,
nothing 404'd, there were no console errors, and the finished page was right.
The load *order* was wrong, and that is invisible to every other check here —
which is what `npm run perf:timeline` exists to catch.

Four things fix it, and they are load-bearing together:

1. **`bootScript.ts` is a blocking inline script in `<head>`.** It makes the same
   decision `getReadingMode` will make later and writes it to `<html>` before
   anything paints. This is the only possible fix — nothing that runs after the
   bundle can un-paint what the browser already drew. It shares `MIN_WIDTH` and
   the storage key with `readingMode.ts`, so it cannot drift. **It must never
   throw**; every path falls back to plain, which is the document already on
   screen.
2. **CSS acts on that immediately.** `html[data-np-mode="paper"]` with the scope
   still at `data-mode="plain"` is precisely the pre-hydration window: html says
   where we are going, the scope says where we are. The stack is hidden
   (`visibility`, never `display` — the deep link has to measure the track) and
   the room's own poster is painted straight from the stylesheet. It used to
   arrive as a custom property the script wrote, because the script picked which
   room; with one room the URL is a constant and the script only preloads it.
3. **The boot script starts the downloads its decision implies** — the poster and
   the first leaf's two textures. They were previously requested only after the
   scene chunk arrived. **The textures must be preloaded
   `crossOrigin="anonymous"` and the poster must not**: three's TextureLoader
   issues an anonymous CORS request, and a preload whose credentials mode differs
   from the eventual fetch is silently discarded — the file is downloaded twice
   and the preload buys nothing at all. The poster is consumed as a CSS
   background and a `<video poster>`, neither of which is a CORS request, so
   tagging it breaks it the other way. Chrome says this out loud (*"preload ... is
   not used because the request credentials mode does not match"*), which is
   worth reading rather than dismissing as noise.
4. **The scene chunk import fires at module evaluation**, not from `dynamic()`'s
   first render. The largest download on the page was queued behind the very
   hydration it was waiting for.

Two smaller pieces: Suspense is **per leaf** rather than one boundary around all
four, so the front page appears without waiting on six textures nobody can see
yet; and the canvas **fades in** when leaf 0 resolves, over a room that is
already on screen, so it is a hand-off rather than an arrival.

`<html>` carries `suppressHydrationWarning`, and that is not a shrug. The boot
script writes attributes React never rendered, so React reports a mismatch it
explicitly refuses to patch up. It is suppressed on that one element only,
because that one element is the only thing a pre-paint script is allowed to
touch.

Measured on localhost: room painted at **80ms**, everything up by **150ms**, no
frame in which the plain document is visible.

One console warning remains and is not ours — *"THREE.Clock: This module has been
deprecated"* — emitted by `@react-three/fiber`'s own render loop against three
r185. It goes when R3F updates.

## Environment

| Variable | Purpose | Fallback |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Origin of the app, for the Login/Register CTAs (`src/features/newspaper/links.ts`) | `http://localhost:3000` |
| `NEXT_PUBLIC_SITE_URL` | This site's own origin, for canonical + OpenGraph URLs (`src/app/layout.tsx`) | `http://localhost:3001` |

Both are **inlined at build time**. Changing either requires a rebuild, not a restart — set
them in the Cloudflare Pages project before the first production build.

## Cloudflare Pages settings

| Setting | Value |
|---|---|
| Root directory | `landing` |
| Build command | `npm run build` |
| Build output directory | `out` |
| `NODE_VERSION` | `20` (Pages defaults older; Next 16 needs 20+) |
| Production branch | `main` |
| Custom domains | `<domain>` and `www.<domain>` (301 → apex) |

See [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for the full deployment runbook.
