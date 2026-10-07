import { COLLEGES } from "./colleges";
import { COLLEGE_LOGOS } from "./collegeLogos";

/**
 * "AVAILABLE AT" and a slow ticker of the institutions students can pick when they sign up.
 *
 * Sits in the masthead between the two heavy rules, where the section links used to be
 * (they live on in the fixed bar at the bottom of the screen).
 *
 * Two renderers, one design:
 *   · here, as HTML, for plain mode and for the baked page texture. The list is rendered
 *     twice and the track slides left by exactly half its width, which loops with no jump;
 *     the second copy is `aria-hidden` so a screen reader meets each name once.
 *   · in the 3D scene, as a live canvas laid over this element's rectangle
 *     (scene/collegeStrip.ts). The page texture is a photograph, so on its own it would be
 *     a still frame; `pages:render` records this window's box in `public/pages/meta.json`
 *     and the scene animates just that patch. The two must stay visually in step —
 *     proportions are in em of the chip text — but the canvas fully covers the baked
 *     version, so any drift shows only if the live strip fails to start.
 *
 * Server component: nothing here needs the client.
 */
export default function CollegeStrip() {
  const row = (copy: number) =>
    COLLEGES.map((c) => {
      const logo = COLLEGE_LOGOS[c.id];
      // A wordmark logo already says the name; only repeat it when there is no logo to say it.
      const showName = !(logo && c.wordmark);
      return (
        <li
          key={`${copy}-${c.id}`}
          className={logo ? "np-college" : "np-college np-college--bare"}
          aria-hidden={copy > 0 ? true : undefined}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- static export, logos pre-sized by gen-college-logos
            <img
              className="np-college-logo"
              src={logo.src}
              width={logo.w}
              height={logo.h}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          ) : null}
          {showName ? (
            <span className="np-college-name">{c.short}</span>
          ) : (
            <span className="np-college-name np-college-name--sr">{c.short}</span>
          )}
        </li>
      );
    });

  return (
    <section className="np-colleges" aria-label="Available at these institutions">
      <p className="np-colleges-label">Available at</p>
      <div className="np-colleges-window" data-college-window>
        <ul className="np-colleges-track">
          {row(0)}
          {row(1)}
        </ul>
      </div>
    </section>
  );
}
