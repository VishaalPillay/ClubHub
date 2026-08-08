"use client";

import { useNewspaper } from "./NewspaperContext";

/**
 * The front page's bottom teaser row — `02 DISCOVER · 03 CONNECT · 04 ENGAGE ·
 * 05 LEAD`, straight from the reference broadsheet. The numbers are the page
 * numbers they jump to, so the row is both a table of contents and navigation.
 */
/** [page index, label, blurb] — sequential 02…05, as on the reference broadsheet. */
const TEASERS: [number, string, string][] = [
  [1, "Discover", "Browse every club on campus, or start your own in sixty seconds."],
  [2, "Connect", "Seven ranks, sub-teams, and a join queue that runs itself."],
  [3, "Engage", "Weighted tasks pay points. The leaderboard settles the argument."],
  [4, "Lead", "Events, bulletins, and the desks they are meant to reach."],
];

export default function FrontTeasers() {
  const { goTo } = useNewspaper();

  return (
    <div className="np-teasers">
      {TEASERS.map(([page, title, body]) => (
        <button key={title} type="button" className="np-teaser" onClick={() => goTo(page)}>
          <span className="np-micro">{String(page + 1).padStart(2, "0")}</span>
          <span className="np-minihead">{title}</span>
          <span className="np-teaser-body">{body}</span>
          <span className="np-teaser-arrow" aria-hidden="true">
            →
          </span>
        </button>
      ))}
    </div>
  );
}
