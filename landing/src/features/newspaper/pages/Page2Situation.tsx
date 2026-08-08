import PageHead from "../PageHead";

/**
 * PAGE 2 — THE SITUATION.
 * The investigative page: names the problem before the product appears.
 * Copy ported from features/marketing/ProblemStrip.tsx. The old full-bleed black
 * band becomes a boxed sidebar — a page is now a fixed-width sheet, so `-mx-6`
 * bleed hacks no longer apply, but page 2 still needs its ink weight.
 */
const EXHIBITS: [string, string, string][] = [
  [
    "Exhibit A",
    "Four WhatsApp groups",
    "Announcements drown between memes. Nobody knows which group is canonical, and the freshers were never added to the one that matters.",
  ],
  [
    "Exhibit B",
    "The dying spreadsheet",
    "Attendance, tasks, and “points” live in a sheet three people can edit and one person understands. It was last accurate in September.",
  ],
  [
    "Exhibit C",
    "Invisible work",
    "The people who actually ship get the same certificate as the people who joined for the photo. Effort has no ledger, so it has no reward.",
  ],
];

export default function Page2Situation() {
  return (
    <>
      <PageHead folio="Page 2" section="Culture" rubric="The situation on the ground" />

      <div className="np-flow" style={{ paddingTop: "2.4cqw" }}>
        <h2 className="np-head">Most clubs run on chaos and one exhausted secretary.</h2>

        <p className="np-deck">
          Every campus has the same three failures, and every committee believes theirs is the
          only one. It is not. Filed below, the evidence.
        </p>

        <hr className="np-rule" />

        <div className="np-ruled np-ruled-3">
          {EXHIBITS.map(([no, title, body]) => (
            <div key={no}>
              <p className="np-micro">{no}</p>
              <h3 className="np-subhead" style={{ margin: "0.45em 0 0.35em" }}>
                {title}
              </h3>
              <p className="np-body" style={{ textAlign: "left" }}>
                {body}
              </p>
            </div>
          ))}
        </div>

        <div className="np-split-75" style={{ paddingTop: "1cqw" }}>
          <div className="np-flow-tight">
            <p className="np-eyebrow">The verdict</p>
            <p className="np-body np-dropcap">
              None of this is a people problem. Student committees turn over every twelve months,
              carry no institutional memory, and inherit whatever tooling the last president
              happened to like. The spreadsheet is not the disease; it is the symptom of having
              no system at all. What a club actually needs is the boring infrastructure a company
              takes for granted — a membership roll, an org chart with real permissions, a work
              queue, and a record of who did what.
            </p>
            <p className="np-body">
              That is the whole of Club-Hub. It is not a social network for clubs, and it is not
              another chat app. It is the ledger, the roster, and the rulebook — the parts nobody
              volunteers to maintain by hand.
            </p>
          </div>

          <aside className="np-box-invert np-flow-tight">
            <p className="np-eyebrow">By the numbers</p>
            <hr className="np-rule-thin" style={{ borderColor: "#4a463c" }} />
            <div>
              <div className="np-metric-n" style={{ fontSize: "var(--np-t-h2)" }}>
                4
              </div>
              <p className="np-micro">Group chats the average committee runs in parallel</p>
            </div>
            <div>
              <div className="np-metric-n" style={{ fontSize: "var(--np-t-h2)" }}>
                1
              </div>
              <p className="np-micro">Person who understands the attendance sheet</p>
            </div>
            <div>
              <div className="np-metric-n" style={{ fontSize: "var(--np-t-h2)" }}>
                0
              </div>
              <p className="np-micro">Records that survive the handover in June</p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
