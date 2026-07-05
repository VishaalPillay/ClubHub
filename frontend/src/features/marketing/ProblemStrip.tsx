import Reveal from "@/features/marketing/Reveal";

const EXHIBITS = [
  {
    no: "EXHIBIT A",
    title: "Four WhatsApp groups",
    body: "Announcements drown between memes. Nobody knows which group is canonical, and the freshers were never added to the one that matters.",
  },
  {
    no: "EXHIBIT B",
    title: "The dying spreadsheet",
    body: "Attendance, tasks, and “points” live in a sheet three people can edit and one person understands. It was last accurate in September.",
  },
  {
    no: "EXHIBIT C",
    title: "Invisible work",
    body: "The people who actually ship get the same certificate as the people who joined for the photo. Effort has no ledger, so it has no reward.",
  },
];

/** Full-bleed black band naming the problem — the editorial "why". */
export default function ProblemStrip() {
  return (
    <section className="bg-black text-white -mx-6 md:-mx-10 px-6 md:px-10 py-14">
      <Reveal>
        <p className="font-mono text-[11px] uppercase tracking-widest text-[#9a9a9a] mb-4">
          The situation on the ground
        </p>
        <h2 className="font-display text-[32px] md:text-[52px] leading-[1.02] font-normal max-w-3xl mb-9">
          Most clubs run on chaos and one exhausted secretary.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#3a3a3a]">
          {EXHIBITS.map((e) => (
            <div key={e.no} className="bg-black px-5 py-6">
              <span className="font-mono text-[11px] uppercase tracking-widest text-[#9a9a9a]">
                {e.no}
              </span>
              <h3 className="font-display text-[22px] font-bold mt-2.5 mb-2">{e.title}</h3>
              <p className="font-ui text-[13.5px] leading-[1.6] text-[#c9c9c9]">{e.body}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
