import PageHead from "../PageHead";
import DashboardPlate from "../plates/DashboardPlate";

/**
 * PAGE 4 — THE LEAGUE TABLE.
 * Story № 3 (Work & Score) given the sports-page treatment: the leaderboard is
 * a league table, the tasks are fixtures. The metaphor is not decoration — this
 * is genuinely how the points ledger reads to a club at semester's end.
 */
const STANDINGS: [string, string, string, string, string][] = [
  ["1", "Dev Patel", "Technical", "24", "1,240"],
  ["2", "Meera Krishnan", "Creative", "19", "980"],
  ["3", "Sana Rao", "Technical", "17", "760"],
  ["4", "Aarav Sharma", "Management", "12", "610"],
  ["5", "Nikhil Menon", "Creative", "9", "455"],
];

export default function Page4League() {
  return (
    <>
      <PageHead folio="Page 4" section="Collaboration" rubric="Work & score" />

      <div className="np-flow" style={{ paddingTop: "2.2cqw" }}>
        <h2 className="np-head">Work is worth points. Points are public.</h2>

        <div className="np-split-57">
          <div className="np-flow-tight">
            <p className="np-body np-dropcap">
              Tasks carry a weight — up to 100 points. Completion pays every assignee through an
              append-only ledger, and the leaderboard settles who actually carried the semester.
              Points are never clawed back; the record stands.
            </p>
            <p className="np-micro" style={{ paddingTop: "0.4em" }}>
              Weighted tasks · append-only points ledger · live leaderboard
            </p>
          </div>
          {/* The dashboard is better art for this story than a bare task list —
              it shows weighted tasks and the leaderboard they feed, together. */}
          <DashboardPlate />
        </div>

        <hr className="np-rule" />

        <section className="np-flow-tight">
          <div className="np-runhead" style={{ padding: 0 }}>
            <span className="np-eyebrow">Standings</span>
            <span className="np-micro">Robotics Society</span>
            <span className="np-micro np-runhead-right">Michaelmas term</span>
          </div>

          <table className="np-table">
            <thead>
              <tr>
                <th scope="col">Pos</th>
                <th scope="col">Member</th>
                <th scope="col">Domain</th>
                <th scope="col" className="np-num">
                  Done
                </th>
                <th scope="col" className="np-num">
                  Pts
                </th>
              </tr>
            </thead>
            <tbody>
              {STANDINGS.map(([pos, name, domain, done, pts]) => (
                <tr key={name}>
                  <td className="np-num">{pos}</td>
                  <td>
                    <strong>{name}</strong>
                  </td>
                  <td>{domain}</td>
                  <td className="np-num">{done}</td>
                  <td className="np-num">
                    <strong>{pts}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="np-micro">
            Ledger is append-only · reopening a task never revokes points · filter by domain
          </p>
        </section>
      </div>
    </>
  );
}
