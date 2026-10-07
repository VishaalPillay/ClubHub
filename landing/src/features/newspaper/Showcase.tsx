import type { ReactNode } from "react";
import { FRONT_ART, type FrontArtKey } from "./frontArt";

/**
 * The parts pages 2 and 3 are built from: the furniture strip, a picture, a row of tags, the red
 * section label, an icon, and a "Row" (a pitch above a set of cards). Server components.
 *
 * Pages 2 and 3 are one showcase set across a spread, and share these so a row on one looks
 * exactly like a row on the other.
 */

/** The strip across the top of a showcase page. `edition` is the page's number, as on the front. */
export function TopStrip({ edition }: { edition: string }) {
  return (
    <div className="np-topstrip">
      {["Est. 2026", "The Club Operations Paper", `Edition ${edition}`].map((t) => (
        <span key={t} className="np-micro">
          {t}
        </span>
      ))}
    </div>
  );
}

/** One of the pictures made by gen-front-art.mjs, with its intrinsic size so the box is reserved. */
export function Art({ k, className, alt = "" }: { k: FrontArtKey; className?: string; alt?: string }) {
  const a = FRONT_ART[k];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export, art pre-sized by gen-front-art
    <img
      className={className}
      src={a.src}
      width={a.w}
      height={a.h}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}

/**
 * The mock-up sets these as little pills. At card width three pills cannot share a line at a
 * readable size, so they stack and cost a card its height; one wrapping line of text with a dot
 * between does the same job in a third of the room.
 */
export function Tags({ tags }: { tags: string[] }) {
  return (
    <span className="np-p2-tags">
      {tags.map((t) => (
        <span key={t} className="np-p2-tag">
          {t}
        </span>
      ))}
    </span>
  );
}

/** "Featured clubs" and, beside it, the word that says these are examples. */
export function Kicker({ children, sample = true }: { children: string; sample?: boolean }) {
  return (
    <p className="np-eyebrow np-p2-kicker">
      {children}
      {sample ? <span className="np-p2-sample">Sample</span> : null}
    </p>
  );
}

/**
 * A showcase row: the section label, a heading and a line of copy side by side across the top,
 * then the cards across the full width underneath. Stacked rather than pitch-beside-cards so the
 * cards get the whole sheet to be as large as they can; the leftover height is shared out between
 * rows (see `.np-p2-row`), so a short page breathes instead of leaving a blank band.
 */
export function Row({
  kicker,
  heading,
  body,
  quote = false,
  children,
}: {
  kicker: string;
  heading: ReactNode;
  body: string;
  /** The heading is a long pull-quote and is set smaller. */
  quote?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="np-p2-row">
      <div className="np-p2-pitch">
        <Kicker>{kicker}</Kicker>
        <h3 className={quote ? "np-p2-sect np-p2-sect--quote" : "np-p2-sect"}>{heading}</h3>
        <p className="np-body">{body}</p>
      </div>
      {children}
    </section>
  );
}

export type IconName = "cap" | "pin" | "calendar" | "user" | "bolt" | "users" | "trophy";

/** Plain 24px stroke icons, drawn here because nothing else in the project needs them. */
const ICONS: Record<IconName, ReactNode> = {
  cap: (
    <>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.2A7 7 0 0 1 19 9.8C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.8" r="2.4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c.8-4 3.6-6 7.5-6s6.7 2 7.5 6" />
    </>
  ),
  bolt: <path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z" />,
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M2.8 19.5c.7-3.4 3-5 6.2-5s5.5 1.6 6.2 5" />
      <circle cx="17" cy="9.5" r="2.5" />
      <path d="M16.5 14.4c2.6 0 4.3 1.3 4.9 4.1" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8.5 20h7" />
    </>
  ),
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="np-p2-icon" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}
