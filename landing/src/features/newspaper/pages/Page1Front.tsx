import { LOGIN_URL, REGISTER_URL } from "../links";
import Masthead from "../Masthead";
import FrontTeasers from "../FrontTeasers";
import Photo from "../Photo";

/**
 * PAGE 1 — THE FRONT PAGE.
 * Nameplate band, the lead story, the front-page photograph, and the teaser row.
 * Copy ported from features/marketing/Hero.tsx and the old utility strip.
 */
export default function Page1Front() {
  return (
    <>
      <Masthead />

      <div className="np-split-57" style={{ paddingTop: "3cqw" }}>
        <div className="np-flow">
          <p className="np-eyebrow">The lead story</p>

          <h2 className="np-lead-head">Where passion finds its people.</h2>

          <hr className="np-rule" style={{ width: "38%" }} />

          <p className="np-deck">
            Club-Hub is the operating system student clubs never had. Memberships, seven-tier
            roles, sub-teams, weighted tasks, a public points economy, events and announcements
            — one account, many clubs.
          </p>

          <div className="np-ctas">
            <a href={REGISTER_URL} className="np-cta">
              Start a club — it&apos;s free
            </a>
            <a href={LOGIN_URL} className="np-cta-ghost">
              Sign in
            </a>
          </div>

          <p className="np-micro">
            No credit card · Google or email · 60 seconds to your first club
          </p>
        </div>

        {/* One big picture, as on the reference broadsheet. A second plate here
            overflowed the fixed sheet height by ~330px in paper mode. */}
        <div className="np-flow">
          <Photo
            caption="The quad at enrolment week. Every club on campus, competing for the same forty minutes of a fresher's attention."
            crop="tall"
            priority
          />
        </div>
      </div>

      <hr className="np-rule" style={{ marginTop: "3cqw" }} />
      <FrontTeasers />
    </>
  );
}
