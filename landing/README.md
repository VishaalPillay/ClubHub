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
`--np-paper` (`#f8eedf`), and every white surface in the application is now that beige. As part of
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

`src/features/newspaper/wordmarkAssets.ts` and `frontend/src/components/ui/wordmarkAssets.ts` are
**byte-identical generated files**, next to three WebP renditions in each app's `public/brand/`,
and `Wordmark.tsx` exists in both projects (`.np-wordmark` here, `.wired-wordmark` there). Do not
hand-edit any of it — regenerate everything together:

```bash
node ../scripts/gen-wordmark.mjs                  # from this directory — sharp resolves out of landing/
node ../scripts/gen-wordmark.mjs path/to/new.webp # re-master first
```

The mark is **supplied artwork**: `scripts/assets/wordmark-master.webp` is the file as it was
delivered (stored untouched, so re-mastering never compounds a lossy generation), and the generator
trims it to its own alpha bounds and cuts 480/960/1600px WebPs. The component is a plain `<img>`
with a `srcset`, and `width`/`height` from the intrinsic aspect so nothing shifts while it loads.

**It is a raster because it has to be.** It was traced to two SVG paths (black scraps, pale
letters) while the mark was two flat colours. The current artwork is full colour — red and black
cut letters on cream scraps with torn, textured edges — and tracing that to flat fills would be a
different logo. What the vector form bought is kept where it
mattered: the nameplate is `priority` (`fetchPriority="high"`) because it is page one's LCP element,
and the letters carry their own cream border, so the mark holds on the ink footers and the controls
bar with **no `invert` variant**. If you see a call site passing `invert`, it predates this.

There is **no hover animation** and no `uid` prop; the old mark's crumple filter is long gone.

**The mark is taller than the original vector one** (3.6:1 against 4.5:1), so a slot sized for that
width grows ~25% in height. The nameplate band and the controls bar (`.np-controls-mark`, 150px) were
checked against it; anything new that holds the mark needs the same look.

**After changing the wordmark, re-run `npm run build && npm run pages:render`.** The nameplate is
baked into the page-1 textures (`public/pages/01.*.avif`) — and `pages:render` photographs `out/`, not the dev server, so
without the build first it re-bakes the *previous* mark. Paper mode then keeps showing it, a silent
staleness that only appears in 3D mode.

### The "Available at" ticker (page 1)

`CollegeStrip.tsx` renders the list twice and slides the track by half its own width (no jump);
the second copy is `aria-hidden`. In paper mode the page is a baked photograph, so a ticker on it
would be a still frame. Instead `scripts/render-pages.mjs` records the window's box into
`public/pages/meta.json` (fractions of the page) and the 3D scene paints the ticker live onto that
rectangle — `src/features/scene/collegeStrip.ts` draws a canvas and `Leaf.tsx` samples it in the
fragment shader for leaf 0's recto only. The baked frame stays under it as the fallback, so it is
shot with the animation frozen and offset slightly (the first name must clear the edge fade).

