import Reveal from "@/features/marketing/Reveal";

/** Marketing captions for the seven ranks — mirrors the README role table
 *  (the RBAC source of truth stays app/core/permissions.py / lib/roles.ts). */
const RUNGS: [string, string, string][] = [
  ["R1", "Member", "Sees the club, works own-domain tasks, updates own status."],
  ["R2", "Associate", "Assigns tasks inside their own domain."],
  ["R3", "Lead", "Creates tasks, posts domain announcements, proposes promotions."],
  ["R4", "Joint Secretary", "Approves join and action requests; creates events."],
  ["R5", "Secretary", "Same authority, senior desk — promotes up to lead."],
  ["R6", "Vice-President", "Shapes domains, edits the club, posts global bulletins."],
  ["R7", "President", "Full control. Auto-assigned to the founder."],
];

/** The seven-rung role ladder, low to high — president inverted as the top rank. */
export default function RolesLadder() {
  return (
    <section
      id="roles"
      className="bg-[#f7f6f4] border-t-2 border-b-2 border-black -mx-6 md:-mx-10 px-6 md:px-10 py-14 scroll-mt-20"
    >
      <Reveal>
        <p className="wired-kicker mb-4">The masthead — seven ranks, low to high</p>
        <h2 className="font-display text-[32px] md:text-[48px] leading-[1.02] font-normal mb-2">
          Everyone knows who signs off.
        </h2>
        <p className="font-body text-[16px] text-[#4c4546] max-w-2xl mb-8">
          Each rank inherits everything below it and adds one clear power. Presidents choose
          which ranks their club actually uses.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-px bg-black border-2 border-black">
          {RUNGS.map(([no, title, body], i) => {
            const prez = i === RUNGS.length - 1;
            return (
              <div key={no} className={`px-3.5 py-4 ${prez ? "bg-black text-white" : "bg-white"}`}>
                <span
                  className={`font-mono text-[9px] tracking-widest ${prez ? "text-[#9a9a9a]" : "text-[#757575]"}`}
                >
                  {no}
                </span>
                <h4 className="font-mono text-[12px] font-bold uppercase tracking-wider mt-2 mb-1.5">
                  {title}
                </h4>
                <p
                  className={`font-ui text-[11.5px] leading-[1.5] ${prez ? "text-[#c9c9c9]" : "text-[#4c4546]"}`}
                >
                  {body}
                </p>
              </div>
            );
          })}
        </div>
      </Reveal>
    </section>
  );
}
