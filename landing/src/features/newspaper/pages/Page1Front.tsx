import FrontTeasers from "../FrontTeasers";
import Masthead from "../Masthead";
import { FRONT_ART, HERO_SHAPE } from "../frontArt";

/**
 * PAGE 1 — THE FRONT PAGE.
 *
 * The first screen answers three questions before anyone scrolls: the headline says what it is
 * and what for, the line under it says why a student should care, and the "Available at" ticker
 * above shows it is already at their college. The four doors under the fold of the hero are the
 * rest of the paper in miniature. (There are deliberately no buttons on the sheet: in the 3D
 * view a page is a texture, so a button on it cannot be pressed — Login and Register live in
 * the fixed bar.)
 *
 * ── Layout: the type wraps the picture ──────────────────────────────────────
 * The collage is a torn-paper cut-out with a large empty top-left. It is FLOATED right and
 * `shape-outside` follows its own silhouette, so the headline and the line beneath run
 * along its silhouette — across the empty corner, narrowing where the building is. (The
 * silhouette is an explicit polygon computed from the picture's alpha by gen-front-art.mjs,
 * not `url()`: an image-derived shape silently does nothing if the image is late.) That is
 * what lets the picture be as big as the page can hold without ever touching a letter, and it
 * is the typographic move a newspaper would make. It is also why the figure comes BEFORE the
 * text in the source: a float only displaces what follows it.
 *
 * The picture is supplied artwork (scripts/gen-front-art.mjs); nothing is drawn over it.
 *
 * Fixed-height sheet: any added line here is a line taken from the teaser row.
 * `pages:render` fails on overflow.
 */
export default function Page1Front() {
  const hero = FRONT_ART.hero;

  return (
    <>
      <Masthead />

      <div className="np-hero">
        {/* The shape arrives as a custom property so the stylesheet can still switch it off on
            a narrow sheet — an inline `shape-outside` would beat any rule written there. */}
        <figure className="np-hero-art" style={{ "--hero-shape": HERO_SHAPE } as React.CSSProperties}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, art pre-sized by gen-front-art */}
          <img
            src={hero.src}
            width={hero.w}
            height={hero.h}
            alt="A torn-paper collage of a campus clock tower among trees, with newsprint and red paper scraps."
            draggable={false}
          />
        </figure>

        <h2 className="np-hero-head">
          Your whole club, <span className="np-hero-red">in one place.</span>
        </h2>

        <p className="np-deck np-hero-deck">
          Find clubs worth joining across campuses, and get credit for the work you actually do,
          with no group chat or spreadsheet in sight.
        </p>
      </div>

      <FrontTeasers />
    </>
  );
}
