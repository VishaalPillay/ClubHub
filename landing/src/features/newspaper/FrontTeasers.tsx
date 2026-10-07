"use client";

import { useNewspaper } from "./NewspaperContext";
import { FRONT_ART, type FrontArtKey } from "./frontArt";

/**
 * The front page's bottom teaser row — `01 DISCOVER · 02 CONNECT · 03 ENGAGE · 04 LEAD`.
 * Table of contents and navigation in one: each card jumps to the page that tells that
 * story (in plain mode — in the 3D view the page is a texture and cannot be pressed), and
 * carries one of the supplied collage illustrations. The numbers are the order
 * here, NOT page numbers — Discover lives on page 6 (the directory).
 */
/** [page index, label, blurb, art] */
const TEASERS: [number, string, string, FrontArtKey][] = [
  [5, "Discover", "Browse clubs across interests, or join with a code.", "discover"],
  [2, "Connect", "Meet members, join sub-teams and be part of a larger community.", "connect"],
  [3, "Engage", "Attend events, take up tasks and earn points on the leaderboard.", "engage"],
  [4, "Lead", "Create events, post announcements and grow your club.", "lead"],
];

export default function FrontTeasers() {
  const { goTo } = useNewspaper();

  return (
    <div className="np-teasers">
      {TEASERS.map(([page, title, body, art], i) => {
        const a = FRONT_ART[art];
        return (
          <button key={title} type="button" className="np-teaser" onClick={() => goTo(page)}>
            <span className="np-teaser-no">{String(i + 1).padStart(2, "0")}</span>
            <span className="np-teaser-title">{title}</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- static export, art pre-sized by gen-front-art */}
            <img
              className="np-teaser-art"
              src={a.src}
              width={a.w}
              height={a.h}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            <span className="np-teaser-body">{body}</span>
          </button>
        );
      })}
    </div>
  );
}
