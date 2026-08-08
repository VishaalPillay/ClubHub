import PageHead from "../PageHead";
import { DirectoryPlate } from "../plates/Plates";

/**
 * PAGE 6 — THE MASTHEAD BOX.
 * The seven-rung role ladder, ported from features/marketing/RolesLadder.tsx and
 * reflowed vertical (a page is portrait, so the old `lg:grid-cols-7` becomes a
 * column of seven rules). Story № 6 (Discovery) runs in the outer column.
 *
 * A role ladder *is* a newspaper masthead box — the closest 1:1 fit in the set.
 * Marketing captions only; the RBAC source of truth stays app/core/permissions.py.
 */
const RUNGS: [string, string, string][] = [
  ["R1", "Member", "Sees the club, works own-domain tasks, updates own status."],
  ["R2", "Associate", "Assigns tasks inside their own domain."],
  ["R3", "Lead", "Creates tasks, posts domain announcements, proposes promotions."],
  ["R4", "Joint Secretary", "Approves join and action requests; creates events."],
  ["R5", "Secretary", "Same authority, senior desk — promotes up to lead."],
  ["R6", "Vice-President", "Shapes domains, edits the club, posts global bulletins."],
  ["R7", "President", "Full control. Auto-assigned to the founder."],
];

export default function Page6Masthead() {
  return (
    <>
      <PageHead folio="Page 6" section="Campus" rubric="Who signs off" />

      {/* 7fr for the ladder — seven rungs of rank + description need the wider
          column; the discovery story reads fine in the narrower 5fr. */}
      <div className="np-split-75" style={{ paddingTop: "2.2cqw" }}>
        <div className="np-flow-tight">
          <p className="np-eyebrow">The masthead — seven ranks, low to high</p>
          <h2 className="np-head">Everyone knows who signs off.</h2>
          <p className="np-body">
            Each rank inherits everything below it and adds one clear power. Presidents choose
            which ranks their club actually uses.
          </p>

          <hr className="np-rule" style={{ marginTop: "0.6em" }} />

          <ol className="np-ladder">
            {RUNGS.map(([no, title, body], i) => (
              <li key={no} className={i === RUNGS.length - 1 ? "np-rung np-rung--top" : "np-rung"}>
                <span className="np-rung-no">{no}</span>
                <span className="np-rung-title">{title}</span>
                <span className="np-rung-body">{body}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="np-flow-tight">
          <p className="np-micro">№ 6 — Discovery</p>
          <h3 className="np-subhead">One account. Every club on campus.</h3>
          <p className="np-body np-dropcap">
            Join with a shareable code, or browse the public directory across institutions. Like
            GitHub for repositories: your identity is global, and you can belong to — or found —
            as many clubs as you can handle.
          </p>
          <p className="np-micro" style={{ paddingBottom: "0.4em" }}>
            Shareable join codes · public directory · join requests with roles
          </p>
          <DirectoryPlate />
        </div>
      </div>
    </>
  );
}
