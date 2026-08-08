import PageHead from "../PageHead";

/**
 * PAGE 7 — LETTERS & HOW TO FILE.
 * Testimonials become Letters to the Editor; the stats band becomes a boxed
 * "By the numbers" figure; HowItWorks becomes the "How to file" sidebar.
 * Copy ported from features/marketing/Testimonials.tsx and HowItWorks.tsx.
 */
const STATS: [string, string][] = [
  ["7", "Role tiers, explicit powers"],
  ["∞", "Clubs per account"],
  ["100", "Max points per task"],
  ["0", "Spreadsheets required"],
];

const LETTERS: [string, string, string][] = [
  [
    "We replaced four WhatsApp groups and a dying spreadsheet in one afternoon. The leaderboard did more for attendance than a year of reminders.",
    "Aarav Sharma",
    "President, Robotics Society",
  ],
  [
    "For the first time the quiet people who do the actual work have a number next to their name. That changed who we promoted.",
    "Meera Krishnan",
    "Vice-President, Design Collective",
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
      <PageHead folio="Page 7" section="Campus" rubric="Letters to the editor" />

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
            <p className="np-eyebrow">Letters to the editor</p>
            <hr className="np-rule" />
            {LETTERS.map(([quote, who, role]) => (
              <figure key={who} className="np-letter">
                <blockquote className="np-quote">“{quote}”</blockquote>
                <figcaption className="np-flow-tight">
                  <span className="np-byline">{who}</span>
                  <span className="np-micro">{role}</span>
                </figcaption>
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
