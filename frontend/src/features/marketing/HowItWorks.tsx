import Reveal from "@/features/marketing/Reveal";

const STEPS: [string, string, string][] = [
  [
    "01",
    "Sign up",
    "Google or email. Sixty seconds, then you’re standing in your portal — no forced setup, no tour.",
  ],
  [
    "02",
    "Create or join",
    "Found a club and you’re its president. Or enter a friend’s invite code, pick a role, and request in.",
  ],
  [
    "03",
    "Organize domains",
    "Carve the club into sub-teams, appoint leads, and let each domain run its own desk.",
  ],
  [
    "04",
    "Ship and score",
    "Weighted tasks pay points into the public ledger. The leaderboard tells the truth at semester’s end.",
  ],
];

/** Numbered four-step strip — the sequence a new club actually follows. */
export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-14 border-t-2 border-black scroll-mt-20">
      <Reveal>
        <p className="wired-kicker mb-6">How it works — four moves</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-black border-2 border-black">
          {STEPS.map(([num, title, body]) => (
            <div key={num} className="bg-white p-7">
              <div className="font-display text-[44px] font-bold leading-none">{num}</div>
              <h3 className="font-display text-[21px] font-bold mt-3.5 mb-2">{title}</h3>
              <p className="font-ui text-[13.5px] leading-[1.6] text-[#4c4546]">{body}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
