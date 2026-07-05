import Reveal from "@/features/marketing/Reveal";

/* ── Small mock fragments (pure markup, real design system) ─────────────────── */

function FragFrame({
  head,
  meta,
  children,
}: {
  head: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-2 border-black bg-white max-w-[520px]" aria-hidden="true">
      <div className="flex justify-between gap-3 px-4 py-2.5 border-b-2 border-black font-mono text-[9px] uppercase tracking-widest text-[#757575]">
        <span>{head}</span>
        <span>{meta}</span>
      </div>
      {children}
    </div>
  );
}

function RolePill({ inverted, children }: { inverted?: boolean; children: string }) {
  return (
    <span
      className={`font-mono text-[10px] font-bold uppercase tracking-wider border border-black px-2 py-0.5 whitespace-nowrap ${
        inverted ? "bg-black text-white" : ""
      }`}
    >
      {children}
    </span>
  );
}

function MembersFrag() {
  const rows: [string, string, string, boolean][] = [
    ["AS", "Aarav Sharma", "President", true],
    ["MK", "Meera Krishnan", "Vice-President", false],
    ["DP", "Dev Patel", "Lead — Technical", false],
    ["SR", "Sana Rao", "Member", false],
  ];
  return (
    <FragFrame head="Members — Robotics Society" meta="128 TOTAL">
      {rows.map(([init, name, role, prez]) => (
        <div
          key={name}
          className="flex items-center gap-3 px-4 py-2.5 border-b border-[#e2e8f0] last:border-b-0 text-[13px]"
        >
          <span
            className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-[10px] font-bold flex-none ${
              prez ? "bg-black text-white" : "border-2 border-black"
            }`}
          >
            {init}
          </span>
          <span className="flex-1 font-ui font-semibold truncate">{name}</span>
          <RolePill inverted={prez}>{role}</RolePill>
        </div>
      ))}
    </FragFrame>
  );
}

function DomainsFrag() {
  const cells: [string, string][] = [
    ["Technical", "41 members · 18 tasks"],
    ["Management", "32 members · 9 tasks"],
    ["Creative", "27 members · 7 tasks"],
  ];
  return (
    <FragFrame head="Domains" meta="3 ACTIVE">
      <div className="grid grid-cols-3 gap-px bg-black">
        {cells.map(([name, meta]) => (
          <div key={name} className="bg-white px-3 py-4">
            <div className="font-display text-[17px] font-bold">{name}</div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-[#757575] mt-1.5">
              {meta}
            </div>
          </div>
        ))}
      </div>
    </FragFrame>
  );
}

function TasksFrag() {
  const rows: [boolean, string, string][] = [
    [true, "CAD the chassis mount", "+30 PTS"],
    [true, "Write PID tuning doc", "+50 PTS"],
    [false, "Integrate vision pipeline", "100 PTS"],
    [false, "Fix encoder drift on M2", "40 PTS"],
  ];
  return (
    <FragFrame head="Tasks — Technical" meta="STATUS: ALL">
      {rows.map(([done, title, pts]) => (
        <div
          key={title}
          className="flex items-center gap-3 px-4 py-2.5 border-b border-[#e2e8f0] last:border-b-0 text-[13px]"
        >
          <span className={`w-3 h-3 border-2 border-black flex-none ${done ? "bg-black" : ""}`} />
          <span className={`flex-1 truncate font-ui ${done ? "line-through text-[#757575]" : ""}`}>
            {title}
          </span>
          <span className="font-mono text-[11px] font-bold whitespace-nowrap">{pts}</span>
        </div>
      ))}
    </FragFrame>
  );
}

function EventFrag() {
  return (
    <FragFrame head="Events — upcoming" meta="3 SCHEDULED">
      <div className="p-4">
        <span className="font-mono text-[9px] uppercase tracking-widest bg-black text-white px-2 py-0.5">
          Hackathon
        </span>
        <h4 className="font-display text-[21px] font-bold mt-2.5 mb-1">
          Build Night: Autonomy Sprint
        </h4>
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#757575]">
          SAT JUL 18 · 18:00 · MAIN LAB
        </p>
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[#e2e8f0]">
          <span className="font-ui text-[12px] font-bold uppercase bg-black text-white border-2 border-black px-4 py-2">
            RSVP — Going
          </span>
          <span className="font-mono text-[11px] font-bold">47 ATTENDING</span>
        </div>
      </div>
    </FragFrame>
  );
}

function AnnouncementsFrag() {
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
    <FragFrame head="Announcements" meta="LATEST">
      {rows.map(([scope, global, title, body]) => (
        <div key={title} className="px-4 py-3 border-b border-[#e2e8f0] last:border-b-0">
          <span
            className={`font-mono text-[9px] uppercase tracking-wider border border-black px-1.5 py-0.5 mr-2 ${
              global ? "bg-black text-white" : ""
            }`}
          >
            {scope}
          </span>
          <span className="font-display text-[15px] font-bold">{title}</span>
          <p className="font-ui text-[12.5px] text-[#4c4546] mt-1">{body}</p>
        </div>
      ))}
    </FragFrame>
  );
}

function DirectoryFrag() {
  const rows: [string, string][] = [
    ["Robotics Society", "NIT Trichy"],
    ["Design Collective", "VIT Vellore"],
    ["Finance & Markets Club", "BITS Pilani"],
  ];
  return (
    <FragFrame head="Join a club" meta="DIRECTORY">
      <div className="p-4">
        <div className="flex items-center justify-between gap-3 border-2 border-dashed border-black px-4 py-3 font-mono font-bold text-[16px] tracking-[0.24em]">
          ROBO-2026
          <span className="font-normal text-[9px] tracking-widest text-[#757575]">
            INVITE CODE
          </span>
        </div>
      </div>
      {rows.map(([name, inst]) => (
        <div
          key={name}
          className="flex items-baseline gap-3 px-4 py-2.5 border-b border-[#e2e8f0] last:border-b-0"
        >
          <span className="font-display text-[15px] font-bold">{name}</span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-[#757575] ml-auto whitespace-nowrap">
            {inst}
          </span>
        </div>
      ))}
    </FragFrame>
  );
}

/* ── The six stories ─────────────────────────────────────────────────────────── */

const STORIES = [
  {
    idx: "№ 1 — GOVERNANCE",
    title: "Seven ranks. Zero ambiguity.",
    body: "From member to president, every rank has explicit powers. Leads propose promotions and removals; secretaries authorize them through an action-request queue. Authority is granted, logged, and revocable — never assumed.",
    cap: "Propose-then-authorize · action-request queue · role grants capped by rank",
    Frag: MembersFrag,
  },
  {
    idx: "№ 2 — STRUCTURE",
    title: "Sub-teams that own their turf.",
    body: "Split the club into domains — Technical, Management, Creative, or whatever yours needs. Leads run their domain’s tasks and announcements; the leaderboard can score the whole club or one domain at a time.",
    cap: "Domains are club-defined · leads scoped per domain · filterable everywhere",
    Frag: DomainsFrag,
  },
  {
    idx: "№ 3 — WORK & SCORE",
    title: "Work is worth points. Points are public.",
    body: "Tasks carry a weight — up to 100 points. Completion pays every assignee through an append-only ledger, and the leaderboard settles who actually carried the semester. Points are never clawed back; the record stands.",
    cap: "Weighted tasks · append-only points ledger · live leaderboard",
    Frag: TasksFrag,
  },
  {
    idx: "№ 4 — EVENTS",
    title: "From hackathon to headcount.",
    body: "Hackathons, tech talks, workshops, socials — create the event, watch RSVPs count themselves. One tap to attend, one tap to back out; the attendee tally is always live and never double-counts.",
    cap: "Four event types · idempotent RSVP · live attendee counts",
    Frag: EventFrag,
  },
  {
    idx: "№ 5 — SIGNAL",
    title: "Announcements that reach the right desk.",
    body: "Global bulletins for the whole club; domain-scoped notes for one team. Members see what concerns them and nothing else — signal without the group-chat noise.",
    cap: "Global requires VP+ · domain posts by leads · visibility by scope",
    Frag: AnnouncementsFrag,
  },
  {
    idx: "№ 6 — DISCOVERY",
    title: "One account. Every club on campus.",
    body: "Join with a shareable code, or browse the public directory across institutions. Like GitHub for repositories: your identity is global, and you can belong to — or found — as many clubs as you can handle.",
    cap: "Shareable join codes · public directory · join requests with roles",
    Frag: DirectoryFrag,
  },
];

/** Six feature stories, copy on one side and a working-looking UI fragment on the other. */
export default function FeatureStories() {
  return (
    <section id="features" className="py-14 scroll-mt-20">
      <p className="wired-kicker border-b-2 border-black pb-2.5">
        What&apos;s inside — six departments, one paper
      </p>
      {STORIES.map((s, i) => (
        <Reveal key={s.idx}>
          <article
            className={`grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-14 items-center py-11 ${
              i < STORIES.length - 1 ? "border-b border-[#e2e8f0]" : ""
            }`}
          >
            <div className={`lg:col-span-5 ${i % 2 === 1 ? "lg:order-2" : ""}`}>
              <span className="font-mono text-[11px] uppercase tracking-widest text-[#757575]">
                {s.idx}
              </span>
              <h3 className="font-display text-[30px] md:text-[42px] leading-[1.04] font-normal mt-3 mb-3.5">
                {s.title}
              </h3>
              <p className="font-body text-[16.5px] leading-[1.6] text-[#4c4546] max-w-xl">
                {s.body}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#757575] mt-4">
                {s.cap}
              </p>
            </div>
            <div className={`lg:col-span-7 ${i % 2 === 1 ? "lg:order-1" : ""}`}>
              <s.Frag />
            </div>
          </article>
        </Reveal>
      ))}
    </section>
  );
}
