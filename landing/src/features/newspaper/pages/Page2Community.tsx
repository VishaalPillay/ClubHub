import { CAMPUS_SHAPE, type FrontArtKey } from "../frontArt";
import { PICKER_COLLEGES, PICKER_REGIONS } from "../pickerStats";
import { Art, Icon, Row, Tags, TopStrip, type IconName } from "../Showcase";

/**
 * PAGE 2 — MORE THAN JUST CLUBS.
 *
 * The first half of the showcase (page 3 is the second): a hero, a four-figure band, and the
 * featured clubs. It follows the supplied mock-up, which put all of it on one sheet and was too
 * cramped to read; the events, student voices and closing line now run over onto page 3.
 *
 * Three deliberate differences from the mock-up, all because a live page must not state what the
 * product cannot back up:
 *
 *   · The figures are real. The mock-up's "100+ active clubs / 15,000+ students" would be claims
 *     about usage a pre-launch product does not have. These are facts: the sign-up picker's
 *     college and state counts (generated from the picker itself, see gen-college-logos.mjs), the
 *     four event types the API accepts, and one account serving every club.
 *   · The clubs are labelled "Sample". They ARE examples; swap the data and the label together.
 *   · No buttons or arrows. In the 3D view a page is a texture and cannot be pressed, so
 *     "Explore all" and the circled arrows would point nowhere.
 *
 * The hero copy wraps the campus collage's silhouette exactly as page 1 does (shape-outside, a
 * polygon computed from the picture by gen-front-art.mjs — see Page1Front for why not `url()`).
 *
 * Fixed-height sheet, and the leftover height is shared out between the sections (`.np-p2-grow`)
 * rather than left as a blank band at the foot. `pages:render` fails on overflow.
 */

const colleges = `${Math.floor(PICKER_COLLEGES / 50) * 50}+`;

const STATS: [IconName, string, string][] = [
  ["cap", colleges, "Colleges listed"],
  ["pin", String(PICKER_REGIONS), "States and UTs"],
  ["calendar", "4", "Event types"],
  ["user", "1", "Account, all clubs"],
];

const CLUBS: [FrontArtKey, string, string[]][] = [
  ["clubs-1", "Tech Club", ["Build", "Learn", "Innovate"]],
  ["clubs-2", "Photography Club", ["Capture", "Create", "Exhibit"]],
  ["clubs-3", "Fine Arts Club", ["Art", "Design", "Express"]],
  ["clubs-4", "Social Impact Club", ["Serve", "Lead", "Create Change"]],
];

export default function Page2Community() {
  return (
    <>
      <TopStrip edition="02" />

      <div className="np-p2-hero np-p2-grow">
        <div className="np-p2-hero-in">
          <figure
            className="np-p2-art"
            style={{ "--campus-shape": CAMPUS_SHAPE } as React.CSSProperties}
          >
            <Art k="campus" alt="Five students laughing around a laptop, in a torn-paper collage." />
          </figure>

          <h2 className="np-p2-head">
            More than <span className="np-p2-red">just clubs</span>
          </h2>
          <p className="np-deck">
            A thriving campus ecosystem where students come together to learn, create, collaborate
            and grow.
          </p>
        </div>
      </div>

      <div className="np-p2-stats">
        {STATS.map(([icon, n, label]) => (
          <div key={label} className="np-p2-stat">
            <Icon name={icon} />
            <div>
              <div className="np-p2-stat-n">{n}</div>
              <div className="np-p2-stat-l">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <Row
        kicker="Featured clubs"
        heading={
          <>
            Find your <span className="np-p2-red">type of people.</span>
          </>
        }
        body="From tech and entrepreneurship to arts, culture and social impact: there's a club for everyone."
      >
        <div className="np-p2-cards np-p2-cards--4">
          {CLUBS.map(([k, title, tags]) => (
            <div key={k} className="np-p2-card">
              <Art k={k} className="np-p2-card-art" />
              <span className="np-p2-card-title">{title}</span>
              <Tags tags={tags} />
            </div>
          ))}
        </div>
      </Row>
    </>
  );
}
