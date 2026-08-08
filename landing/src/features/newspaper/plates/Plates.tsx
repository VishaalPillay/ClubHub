import { PlateFrame, RolePill } from "./PlateFrame";

/**
 * The six product-UI plates, ported from features/marketing/FeatureStories.tsx.
 * Structure and data are unchanged; the hard-coded px type sizes now come from
 * the page's cqw scale (see the PLATES block in newspaper.css) so a plate stays
 * legible at any sheet width.
 *
 * All server components, all `aria-hidden` via PlateFrame — these are pictures
 * of software, not software.
 */

export function MembersPlate() {
  const rows: [string, string, string, boolean][] = [
    ["AS", "Aarav Sharma", "President", true],
    ["MK", "Meera Krishnan", "Vice-President", false],
    ["DP", "Dev Patel", "Lead — Technical", false],
    ["SR", "Sana Rao", "Member", false],
  ];
  return (
    <PlateFrame head="Members — Robotics Society" meta="128 total">
      {rows.map(([init, name, role, prez]) => (
        <div key={name} className="np-plate-row">
          <span className={`np-avatar${prez ? " np-avatar--on" : ""}`}>{init}</span>
          <span className="np-plate-name">{name}</span>
          <RolePill inverted={prez}>{role}</RolePill>
        </div>
      ))}
    </PlateFrame>
  );
}

export function DomainsPlate() {
  const cells: [string, string][] = [
    ["Technical", "41 members · 18 tasks"],
    ["Management", "32 members · 9 tasks"],
    ["Creative", "27 members · 7 tasks"],
  ];
  return (
    <PlateFrame head="Domains" meta="3 active">
      <div className="np-plate-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {cells.map(([name, meta]) => (
          <div key={name} className="np-plate-cell">
            <div className="np-minihead">{name}</div>
            <div className="np-micro" style={{ marginTop: "0.5em" }}>
              {meta}
            </div>
          </div>
        ))}
      </div>
    </PlateFrame>
  );
}

export function EventPlate() {
  return (
    <PlateFrame head="Events — upcoming" meta="3 scheduled">
      <div className="np-plate-pad">
        <span className="np-tag">Hackathon</span>
        <h4 className="np-subhead" style={{ margin: "0.5em 0 0.25em" }}>
          Build Night: Autonomy Sprint
        </h4>
        <p className="np-micro">Sat Jul 18 · 18:00 · Main Lab</p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1.2em",
            marginTop: "1em",
            paddingTop: "0.8em",
            borderTop: "1px solid var(--np-hair-quiet)",
          }}
        >
          <span className="np-tag">RSVP — Going</span>
          <span className="np-pts">47 attending</span>
        </div>
      </div>
    </PlateFrame>
  );
}

export function AnnouncementsPlate() {
  const rows: [string, boolean, string, string][] = [
    [
      "Global",
      true,
      "Demo night moved to the auditorium",
      "Doors at 17:30. Every domain presents — bring your build.",
    ],
    [
      "Technical",
      false,
      "Freeze on the vision branch until Friday",
      "Integration tests are red. Coordinate merges with Dev.",
    ],
  ];
  return (
    <PlateFrame head="Announcements" meta="Latest">
      {rows.map(([scope, global, title, body]) => (
        <div
          key={title}
          className="np-plate-row"
          style={{ display: "block", paddingTop: "0.8em", paddingBottom: "0.8em" }}
        >
          <span className={`np-pill${global ? " np-pill--on" : ""}`} style={{ marginRight: "0.6em" }}>
            {scope}
          </span>
          <span className="np-minihead" style={{ display: "inline" }}>
            {title}
          </span>
          <p className="np-body" style={{ textAlign: "left", textIndent: 0, marginTop: "0.35em" }}>
            {body}
          </p>
        </div>
      ))}
    </PlateFrame>
  );
}

export function DirectoryPlate() {
  const rows: [string, string][] = [
    ["Robotics Society", "NIT Trichy"],
    ["Design Collective", "VIT Vellore"],
    ["Finance & Markets Club", "BITS Pilani"],
  ];
  return (
    <PlateFrame head="Join a club" meta="Directory">
      <div className="np-plate-pad">
        <div className="np-code">
          ROBO-2026
          <span className="np-micro">Invite code</span>
        </div>
      </div>
      {rows.map(([name, inst]) => (
        <div key={name} className="np-plate-row">
          <span className="np-minihead">{name}</span>
          <span className="np-micro" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
            {inst}
          </span>
        </div>
      ))}
    </PlateFrame>
  );
}
