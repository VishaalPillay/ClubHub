import { LOGIN_URL, REGISTER_URL } from "../links";
import PageHead from "../PageHead";

/**
 * PAGE 8 — THE BACK PAGE.
 * "Ask the editor" (the FAQ, still a native <details> accordion — zero JS and
 * keyboard-accessible out of the box), the subscription-rates box, press notes,
 * the closing advertisement, and the colophon.
 *
 * Copy ported from features/marketing/{FAQ,ClosingCTA,MarketingFooter}.tsx.
 */
const FAQ_ITEMS: [string, string][] = [
  [
    "Is ClubHub free?",
    "Yes. Creating clubs, joining clubs, tasks, events, announcements, and the leaderboard are free for students. No credit card at any point.",
  ],
  [
    "Who can create a club?",
    "Any signed-in student. The founder is automatically the club’s president and picks which of the seven ranks the club will use.",
  ],
  [
    "How do people join my club?",
    "Share your club’s invite code, or let students find you in the public directory. Joiners request a role — your secretaries approve or decline from a queue.",
  ],
  [
    "Can I be in more than one club?",
    "Yes — that’s the point. One account, many clubs, like GitHub with repositories. Your identity is global; your rank and points are separate inside each club.",
  ],
  [
    "What exactly are domains?",
    "Sub-teams — Technical, Management, Creative, anything you define. Tasks, announcements, and leaderboard filters can all be scoped to a domain, and leads run theirs.",
  ],
  [
    "Does it work on my phone?",
    "Not yet. ClubHub is built for a laptop screen for now, and the small-screen layout is still being drawn. Everything here is for the browser on a laptop or desktop.",
  ],
  [
    "Do points ever expire or get taken back?",
    "No. The points ledger is append-only: once earned, always yours. Reopening a task never claws points back — the record stands, by design.",
  ],
];

const PRESS_NOTES: [string, string][] = [
  ["Tenancy", "Every request names its club, so a forged path cannot write into another one."],
  ["Authority", "You can never grant a rank at or above your own."],
  ["Sessions", "Short-lived tokens. Reuse a revoked one and every session you have ends."],
];

export default function Page8Colophon() {
  return (
    <>
      <PageHead folio="Page 8" section="Campus" rubric="The back page" />

      <div className="np-flow" style={{ paddingTop: "2.2cqw" }}>
        <div className="np-split-75">
          <section className="np-flow-tight">
            <p className="np-eyebrow">Ask the editor</p>
            <hr className="np-rule" />
            {FAQ_ITEMS.map(([q, a], i) => (
              <details key={q} open={i === 0} className="np-faq">
                <summary>
                  <span className="np-faq-glyph" aria-hidden="true" />
                  {q}
                </summary>
                <p className="np-body" style={{ textAlign: "left", textIndent: 0 }}>
                  {a}
                </p>
              </details>
            ))}
          </section>

          <div className="np-flow">
            <aside className="np-box np-flow-tight">
              <p className="np-eyebrow">Subscription rates</p>
              <hr className="np-rule-thin" />
              <div className="np-metric-n" style={{ fontSize: "var(--np-t-h2)" }}>
                Free
              </div>
              <p className="np-body" style={{ textAlign: "left", textIndent: 0 }}>
                While in beta, every feature in this edition is free for students. No credit card
                at any point.
              </p>
            </aside>

            <aside className="np-box-invert np-flow-tight">
              <p className="np-eyebrow">Press notes — how this paper is set</p>
              <hr className="np-rule-thin" style={{ borderColor: "#4a463c" }} />
              {PRESS_NOTES.map(([k, v]) => (
                <div key={k}>
                  <p className="np-micro">{k}</p>
                  <p className="np-body" style={{ textAlign: "left", textIndent: 0 }}>
                    {v}
                  </p>
                </div>
              ))}
            </aside>
          </div>
        </div>

        <hr className="np-rule" />

        <section className="np-advert">
          <p className="np-eyebrow">Final edition</p>
          <h2 className="np-lead-head" style={{ fontSize: "var(--np-t-h2)" }}>
            Your club deserves a front page.
          </h2>
          <a href={REGISTER_URL} className="np-cta np-cta-red">
            Join the network
          </a>
        </section>

        <hr className="np-rule-double" />

        <footer className="np-colophon">
          <span className="np-micro">© 2026 ClubHub Editorial · Authored by Vishaal Pillay</span>
          <nav className="np-colophon-nav" aria-label="Footer">
            <a href={LOGIN_URL} className="np-micro">
              Sign in
            </a>
            <a href={REGISTER_URL} className="np-micro">
              Register
            </a>
          </nav>
        </footer>
        <p className="np-micro" style={{ marginTop: "0.8cqw" }}>
          College names and marks belong to their institutions and are shown only to say where
          students can sign up.
        </p>
      </div>
    </>
  );
}
