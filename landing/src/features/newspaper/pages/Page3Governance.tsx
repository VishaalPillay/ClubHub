import PageHead from "../PageHead";
import { MembersPlate, DomainsPlate } from "../plates/Plates";

/**
 * PAGE 3 — GOVERNANCE & STRUCTURE.
 * Stories № 1 and № 2, ported from features/marketing/FeatureStories.tsx.
 */
export default function Page3Governance() {
  return (
    <>
      <PageHead folio="Page 3" section="Connections" rubric="Governance & structure" />

      <div className="np-flow" style={{ paddingTop: "2.2cqw" }}>
        <article className="np-split-57">
          <div className="np-flow-tight">
            <p className="np-micro">№ 1 — Governance</p>
            <h2 className="np-head">Seven ranks. Zero ambiguity.</h2>
            <p className="np-body np-dropcap">
              From member to president, every rank has explicit powers. Leads propose promotions
              and removals; secretaries authorise them through an action-request queue. Authority
              is granted, logged, and revocable — never assumed.
            </p>
            <p className="np-micro" style={{ paddingTop: "0.4em" }}>
              Propose-then-authorise · action-request queue · role grants capped by rank
            </p>
          </div>
          <MembersPlate />
        </article>

        <hr className="np-rule-thin" />

        <article className="np-split-75">
          <DomainsPlate />
          <div className="np-flow-tight">
            <p className="np-micro">№ 2 — Structure</p>
            <h2 className="np-head">Sub-teams that own their turf.</h2>
            <p className="np-body">
              Split the club into domains — Technical, Management, Creative, or whatever yours
              needs. Leads run their domain&apos;s tasks and announcements; the leaderboard can
              score the whole club or one domain at a time.
            </p>
            <p className="np-micro" style={{ paddingTop: "0.4em" }}>
              Domains are club-defined · leads scoped per domain · filterable everywhere
            </p>
          </div>
        </article>
      </div>
    </>
  );
}
