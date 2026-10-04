import type { FrontArtKey } from "../frontArt";
import { Art, Icon, Row, Tags, TopStrip, type IconName } from "../Showcase";

/**
 * PAGE 3 — EVENTS AND VOICES.
 *
 * The second half of the showcase (page 2 is the first): upcoming events, student voices, and the
 * closing line. This page used to be "Governance & Structure" (the seven ranks and the domains);
 * that content was removed on request, and the ranks still have their own page (6).
 *
 * The same three departures from the mock-up as page 2 apply, for the same reason: the events and
 * the quotes are labelled "Sample" (nobody is quoted and no event is scheduled; replace the data
 * and the labels together), and there is no "Join ClubHub" button or arrows, because a page in
 * the 3D view is a texture and cannot be pressed.
 *
 * The quotes are live text on a CSS torn-paper note, with only the person kept from the art:
 * painted into the picture the handwriting would be ~6px tall at card size. The mock-up's closing
 * line of copy is dropped, because the four pillars beside it say exactly that.
 */

const EVENTS: [FrontArtKey, string, string[], string][] = [
  ["events-1", "AI Workshop", ["Tech Club", "Workshop"], "Oct 12"],
  ["events-2", "Open Mic Night", ["Cultural Club", "Event"], "Oct 18"],
  ["events-3", "HackVerse 2026", ["Coding Club", "Competition"], "Oct 25"],
];

const VOICES: [FrontArtKey, string, string, string][] = [
  [
    "voices-1",
    "Met my closest friends through ClubHub. It\u2019s more than just events; it\u2019s a family.",
    "Aishwarya S.",
    "2nd Year, CSE",
  ],
  [
    "voices-2",
    "Got to lead, learn and grow. ClubHub makes student life so much richer.",
    "Nikhil B.",
    "3rd Year, ECE",
  ],
  [
    "voices-3",
    "From events to real opportunities, this platform brings everything together.",
    "Vishaal P.",
    "2nd Year, CSE",
  ],
];

const CLOSING: [IconName, string][] = [
  ["bolt", "Discover Clubs"],
  ["users", "Meet People"],
  ["calendar", "Attend Events"],
  ["trophy", "Grow Together"],
];

export default function Page3Happening() {
  return (
    <>
      <TopStrip edition="03" />

      <Row
        kicker="Upcoming events"
        heading={
          <>
            Always something <span className="np-p2-red">happening.</span>
          </>
        }
        body="Workshops, competitions, meetups, cultural fests and more: never miss what's next."
      >
        <div className="np-p2-cards np-p2-cards--3">
          {EVENTS.map(([k, title, tags, date]) => (
            <div key={k} className="np-p2-card">
              <Art k={k} className="np-p2-card-art" alt={`${date}.`} />
              <span className="np-p2-card-title">{title}</span>
              <Tags tags={tags} />
            </div>
          ))}
        </div>
      </Row>

      <Row
        kicker="Student voices"
        quote
        heading={
          <>
            &ldquo;ClubHub helped me find a community that truly{" "}
            <span className="np-p2-red">feels like home.&rdquo;</span>
          </>
        }
        body="Friendships and opportunities found through campus clubs."
      >
        <div className="np-p2-cards np-p2-cards--3">
          {VOICES.map(([k, quote, who, role]) => (
            <figure key={k} className="np-voice">
              <Art k={k} className="np-voice-art" />
              <blockquote className="np-voice-note">
                <span className="np-voice-mark" aria-hidden="true">
                  &ldquo;
                </span>
                <p>{quote}</p>
                <footer>
                  <b>{who}</b> {role}
                </footer>
              </blockquote>
            </figure>
          ))}
        </div>
      </Row>

      <section className="np-p2-close np-p2-grow">
        <h3 className="np-p2-sect np-p2-sect--big">
          Be part of <span className="np-p2-red">a bigger story.</span>
        </h3>
        <ul className="np-p2-pillars">
          {CLOSING.map(([icon, label]) => (
            <li key={label}>
              <Icon name={icon} />
              <span>{label}</span>
            </li>
          ))}
        </ul>
        <Art k="plane" className="np-p2-plane" />
      </section>
    </>
  );
}
