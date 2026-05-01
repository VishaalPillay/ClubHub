import Leaderboard from "./Leaderboard";

export default function TaskBoardPage() {
  return (
    <div className="w-full">
      {/* Editorial Ribbon Header */}
      <div className="bg-black w-full mb-6 flex justify-between items-center px-2 py-1">
        <h1 className="text-white font-mono text-12 uppercase tracking-widest">Tasks</h1>
        <button className="bg-white text-black font-ui text-12 px-2 py-0.5 border-2 border-black hover:bg-black hover:text-white transition-0 uppercase">New Task</button>
      </div>

      {/* Task Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* To Do Column */}
        <div className="flex flex-col gap-2 lg:border-r-2 border-black lg:pr-3">
          <h2 className="font-display text-20 text-black border-b-2 border-black pb-0.5 uppercase tracking-tight font-bold">To Do</h2>

          <article className="bg-white border-2 border-black p-2">
            <span className="font-mono text-13 text-caption-gray uppercase block mb-0.5">SYS-402</span>
            <h3 className="font-ui text-16 font-bold text-black mb-1 leading-tight">Implement High-Contrast Color Palette in Legacy Modules</h3>
            <div className="flex justify-between items-center mt-2 border-t-1 border-hairline-tint pt-1">
              <span className="font-mono text-12 text-caption-gray">Due: Oct 12</span>
              <div className="w-6 h-6 bg-[#dadada] border-1 border-black flex items-center justify-center">
                <span className="font-mono text-11 text-black">JD</span>
              </div>
            </div>
          </article>

          <article className="bg-white border-2 border-black p-2">
            <span className="font-mono text-13 text-caption-gray uppercase block mb-0.5">EDI-119</span>
            <h3 className="font-ui text-16 font-bold text-black mb-1 leading-tight">Draft Editorial Guidelines for Q4 Publications</h3>
            <div className="flex justify-between items-center mt-2 border-t-1 border-hairline-tint pt-1">
              <span className="font-mono text-12 text-caption-gray">Due: Oct 15</span>
              <div className="w-6 h-6 bg-[#dadada] border-1 border-black flex items-center justify-center">
                <span className="font-mono text-11 text-black">AR</span>
              </div>
            </div>
          </article>
        </div>

        {/* In Progress Column */}
        <div className="flex flex-col gap-2 lg:border-r-2 border-black lg:px-3">
          <h2 className="font-display text-20 text-black border-b-2 border-black pb-0.5 uppercase tracking-tight font-bold">In Progress</h2>

          <article className="bg-white border-2 border-black border-l-4 border-l-link-blue p-2">
            <span className="font-mono text-13 text-caption-gray uppercase block mb-0.5">SYS-399</span>
            <h3 className="font-ui text-16 font-bold text-black mb-1 leading-tight">Migrate Core Database to New Archival Infrastructure</h3>
            <p className="font-body text-14 text-caption-gray mb-2 line-clamp-2 leading-snug">Data synchronization is currently running at 85%. Expecting completion by EOD.</p>
            <div className="flex justify-between items-center border-t-1 border-hairline-tint pt-1">
              <span className="font-mono text-12 text-caption-gray">In Progress (85%)</span>
              <div className="w-6 h-6 bg-[#dadada] border-1 border-black flex items-center justify-center">
                <span className="font-mono text-11 text-black">MK</span>
              </div>
            </div>
          </article>
        </div>

        {/* Completed Column */}
        <div className="flex flex-col gap-2 lg:pl-3">
          <h2 className="font-display text-20 text-black border-b-2 border-black pb-0.5 uppercase tracking-tight font-bold">Completed</h2>

          <article className="bg-[#f3f3f3] border-2 border-black p-2 opacity-50">
            <span className="font-mono text-13 text-caption-gray uppercase block mb-0.5 line-through">DES-201</span>
            <h3 className="font-ui text-16 font-bold text-caption-gray mb-1 leading-tight line-through">Establish Grid System Typography Ratios</h3>
            <div className="flex justify-between items-center mt-2 border-t-1 border-hairline-tint pt-1">
              <span className="font-mono text-12 text-caption-gray">Done: Oct 01</span>
              <span className="material-symbols-outlined text-caption-gray text-16">check</span>
            </div>
          </article>

          <article className="bg-[#f3f3f3] border-2 border-black p-2 opacity-50">
            <span className="font-mono text-13 text-caption-gray uppercase block mb-0.5 line-through">DES-202</span>
            <h3 className="font-ui text-16 font-bold text-caption-gray mb-1 leading-tight line-through">Finalize Standard Component Library JSON</h3>
            <div className="flex justify-between items-center mt-2 border-t-1 border-hairline-tint pt-1">
              <span className="font-mono text-12 text-caption-gray">Done: Sep 28</span>
              <span className="material-symbols-outlined text-caption-gray text-16">check</span>
            </div>
          </article>
        </div>

      </div>

      {/* Leaderboard Section */}
      <Leaderboard />
    </div>
  );
}
