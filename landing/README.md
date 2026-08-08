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

## The scroll contract — Lenis owns the scroll position

Paper mode runs [Lenis](https://github.com/darkroomengineering/lenis) in its **native-scroll** mode
(`src/features/newspaper/useLenis.ts`): it intercepts the wheel, applies a lerp, and writes the
result to the real `scrollTop`. That choice is load-bearing. `.np-stage` is `position: sticky`,
which a transform-based smooth-scroll breaks outright, and because true scroll position still moves,
framer's `useScroll` — and therefore `pos` and every curve in `useSheetMotion.ts` — needs no changes
at all.

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
| `steps` | 4 | 7 |
| Leaf `k` turns over | `pos [k, k+1]` | `pos [2k, 2k+1]`, then a step with no turn |

`turnStart` in `NewspaperSheet` is what reconciles them, and `useSheetMotion` takes it in place of a
raw index. Everything else — the corners, `SectionRule`, `FrontTeasers`, `PageControls`, deep links
— speaks in **page numbers**; `goTo` converts. Never make a caller do that conversion itself.

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
| `Table.tsx` | A box with real thickness plus legs, sized only just bigger than an open spread. That sizing is the point: a realistically large table puts its edges outside the frame and the scene goes back to reading as an infinite floor. |
| `Leaf.tsx` | Four bound leaves, two pages each. The turn is an arc-length-preserving vertex-shader curl, so the paper bends without stretching. |
| `Drop.tsx` | The front page falls flat onto the table, tips and levels out late, and is braked by an air cushion over the last 20%. Hands over on any key, click or scroll — no auto-open, no prompt. |
| `Dust.tsx` | A 140-point puff at the paper's edge on impact. Drag is integrated analytically in the vertex shader; the sprite is `gl_PointCoord`, so no texture. |
| `Backdrop.tsx` | The room. Procedural by default; see below. |

**Every shader here must end with `#include <colorspace_fragment>`.** three
converts hex colours to linear on construction and decodes sRGB textures on
sample, but a raw `ShaderMaterial` gets no re-encode on the way out — without it
the linear value is written straight into an sRGB framebuffer and the whole scene
renders dark and muddy. This was a real bug that survived several rounds of
tuning before being spotted.

Two other traps worth knowing, both of which produced visible artefacts:

- **Hiding a subtree defers its shader compile.** three skips invisible objects
  entirely, so `visible={false}` means the program is not built until the frame
  it first appears — which was exactly the hand-off frame, and stalled it.
  `Precompile` in `NewspaperScene.tsx` forces the build up front. `Dust` stays
  visible and parks itself past its own lifetime for the same reason.
- **The resting sheet must be dead flat.** A residual sag arched the page while
  the contact shadow sat at a fixed height, so the shadow quad sliced through the
  arch and painted a dark band down each side.

### Scripts

```bash
npm run pages:render                  # rasterise the 8 pages to public/pages/*.avif
npm run scene:shot -- <step>          # screenshot the scene at a scroll position
npm run scene:shot -- delivery <ms>   # screenshot the drop, N ms after load
npm run backdrop:prep -- <photo>      # turn any room photo into the backdrop
```

`scene:shot` exists because a WebGL scene cannot be checked by reading the DOM —
camera framing, the curl, which texture landed on which face and the lighting are
all invisible to `getComputedStyle`.

### The backdrop

Blurred backgrounds are nearly free: at this blur a 640px image is
indistinguishable from 4K, so the output is ~15–20KB. The blur also makes the
*projection* irrelevant, which is why an ordinary photograph works where an
equirectangular capture would normally be required.

`npm run backdrop:prep -- <photo>` downscales, blurs, tones down and encodes it;
then set `BACKDROP_SRC` in `Backdrop.tsx`. Until that is done the shader draws its
own dark room, so nothing is blocked and no 404 is requested. Pick something warm
and dim — a study, a library, a café. Avoid bright windows and hard highlights:
they pull the eye off the newspaper, which is the one thing on screen that has to
be read.

### Scope

First-person hands and the coffee cup were planned and are **cancelled**. The
landing page ends at: a newspaper on a table, in a blurred room, that falls into
place and turns properly.

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
