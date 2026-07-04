import Link from "next/link";

export const metadata = {
  title: "Club-Hub — Run your club like a newsroom",
};

const FEATURES = [
  {
    kicker: "Memberships & Roles",
    title: "One account, many clubs.",
    body: "A single identity across every club you belong to — with a seven-tier role hierarchy, per-club permissions, and a propose-then-authorize governance flow for sensitive actions.",
  },
  {
    kicker: "Tasks & Gamification",
    title: "Work that counts, literally.",
    body: "Assign tasks with point weightages across sub-teams. Completions credit every assignee through an auditable points ledger that feeds the club leaderboard.",
  },
  {
    kicker: "Events & RSVP",
    title: "Hackathons to socials, on the record.",
    body: "Publish club events with real RSVP tracking — members tap once to attend, executives see live headcounts.",
  },
  {
    kicker: "Announcements",
    title: "Speak to the whole club, or one domain.",
    body: "Urgent or general, global or domain-scoped. Everyone sees exactly what concerns them — nothing more, nothing less.",
  },
];

/** Public landing page — Wired-editorial: masthead, display-serif hero, story rows, black footer. */
export default function LandingPage() {
  return (
    <div className="bg-white text-black min-h-screen flex flex-col">
      {/* Utility strip */}
      <div className="wired-utility-nav justify-between">
        <span>EST. 2026 · THE CLUB OPERATIONS PAPER</span>
        <span className="hidden md:inline">STUDENT-RUN · MULTI-TENANT · OPEN FOR ENROLLMENT</span>
      </div>

      {/* Masthead */}
      <header className="flex justify-between items-center w-full px-6 md:px-10 py-4 bg-white border-b-2 border-black sticky top-0 z-30">
        <div className="font-display text-[32px] font-black uppercase tracking-tighter">
          CLUB-HUB
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="font-ui text-[14px] font-bold border-2 border-black px-4 py-2 uppercase no-underline text-black hover:bg-black hover:text-white transition-colors"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="font-ui text-[14px] font-bold border-2 border-black bg-black text-white px-4 py-2 uppercase no-underline hover:bg-white hover:text-black transition-colors"
          >
            Register
          </Link>
        </nav>
      </header>

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-6 md:px-10">
        {/* Hero band */}
        <section className="py-16 md:py-24 border-b-2 border-black">
          <p className="wired-kicker mb-6">Vol. 1 — The Student Club Operating System</p>
          <h1 className="font-display text-[56px] md:text-[96px] leading-[0.93] tracking-[-0.5px] font-bold uppercase max-w-5xl">
            Run your club like a newsroom.
          </h1>
          <p className="font-body text-[19px] leading-[1.5] text-[#4c4546] max-w-2xl mt-8">
            Club-Hub is the multi-tenant home for student organizations — memberships,
            sub-teams, task boards, gamified leaderboards, events, and announcements, all
            behind one shareable invite code.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-10">
            <Link
              href="/register"
              className="font-ui text-[15px] font-bold border-2 border-black bg-black text-white px-8 py-4 uppercase no-underline text-center hover:bg-white hover:text-black transition-colors"
            >
              Start a club — it&apos;s free
            </Link>
            <Link
              href="/directory"
              className="font-ui text-[15px] font-bold border-2 border-black bg-white text-black px-8 py-4 uppercase no-underline text-center hover:bg-black hover:text-white transition-colors"
            >
              Browse the directory
            </Link>
          </div>
        </section>

        {/* Feature story rows */}
        <section className="py-12">
          <div className="bg-black text-white px-3 py-1 mb-8 font-mono text-12 uppercase tracking-widest w-max">
            What&apos;s inside
          </div>
          <div className="flex flex-col">
            {FEATURES.map((f, i) => (
              <article
                key={f.kicker}
                className={`py-8 grid grid-cols-1 md:grid-cols-12 gap-4 ${i < FEATURES.length - 1 ? "border-b border-[#e2e8f0]" : ""}`}
              >
                <div className="md:col-span-3">
                  <span className="wired-kicker">{f.kicker}</span>
                </div>
                <div className="md:col-span-9">
                  <h2 className="font-display text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.4px] font-bold mb-3">
                    {f.title}
                  </h2>
                  <p className="font-body text-[17px] leading-[1.5] text-[#4c4546] max-w-3xl">
                    {f.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* How it works strip */}
        <section className="py-12 border-t-2 border-black">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-black border-2 border-black">
            {[
              ["01", "Create or join", "Spin up a club in five steps, or enter an invite code and request your role."],
              ["02", "Organize domains", "Split the club into sub-teams — Technical, Design, Management — each with leads."],
              ["03", "Ship and score", "Assign weighted tasks, complete them, and watch the leaderboard move."],
            ].map(([num, title, body]) => (
              <div key={num} className="bg-white p-8">
                <div className="font-display text-[48px] font-bold text-[#e2e8f0] leading-none mb-4">
                  {num}
                </div>
                <h3 className="font-ui text-[18px] font-bold uppercase mb-2">{title}</h3>
                <p className="font-body text-[15px] leading-[1.5] text-[#4c4546]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="py-16 md:py-20 text-center border-t border-[#e2e8f0]">
          <h2 className="font-display text-[40px] md:text-[64px] leading-[0.95] tracking-[-0.5px] font-bold uppercase mb-8">
            Your club deserves a front page.
          </h2>
          <Link
            href="/register"
            className="inline-block font-ui text-[15px] font-bold border-2 border-black bg-[#057DBC] text-white px-10 py-4 uppercase no-underline hover:bg-black transition-colors"
          >
            Join the network
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-black text-white py-12 px-8 flex flex-col items-center mt-auto">
        <div className="font-display text-2xl font-black uppercase tracking-tighter mb-6 text-white">
          CLUB-HUB
        </div>
        <div className="flex flex-wrap justify-center gap-8 font-ui text-xs uppercase tracking-widest text-[#dadada] mb-6">
          <Link className="hover:text-white transition-150 no-underline text-[#dadada]" href="/directory">
            Directory
          </Link>
          <Link className="hover:text-white transition-150 no-underline text-[#dadada]" href="/login">
            Sign In
          </Link>
          <Link className="hover:text-white transition-150 no-underline text-[#dadada]" href="/register">
            Register
          </Link>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#757575]">
          © 2026 CLUB-HUB EDITORIAL. ALL RIGHTS RESERVED.
        </div>
      </footer>
    </div>
  );
}
