/**
 * The front-page photograph — a miniature club dashboard drawn entirely from the
 * design system. Ported from features/marketing/ProductMock.tsx with its px type
 * re-expressed against the page's cqw scale.
 *
 * No image assets, so it stays sharp at any DPI and can never drift off-palette.
 * Server component.
 */
export default function DashboardPlate() {
  const metrics: [string, string][] = [
    ["128", "Members"],
    ["34", "Tasks open"],
    ["3", "Events soon"],
  ];
  const tasks: [boolean, string, string][] = [
    [true, "Publish sponsor deck v3", "+40 PTS"],
    [false, "Wire telemetry for line-follower bot", "60 PTS"],
    [false, "Book auditorium for demo night", "20 PTS"],
  ];
  const board: [string, number, string][] = [
    ["01", 92, "1,240"],
    ["02", 74, "980"],
    ["03", 58, "760"],
  ];

  return (
    <div className="np-plate" aria-hidden="true">
      <div className="np-plate-bar">
        <span>
          <strong>CLUB-HUB</strong> / Robotics Society
        </span>
        <span>Dashboard</span>
      </div>

      <div className="np-tabrow">
        <span className="np-tab np-tab--on">Dashboard</span>
        <span className="np-tab">Tasks</span>
        <span className="np-tab">Leaderboard</span>
        <span className="np-tab">Events</span>
      </div>

      <div
        className="np-plate-grid"
        style={{ gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid var(--np-hair-quiet)" }}
      >
        {metrics.map(([n, l]) => (
          <div key={l} className="np-plate-cell">
            <div className="np-metric-n">{n}</div>
            <div className="np-micro" style={{ marginTop: "0.5em" }}>
              {l}
            </div>
          </div>
        ))}
      </div>

      {tasks.map(([done, title, pts]) => (
        <div key={title} className="np-plate-row">
          <span className={`np-check${done ? " np-check--on" : ""}`} />
          <span className={`np-plate-name${done ? " np-done" : ""}`}>{title}</span>
          <span className="np-pts">{pts}</span>
        </div>
      ))}

      <div className="np-plate-pad">
        <div
          className="np-micro"
          style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.6em" }}
        >
          <span>Leaderboard — all domains</span>
          <span>PTS</span>
        </div>
        <hr className="np-rule" />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5em", paddingTop: "0.7em" }}>
          {board.map(([rank, width, points]) => (
            <div
              key={rank}
              style={{
                display: "grid",
                gridTemplateColumns: "1.6em 1fr auto",
                gap: "0.8em",
                alignItems: "center",
              }}
            >
              <span className="np-pts">{rank}</span>
              <span className="np-bar">
                <span className="np-bar-fill" style={{ width: `${width}%` }} />
              </span>
              <span className="np-pts">{points}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
