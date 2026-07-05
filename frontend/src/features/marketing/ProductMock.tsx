import { HairlineRule } from "@/components/ui/HairlineRule";

/**
 * Stylized black-and-white product plate for the hero — a miniature club
 * dashboard built from the real design system (no image assets, stays sharp
 * at any DPI, and can never drift off-palette).
 */
export default function ProductMock() {
  return (
    <div className="border-2 border-black bg-white" aria-hidden="true">
      {/* window bar */}
      <div className="flex items-center gap-3 border-b-2 border-black px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest">
        <span className="w-2.5 h-2.5 bg-black" />
        <span className="font-bold">CLUB-HUB</span>
        <span className="text-[#757575]">/ ROBOTICS SOCIETY</span>
      </div>
      {/* tabs */}
      <div className="flex border-b border-[#e2e8f0] font-mono text-[10px] uppercase tracking-wider">
        <span className="px-4 py-2 border-b-2 border-black font-bold">Dashboard</span>
        <span className="px-4 py-2 text-[#757575]">Tasks</span>
        <span className="px-4 py-2 text-[#757575]">Leaderboard</span>
        <span className="px-4 py-2 text-[#757575] hidden sm:inline">Events</span>
      </div>
      {/* metric tiles */}
      <div className="grid grid-cols-3 gap-px bg-[#e2e8f0] border-b border-[#e2e8f0]">
        {[
          ["128", "Members"],
          ["34", "Tasks open"],
          ["3", "Events soon"],
        ].map(([n, l]) => (
          <div key={l} className="bg-white px-3 py-3.5">
            <div className="font-display text-[28px] font-bold leading-none">{n}</div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#757575] mt-1.5">
              {l}
            </div>
          </div>
        ))}
      </div>
      {/* task rows */}
      <div>
        {[
          [true, "Publish sponsor deck v3", "+40 PTS"],
          [false, "Wire telemetry for line-follower bot", "60 PTS"],
          [false, "Book auditorium for demo night", "20 PTS"],
        ].map(([done, title, pts]) => (
          <div
            key={title as string}
            className="flex items-center gap-3 px-4 py-2.5 border-b border-[#e2e8f0] text-[13px]"
          >
            <span className={`w-3 h-3 border-2 border-black flex-none ${done ? "bg-black" : ""}`} />
            <span
              className={`flex-1 truncate font-ui ${done ? "line-through text-[#757575]" : ""}`}
            >
              {title}
            </span>
            <span className="font-mono text-[11px] font-bold whitespace-nowrap">{pts}</span>
          </div>
        ))}
      </div>
      {/* leaderboard mini */}
      <div className="px-4 pb-4">
        <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest text-[#757575] pt-3 pb-2">
          <span>Leaderboard — all domains</span>
          <span>PTS</span>
        </div>
        <HairlineRule />
        <div className="pt-2 flex flex-col gap-1.5">
          {[
            ["01", 92, "1,240"],
            ["02", 74, "980"],
            ["03", 58, "760"],
          ].map(([rk, w, pv]) => (
            <div key={rk as string} className="grid grid-cols-[18px_1fr_auto] gap-2.5 items-center">
              <span className="font-mono text-[11px] font-bold">{rk}</span>
              <span className="relative h-3 bg-[#f1f0ee]">
                <span className="absolute inset-y-0 left-0 bg-black" style={{ width: `${w}%` }} />
              </span>
              <span className="font-mono text-[11px] font-bold tabular-nums">{pv}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
