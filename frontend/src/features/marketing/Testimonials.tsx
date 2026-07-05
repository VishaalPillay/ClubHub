import Reveal from "@/features/marketing/Reveal";

const STATS: [string, string][] = [
  ["7", "Role tiers, explicit powers"],
  ["∞", "Clubs per account"],
  ["100", "Max points per task"],
  ["0", "Spreadsheets required"],
];

const QUOTES: [string, string][] = [
  [
    "“We replaced four WhatsApp groups and a dying spreadsheet in one afternoon. The leaderboard did more for attendance than a year of reminders.”",
    "Aarav Sharma — President, Robotics Society",
  ],
  [
    "“For the first time the quiet people who do the actual work have a number next to their name. That changed who we promoted.”",
    "Meera Krishnan — Vice-President, Design Collective",
  ],
];

/** Stats band + two editorial pull-quotes. */
export default function Testimonials() {
  return (
    <section className="py-14">
      <Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#e2e8f0] border border-[#e2e8f0]">
          {STATS.map(([n, l]) => (
            <div key={l} className="bg-white px-5 py-6">
              <div className="font-display text-[40px] font-bold leading-none">{n}</div>
              <div className="font-mono text-[9.5px] uppercase tracking-widest text-[#757575] mt-2">
                {l}
              </div>
            </div>
          ))}
        </div>
      </Reveal>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-14 mt-12">
        {QUOTES.map(([quote, who], i) => (
          <Reveal key={who} delay={i * 0.08}>
            <figure className="border-t-2 border-black pt-5 m-0">
              <blockquote className="font-body italic text-[20px] md:text-[24px] leading-[1.35] m-0 mb-3.5">
                {quote}
              </blockquote>
              <figcaption className="font-mono text-[10px] uppercase tracking-widest text-[#757575]">
                {who}
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
