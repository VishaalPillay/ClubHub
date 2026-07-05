import Reveal from "@/features/marketing/Reveal";

const ITEMS: [string, string][] = [
  [
    "Is Club-Hub free?",
    "Yes. Creating clubs, joining clubs, tasks, events, announcements, and the leaderboard are free for students. No credit card at any point.",
  ],
  [
    "Who can create a club?",
    "Any signed-in student. The founder is automatically the club’s president and picks which of the seven ranks the club will use.",
  ],
  [
    "How do people join my club?",
    "Share your club’s invite code, or let students find you in the public directory. Joiners request a role — your secretaries approve or decline from a queue.",
  ],
  [
    "Can I be in more than one club?",
    "Yes — that’s the point. One account, many clubs, like GitHub with repositories. Your identity is global; your rank and points are separate inside each club.",
  ],
  [
    "What exactly are domains?",
    "Sub-teams — Technical, Management, Creative, anything you define. Tasks, announcements, and leaderboard filters can all be scoped to a domain, and leads run theirs.",
  ],
  [
    "Do points ever expire or get taken back?",
    "No. The points ledger is append-only: once earned, always yours. Reopening a task never claws points back — the record stands, by design.",
  ],
];

/** Native <details> accordion — zero JS, keyboard-accessible out of the box. */
export default function FAQ() {
  return (
    <section id="faq" className="py-14 max-w-3xl mx-auto scroll-mt-20">
      <Reveal>
        <p className="wired-kicker border-b-2 border-black pb-2.5 mb-1">
          Questions from the floor
        </p>
        {ITEMS.map(([q, a], i) => (
          <details key={q} open={i === 0} className="border-b border-[#e2e8f0] group">
            <summary className="flex items-baseline gap-4 cursor-pointer list-none font-display text-[19px] font-bold py-5 [&::-webkit-details-marker]:hidden">
              <span className="font-mono font-bold text-[#757575] w-4 flex-none group-open:hidden">
                +
              </span>
              <span className="font-mono font-bold text-[#757575] w-4 flex-none hidden group-open:inline">
                −
              </span>
              {q}
            </summary>
            <p className="font-ui text-[14.5px] leading-[1.65] text-[#4c4546] pl-8 pb-5 m-0 max-w-2xl">
              {a}
            </p>
          </details>
        ))}
      </Reveal>
    </section>
  );
}
