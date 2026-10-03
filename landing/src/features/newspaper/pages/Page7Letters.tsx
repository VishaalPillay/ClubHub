import PageHead from "../PageHead";

/**
 * PAGE 7 — WHO IT'S FOR & HOW TO FILE.
 * The stats band, a three-line answer to "is this for me?", and the "How to file"
 * sidebar (the four steps from sign-up to a scored task).
 *
 * This page used to carry two "letters to the editor" with named presidents. They
 * were invented — fine as set dressing in a mock-up, not on a live page that asks a
 * student to trust it. Real quotes go back in the day there are real ones.
 */
const STATS: [string, string][] = [
  ["7", "Role tiers, explicit powers"],
  ["∞", "Clubs per account"],
  ["100", "Max points per task"],
  ["0", "Spreadsheets required"],
];

const AUDIENCES: [string, string][] = [
  [
    "If you run a club",
    "Stop being the human database. Roles, a join queue and a record that survives the handover.",
  ],
  [
    "If you lead a team",
    "Hand out weighted tasks, post to your own domain, and see who actually ships.",
  ],
  [
    "If you are a member",
    "Find clubs, RSVP in one tap, and have your work counted — publicly, and for good.",
  ],
];

const STEPS: [string, string, string][] = [
  [
    "01",
    "Sign up",
    "Google or email. Sixty seconds, then you’re standing in your portal — no forced setup, no tour.",
  ],
  [
    "02",
    "Create or join",
    "Found a club and you’re its president. Or enter a friend’s invite code, pick a role, and request in.",
  ],
  [
    "03",
    "Organize domains",
    "Carve the club into sub-teams, appoint leads, and let each domain run its own desk.",
  ],
  [
    "04",
    "Ship and score",
    "Weighted tasks pay points into the public ledger. The leaderboard tells the truth at semester’s end.",
  ],
];

export default function Page7Letters() {
  return (
    <>
      <PageHead folio="Page 7" section="Campus" rubric="Who it’s for" />

      <div className="np-flow" style={{ paddingTop: "2.2cqw" }}>
        <div className="np-ruled np-ruled-4">
          {STATS.map(([n, l]) => (
            <div key={l}>
              <div className="np-metric-n" style={{ fontSize: "var(--np-t-h2)" }}>
                {n}
              </div>
              <p className="np-micro" style={{ marginTop: "0.6em" }}>
                {l}
              </p>
            </div>
          ))}
        </div>

        <div className="np-split-75">
          <section className="np-flow">
            <p className="np-eyebrow">Who it&apos;s for</p>
            {AUDIENCES.map(([who, line]) => (
              <figure key={who} className="np-letter">
                <figcaption className="np-byline" style={{ lineHeight: 1.4 }}>
                  {who}
                </figcaption>
                <p className="np-quote" style={{ marginTop: "0.3em", marginBottom: 0 }}>
                  {line}
                </p>
              </figure>
            ))}
          </section>

          <aside className="np-box np-flow-tight">
            <p className="np-eyebrow">How to file</p>
            <hr className="np-rule-thin" />
            {STEPS.map(([num, title, body]) => (
              <div key={num} className="np-step">
                <span className="np-step-no">{num}</span>
                <div>
                  <h4 className="np-minihead">{title}</h4>
                  <p className="np-body" style={{ textAlign: "left", textIndent: 0 }}>
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </aside>
        </div>
      </div>
    </>
  );
}