The list is `src/features/newspaper/colleges.ts`, one entry per brand rather than per campus. Each
entry's `names` must be copied from `frontend/src/data/collegesIndia.ts`; `node
../scripts/gen-college-logos.mjs` fails if one is not there. "Available at" means *a student of that
college can pick it when registering*, nothing more. Logos are optional per college. IIT and NIT carry
IIT Madras's and NIT Trichy's marks (families have no single one — see `SOURCES.md`), and an entry with
`wordmark: true` (SRM, Thapar) drops the text label because its logo already says the name. See
`scripts/assets/colleges/README.md` for the workflow. Wide wordmarks are contained in a 16cqw box,
never stretched.

### The hero wraps the collage (`shape-outside`)

On page 1 the collage is floated right and the headline and copy run along its silhouette. The
silhouette is a polygon computed from the picture's alpha by `scripts/gen-front-art.mjs` (the
leftmost opaque pixel of each of 48 horizontal bands) and exported as `HERO_SHAPE`; the figure gets it
as the `--hero-shape` custom property so the stylesheet can still turn it off on a narrow sheet. It is
a polygon rather than `shape-outside: url(...)` because an image-derived shape does nothing if the
image is not loaded, same-origin and laid out first — and then the text silently runs under the picture.
Swap the picture with `node ../scripts/gen-front-art.mjs hero new.webp`; that regenerates the polygon.

### Type size and texture resolution (read before touching `--np-t-*`)

Paper mode deliberately has **no `clamp()` floors** on the type ramp, so the numbers in
`newspaper.css` are the printed sizes on a 574px sheet — which the camera then shows at ~650px.
Anything below ~9px on the sheet is unreadable on screen. The ramp is micro 1.72cqw, cap 1.95,
body 2.3, deck 2.95; `pages:render` photographs at 3x. The cost of larger type is height, and a
page is a fixed-height sheet: `pages:render` exits non-zero and names the page when anything
overflows, so a copy change that does not fit is caught instead of silently clipped.

### Pages 2 and 3: the showcase spread

Page 2 (`Page2Community`: hero, figures, featured clubs) and page 3 (`Page3Happening`: events, student
voices, closing line) are one set; `Showcase.tsx` holds what they share (the furniture strip, `Art`,
`Tags`, `Kicker`, `Icon` and the stacked `Row`). They replaced "The Situation" and "Governance &
Structure", whose content was removed on request (the seven ranks are still on page 6).

Rows are stacked — pitch across the top, cards across the full width — so the cards can be large, and
the height a page does not need is **shared out between its sections** rather than left as a blank band:
`.np-page-inner:has(> .np-p2-row)` is a flex column and `.np-p2-grow` / `.np-p2-row` each take an equal
share and centre their content. If you add a section, give it `np-p2-grow`; if a page overflows,
`pages:render` fails and names it.

The art comes from `scripts/gen-front-art.mjs`: `campus` and `plane` are single pictures, and `clubs`,
`events` and `voices` are strips it cuts into one image per card. The cut follows each picture's own
connected piece of pixels rather than a column, because the illustrations overlap; it errors if two
fuse. `voices` is cropped to the people and the quote is live text on a CSS note. The stat band's numbers
come from the sign-up picker (`pickerStats.ts`, written by `gen-college-logos.mjs`), never typed: re-run
it when the picker's list changes. The clubs, events and quotes are samples and are labelled so.

### The front-page collage art is generated too

`public/art/{hero,discover,connect,engage,lead}.webp` and `src/features/newspaper/frontArt.ts` come
from `scripts/assets/front/` via `node ../scripts/gen-front-art.mjs` (run from this directory;
sharp resolves out of `landing/`). The masters are the supplied 1536x1024 images, stored as
delivered and trimmed to their alpha bounds on every run. `frontArt.ts` carries each file's
intrinsic size so the `<img>` boxes are reserved before the art arrives — do not hand-write
`width`/`height` for them. To swap one picture: `node ../scripts/gen-front-art.mjs teaser-name new.webp`
(`hero | discover | connect | engage | lead`), then rebuild and `pages:render`.

One font exists only for this page: **Playfair Display 900** for the headline and teaser titles
(`--font-hero`). One weight, so nothing else is downloaded. The hero is a two-column grid only above a 400px sheet; below that
(phones, and the plain reading mode) it stacks, the masthead flanks are hidden, and the teaser art
is capped at 260px so a single-column card does not stretch a picture to the full sheet.

### The browser icons are a generated pair as well

`src/app/{favicon.ico,icon.png,apple-icon.png}` are **not hand-made and not landing-specific** —
they are cut from `scripts/assets/favicon-master.png` at the repo root and written into this
project and `frontend/` together:

```bash
node ../scripts/gen-favicon.mjs        # from this directory; sharp is resolved out of landing/
```

Next's metadata file convention finds them by filename and emits the `<link>` tags, so `layout.tsx`
has no icon markup to keep in step.

The icon is the supplied torn-paper "C" artwork, which is already a rounded square with transparent
corners, so the tab icon **keeps that shape** rather than being cut to a disc. `apple-icon.png` is an
opaque full-bleed square, on purpose: iOS composites a transparent apple-touch-icon onto black and
then applies its own squircle mask, so its corners are filled from the art's own colours. The `.ico`
carries **six** entries (16/20/24/32/48/64) because Windows renders a 16 CSS px favicon at 20 device
px at 125% scaling and 24 at 150%, and rescaling a 16 or a 32 to reach them is exactly what a
slightly soft, slightly grey favicon looks like. The same run also writes the PWA install icons into
`frontend/public/icons/` — this site is a static page and does not ship a manifest.

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
(`spreadForPage`, `rectoForSpread`).

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

**The room is now a golden-hour study, and the scene is solved against ITS desk.** The notes below
describe the pipeline in terms of the previous clip (a daylit room, a 1280x720 Gemini source); the
mechanism is unchanged, the numbers are not. For the golden-hour clip: the source is 1920x1080 and is
encoded at that size; there is no watermark to remove; the temporal denoise runs before the loop is
cut; the loop dissolve is 18 frames because the clip barely moves; the camera was re-fitted to the
green desk mat (pitch 16.8 degrees, fov 31.3); and the light was re-measured (sun 32 degrees off the
far axis, toward +x, 24 degrees up). See `roomLight.ts` for each number and where it came from. On top
of the footage the scene adds warm sun on the paper, drifting window bars and leaf dapple, a warm
shadow with a halo, and CSS dust motes in the beam (`RoomBackdrop.tsx`).

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

(For the golden-hour clip the chain is **denoise → cut to the loop → dissolve → sharpen → grade**, with
no delogo and no scale — the source is already 1080p. The notes that follow explain why each step sits
where it does and still apply, including the new rule that the temporal denoise goes before the cut.)

The chain was **delogo → loop-fold → scale → blur → grade**, and the order is not
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

(The golden-hour clip's fit has no such cross-check: it is one framing of a different table.
Every aspect from 0.30 to 0.72 fits its corners to ~1px, so 0.58 was chosen because a desk mat
that size is plausible and because it reproduces the camera pitch (~16 degrees) implied by the
reference composite. That is a judgement, not a measurement — if the paper ever looks too steep or
too flat on the mat, change the aspect and the fit moves with it.)

The 0.58 aspect that fixed it for the **previous** clip was checked against a **second framing of the same
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

## The folder (`src/features/scene/Folder.tsx`)

The edition is kept in a **kraft folder**, built in three.js. Shut: a back board, a stack of
other documents with coloured tabs, a **deck of eight page cards**, and a front cover with a
ClubHub label, held down by an elastic cord round a button. The reader is **handed it shut,
opens it in front of them, closes it, and puts it down** — each end step is split by
`FOLDER_SHARE` (0.45):

| Step | Outer part | Inner part (`FOLDER_SHARE`) |
|---|---|---|
| Lead-in | The SHUT folder lifts to the reader (`openness` 0 → 1) | Cord off the button, cover swings open toward the lens (`folderProgress`) |
| Lead-out | The SHUT folder is set back on the desk | The cover swings back over the deck, then the cord goes back on (`closeProgress`, `coverClose`, `cordHook`) |

All of it is scroll-driven, not an intro: it never holds the scroll, scrubs both ways,
and Lenis settles to the nearest whole step.

### The boards are solid

Both boards are **thick plates** (`thickPlate`): a generated closed solid, rounded on the
free side, with real edge walls (the shader tells faces from walls by `normal.z`). The
cover is bent in `PLATE_VERTEX` by the exact-arc construction with its thickness laid
along the bent normal, so the walls bend with it. The edge is shaded as laminated
pressed board. `uOuter` says which face is the outside: the cover's up face, the back
board's desk face.

### A folder that has been used

A brand-new folder read as a render. Everything below is there to say somebody carries
this one about:

- **Loose papers poking out** (`SHEETS`): graph paper and a page torn from a pad (ragged
  edge, `uTorn`) out of the right edge, a clipped typed letter, a pink carbon copy and a
  ticket stub out of the near edge, a club flyer's red masthead out of the far edge, a
  sticky note curling up on the right. Each is a plane laid in the stack at its own height
  — mostly inside the stack box, which hides that part — drawn by one shader
  (`SHEET_VERTEX`/`SHEET_FRAGMENT`). The part past the boards **droops** (the sticky note
  curls up) and **flutters**: faintly all the time, properly while the folder is lifted,
  opened or set down (`uFlutter`, from the scroll velocity, fast to rise and slow to
  settle). The flutter's phase is from the point's position, so overlapping sheets flap
  together and never cross. Placement rules: every sheet is below the deck, above the
  released cord, and none crosses the right edge near z = 0, where the hooked cord runs.
- **A Gem paperclip** (`paperclipGeometry`) on the letter's edge; the letter does not
  flutter (it is clipped).
- **The cover's outside** (`PLATE_FRAGMENT`): pale scuffs along the free edges (warm, not
  grey — the pulp under the skin), a darker polished patch where a thumb opens it beside
  the button, two **coffee rings** (dark tide line at the rim, faint wash inside, heavier
  on one side), a red **rubber stamp** pressed unevenly with specks the ink missed, a
  typed file line under the label, and **masking tape** over the label's top-left corner.
- **A bent-up corner** (`EAR`, `EAR_K`, `uDogEar`): the cover's near free corner, lifted
  past a diagonal fold in the vertex shader, its slope fed into the normal. The plate now
  has rows across its depth (dense near that edge) — a board that only bent along s needed
  none.
- **The kraft itself**: the relief is fibres with a GRAIN (one dominant set a little off
  axis, a weaker slanted one) and a slow warp; the crinkle web is a whisper. Cut mostly
  from the crinkle at full strength, it read as pebbled leather; two equal fibre sets at
  right angles read as linen. Specks are sparse and two-sized (dense one-size is a dot grid).
- **The lettering is painted, not downloaded** (`folderDecals.ts`): one 1024x640 canvas
  mask in the page's own fonts (Space Grotesk; Courier New for the typed line; the
  system's handwriting face for the sticky note), on the first frame, repainted once if
  the font was not in yet. No download, so nothing pops in.

Measured with all of it on the laptop's Intel GPU at retina resolution: 55 fps, 0.5% of
frames over 25 ms — unchanged.

### The pages are a deck of cards

Each page is its own card (`Leaf.tsx`, `CARDS` = 8), all on one pile on the right, read
one at a time — **one scroll step is one page** in 3D (the shell's `pairs` flag; plain mode
on a wide screen keeps its two-page spreads). Each step sends the top card to the back of
the deck, the way you go through a pack of cards (`cardPose`): **picked up** toward the
reader (0–0.16), **drawn out** to the LEFT, over the open cover (`DRAW_DIR`), with a few
degrees of wrist twist and a slight bow (0.08–0.5) — it used to go right, and once the
open folder was slid right to balance the frame (below) half the card left the screen at
the peak; the cover is the empty half of the composition and lies well below any carried
card — **lowered** to the bottom of the pile once it is entirely clear of the deck
(0.46–0.58), and **slid back under** (0.52–0.95). Heights come from each card's rank from the
bottom, continuous in the scroll position, so the pile never z-fights; a card's height only
changes while it is clear of the deck, so nothing passes through anything.

The last card never moves: the pose is capped at the final page, because past it is the
lead-out — uncapped, page 8 was drawn out from under the closing cover.

### Things that are easy to break

- **The resting bow is world-UP**, not along the sheet normal, and is held flat while the
  cover is near (`pageBow`, both the opening and the closing).
- **The cover hinge only drops once the cover is past upright** (`hingeFor`).
- **The button mirrors the cover's arc in JS** (`coverPoint`) — change one, change both.
- **The cord's two poses have the same point count**; the release bows up and out so it
  clears the cover. It is rebuilt only while moving.
- **Decals live in the plate shader** (label outside; pocket, red slip and two B&W
  snapshots inside, from `/brand/clubhub-960.webp`, `/art/campus.webp`,
  `/art/events-2.webp`), loaded in page 1's Suspense boundary — the canvas fades in only
  once they have decoded.
- **One lighting model**: `roomShading.ts`, shared by leaves and folder (window bars at
  0.92 on the folder). The kraft bump is cut from its own height field with screen-space
  derivatives.
- **Read scales are held at `READ_FIT` (0.955)** so the kraft border stays in frame; the
  deck is always read at the single-page scale.
- **The open folder is slid right by `READ_SHIFT` (0.3 page widths) × `coverOpenness`**
  (`NewspaperScene.tsx`). With the page dead centre the open cover hung a half-page left
  of it and ran off the screen; 0.3 is a little under a third of the way to centring the
  whole folder (~0.5), so the PAGE stays the biggest, most central thing. It rides the
  cover's own curve (`coverOpenness` in `sceneConfig.ts`, which `Folder.tsx` swings the
  cover by), so the shut folder still lifts and lands dead centre. Capped by the frame
  (`READ_EDGE`): the folder's right edge never leaves the screen, so a narrow window
  gets less of the shift, down to none.
- **Cards are OPAQUE.** Eight stacked cards drawn as transparent were shaded back to front —
  all eight on every pixel of the page. Opaque, the depth test rejects every card under the
  top one before it is shaded.

## Motion — where each kind lives, and why only there

The two reading modes can move in completely different ways, and that is not a choice:

| | Paper mode (desktop, WebGL) | Plain mode (phones, tablets, "Read as a plain page", no WebGL) |
|---|---|---|
| The pages are | **Textures** — photographs of the HTML | Real DOM |
| Motion | The card deck, the folder, the lift, the room | Scroll reveal, hover lift, a few px of parallax |
| Reduced motion | Never reached — `readingMode.ts` routes it to plain | Everything below is **off** |

A texture cannot fade a headline in or lift a card on hover — there is no headline
or card in it, only pixels, and nothing on a 3D page can be pointed at (no
raycasting). So anything per-element lives in the plain document, and the 3D view's
motion is the turn itself.

**Pages are a deck of cards** (`cardPose` in `Leaf.tsx`) — the top card is sent to the
back on each step. See "The pages are a deck of cards" above.

### Smoothness — measured on a real integrated GPU

Headless Chrome on this machine uses the laptop's own Intel UHD graphics (the probes force
software GL only when they need determinism), so frame times can be measured for real.
Scrolling through the deck at retina resolution, full quality went from **41 fps with 26.5%
of frames over 25 ms** — the choppy feel — to **55 fps with under 2%**. What did it, and what
must not be undone:

- **The scene reads the scroll position itself, every frame** (`ScrollSync`, priority −1,
  via the shell's `readScenePos`). It used to arrive via a scroll event, framer's useScroll,
  a motion value on framer's next frame, then a ref — asynchronous to three's own rAF, so
  some frames saw the new position and some the old: the paper moved two steps' worth, then
  none.
- **The settle eases in AND out** (`easeInOutCubic`, 0.6 s, after 180 ms idle). Lenis's
  default exponential ease-out leaves at full speed — a jolt, because a settle starts from
  rest.
- **The kraft is computed once per pixel** (`kraftFH`: colour and bump from the same 9
  noise lookups; the pocket reuses it). It was ~20, plus more passes for the pocket.
- **Cards are opaque** (above), and **DPR is capped at 1.5** on the high tier.
- **Full-size page textures are swapped in only while the scroll is still**, or just before
  the card is shown — a 1722x2376 upload with mipmaps is a dropped frame — and are fetched
  two cards ahead so they are ready by then.
- **The watchdog counts hitches**, not just the average: more than 10% of frames over
  50 ms in a two-second window counts as slow. (The first version counted frames over
  25 ms — which is not a hitch, just "under 40 fps": a smooth 37 fps had every frame
  "late", and opening DevTools was enough to lose the scene.)

**The room holds still while you read** (`RoomBackdrop.tsx`). Past 0.92 `open` the
clip pauses and the dust motes stop; below 0.85 both resume (the gap is hysteresis).
At that point the room is 15px out of focus under a two-thirds veil, so nobody can
see it move, but decoding a 1080p stream beside the page turn is real cost.

**The plain document is placed as it is read** (`useReveal.ts` + the READING MOTION
block in `newspaper.css`). One IntersectionObserver tags elements by role — `card`,
`art`, `head`, `body`, most specific first; anything inside a card moves with it —
and CSS delays give the order: headline, copy ~110ms behind, collage ~200ms, cards
one after another (95ms apart), so a screenful reads as one placement rather than a
slideshow. A collage is *set down*: 40px low, −1.4°, 96.5% scale, settling flat. The
collages are single flattened images, so there are no layers inside one to stagger.
Rules worth knowing before you touch it:

- **Nothing on the first screen ever hides.** The server sends everything visible;
  the hook marks what is above the fold `is-in` *before* the scope opts in to the
  hidden state. Hiding it after hydration would flash it.
- **Motion uses `translate` / `rotate` / `scale`, never `transform`.** The individual
  properties compose with a transform set elsewhere instead of replacing it.
- **Parallax is CSS scroll-driven animation** (`animation-timeline: view()`) on the
  `<img>`, ±7px for the big collages, ±3px for card art. The reveal moves the
  `<figure>`, so the two never fight over one element. No JS; a browser without
  `animation-timeline` simply gets a still picture.
- **Excluded:** anything inside `<details>` (a closed disclosure never intersects, so
  its answer would be stuck hidden), reduced motion, and `pages:render`.
- **`pages:render` arrives in render mode late.** It loads plain mode, lets it
  hydrate — so the hook has already run — and only then sets `data-render`. The hook
  watches for that attribute and removes every trace of itself; the CSS also forces
  everything under `[data-render]` visible and still. The first version only checked
  at mount, left the parallax drifting, and Playwright timed out "waiting for element
  to be stable".

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
3. **The boot script starts the downloads its decision implies** — the poster, the
   folder label (`/brand/clubhub-480.webp`) and the page manifest (`meta.json`). No
   page texture: the first frame is the shut folder. **The label and manifest must be
   preloaded `crossOrigin="anonymous"` and the poster must not**: three's TextureLoader
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

The canvas **fades in** when the folder's Suspense boundary resolves, over a room
that is already on screen, so it is a hand-off rather than an arrival. The leaves
do not suspend at all — see the next section.

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

## Loading, device tiers and failure — read before adding anything to the first frame

Measured cold, on the production build (`out/`, text compressed as Cloudflare does),
before → after this work:

| | Before | Now |
|---|---|---|
| Downloaded before the scene appears | 7.5 MB | ~0.85 MB |
| Scene up on 4G / 3G | 8.7 s / 36.6 s | ~1.6 s / ~5 s (and a 3G visitor now gets the plain edition) |
| Return visit | everything re-checked | ~0 KB (two 304s) |

**What the first frame waits for, and nothing else:** JS (~430 KB compressed, three.js
is ~250 KB of it), fonts, the room poster, the 30 KB folder label. If you add to that
list, measure again.

### What loads when

- **The articles' pictures never load in 3D.** In paper mode the eight articles are a
  hidden screen-reader copy, and their images were 2.1 MB. They are `loading="lazy"` and
  `html[data-np-mode="paper"] … img { display: none }` — a lazy image that is not rendered
  is never fetched. The shell keeps `<html data-np-mode>` in step with the mode after
  hydration (skipping hydration's first, server-snapshot render, which would briefly flip
  it to plain and start every download). `pages:render` forces them eager before
  photographing. In plain mode the ticker logos are switched to eager (it is a marquee —
  lazy, each chip slid in blank).
- **Page textures come in three sizes** (`render-pages.mjs`): `l` 3x, `m` 2x, `s` a 430px
  preview (~20 KB). Names carry a content hash; `public/pages/meta.json` is the manifest
  (`textures.ts`). After the first frame every leaf loads its preview; the full size
  (`l` on a high tier, `m` on mid) loads within 1.6 steps of the reader and is released
  past 2.6, so at most three leaves of full textures are on the GPU. Decoded off the main
  thread (`createImageBitmap`).
- **The pocket snapshots, the 960 label and the live ticker's logos** load after the first
  frame. **The room clip** loads after that, on an idle callback: 1080p on a high tier
  with a big screen and a fast link, 720p (`morning-720.mp4`, 250 KB, made by
  `npm run backdrop:prep -- --renditions`) otherwise, and not at all on Data Saver or a
  2G link — the poster is its first frame, so the room is still there. **Never from
  `connection.downlink` alone**: Chrome reports ~1.5 Mbps on a fresh session (round trip
  0, nothing measured yet) while rating the link "4g", and an "under 2 Mbps → no video"
  rule silently took the room clip away on a fast laptop.

### Device tiers (`bootScript.ts`, before first paint)

| Tier | When | Gets |
|---|---|---|
| low | Data Saver; 2G/3G; ≤2 GB; ≤2 cores; software GL (SwiftShader, llvmpipe, Basic Render); max texture < 4096 | **plain edition** |
| mid | ≤4 GB; ≤4 cores | DPR ≤1.25, `m` pages, plain kraft (`uDetail` 0), 720p clip |
| high | otherwise | everything |

Every signal is optional (Safari/Firefox expose no memory or connection) and a missing one
never lowers a tier. **The machine decides the tier; the connection only decides
downloads**: a link under 5 Mbps **with** a round trip ≥ 300 ms sets `data-np-net="slow"`
(2x pages, the light clip) on whatever tier the machine earned. Both conditions, because
Chrome's speed estimate starts low on a fresh session with a round trip of 0 — on the
downlink alone a 28-core laptop on good wifi was read as slow. **WebGL2 is required** — three.js is WebGL2-only since r163; the old
check accepted WebGL1 and would have shown a blank canvas.

### Watchdogs and fallbacks (`NewspaperShell.tsx`, `readingMode.ts` `failScene`)

Anything the scene cannot recover from switches to the plain edition **on the page being
read**. Only the DETERMINISTIC failures — a render error (`SceneBoundary`), a missing
manifest or preview (a missing FULL size just keeps the preview) — are remembered in
`sessionStorage["clubhub:scene-failed"]`, because a reload would only hit them again.
The rest are **transient** (`TRANSIENT_FAILURES` in `readingMode.ts`) — this page goes
plain, a reload tries 3D again:

- a lost WebGL context (a driver reset recovers; a new page gets a new context). **Our own
  teardown is not one**: R3F calls `forceContextLoss()` ~500 ms after the Canvas unmounts,
  which fires the same event, so `NewspaperScene` removes its listener on unmount;
- no first frame within 9 s **of visible time** (60 s under `next dev`, which compiles
  three.js on the first request). A hidden tab draws no frames, so a wall-clock timer
  failed every page opened in a background tab;
- the frame rate: measured in 2-second windows; two slow windows (under 28 fps, or over
  10% hitches) step the scene down to mid at DPR 1. After that it gives way only if the
  rate is **under 18 fps** (`GIVE_UP_FPS`) — a 30 fps scene beats no scene. Windows are in
  SECONDS — the first version counted frames and took ~100 s to rescue a 5 fps machine.

Stored transient flags from earlier builds are deleted on sight by the boot script and
`readingMode.ts`: sessionStorage is copied into tabs opened from a tab, so an old flag
otherwise followed the reader into every new tab.

**The width gate applies only until the scene has been shown.** `MIN_WIDTH` is a cost
judgement, and once a desktop has loaded and is running the scene that cost is paid; a
window narrowing for a moment (DevTools docked to the side, a half-screen snap) used to
tear the scene down. The lead steps (`lead` in the shell) are therefore not tied to width
either — when they were, narrowing dropped the shut-folder step and the folder jumped open.

### Testing

`localStorage["clubhub:force-tier"] = "high" | "mid" | "low"` overrides the device check
and stands the watchdogs down — headless Chrome renders WebGL in software, which is
(correctly) a low tier, so `scene:shot` and `perf:timeline` set it. Add
`localStorage["clubhub:watchdog"] = "on"` to test the watchdogs themselves. The page marks
`performance.mark("np-scene-ready")` when the first frame is up.

### Caching (`public/_headers`)

Hashed files (`/_next/static/*`, `/pages/*.avif`) are immutable for a year; `meta.json` is
always revalidated; fixed-name assets (`/art`, `/brand`, `/colleges`, `/backdrop`, the
icons) are fresh for a day and then served stale-while-revalidate for 30 days. HTML keeps
Pages' default. **Give anything new a hashed name or a rule here** — without one, Pages tells
browsers to re-check it on every visit.

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
