import PageHead from "../PageHead";
import { EventPlate, AnnouncementsPlate } from "../plates/Plates";

/**
 * PAGE 5 — LISTINGS & NOTICES.
 * Stories № 4 (Events) and № 5 (Signal). Both map onto native newspaper
 * furniture: events are the listings column, announcements are public notices.
 */
const LISTINGS: [string, string, string][] = [
  ["Hackathon", "Build Night: Autonomy Sprint", "Sat 18 Jul · 18:00 · Main Lab"],
  ["Tech talk", "What the compiler actually does", "Tue 21 Jul · 17:00 · LT-3"],
  ["Workshop", "CAD for people who hate CAD", "Thu 23 Jul · 16:30 · Studio B"],
  ["Social", "End-of-term dinner", "Fri 24 Jul · 20:00 · The Quad"],
];

export default function Page5Listings() {
  return (
    <>
      <PageHead folio="Page 5" section="Collaboration" rubric="Listings & notices" />

      <div className="np-flow" style={{ paddingTop: "2.2cqw" }}>
        <article className="np-split-57">
          <div className="np-flow-tight">
            <p className="np-micro">№ 4 — Events</p>
            <h2 className="np-head">From hackathon to headcount.</h2>
            <p className="np-body np-dropcap">
              Hackathons, tech talks, workshops, socials — create the event, watch RSVPs count
              themselves. One tap to attend, one tap to back out; the attendee tally is always
              live and never double-counts.
            </p>
            <p className="np-micro" style={{ paddingTop: "0.4em" }}>
              Four event types · idempotent RSVP · live attendee counts
            </p>
          </div>
          <EventPlate />
        </article>

        <hr className="np-rule" />

        <section className="np-split-57">
          <div className="np-flow-tight">
            <p className="np-eyebrow">This week&apos;s listings</p>
            <hr className="np-rule-thin" />
            <dl className="np-listings">
              {LISTINGS.map(([type, title, when]) => (
                <div key={title} className="np-listing">
                  <dt>
                    <span className="np-pill">{type}</span>
                  </dt>
                  <dd>
                    <span className="np-minihead">{title}</span>
                    <span className="np-micro">{when}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="np-flow-tight">
            <p className="np-micro">№ 5 — Signal</p>
            <h3 className="np-subhead">Announcements that reach the right desk.</h3>
            <p className="np-body">
              Global bulletins for the whole club; domain-scoped notes for one team. Members see
              what concerns them and nothing else — signal without the group-chat noise.
            </p>
            <AnnouncementsPlate />
            <p className="np-micro">
              Global requires VP+ · domain posts by leads · visibility by scope
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
