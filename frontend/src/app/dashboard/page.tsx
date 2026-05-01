import FeaturedProfilesCarousel from "./FeaturedProfilesCarousel";

export default function OverviewPage() {
  return (
    <div className="w-full">
      {/* Hero Header */}
      <div className="mb-4 border-b-1 border-black pb-3">
        <h1 className="font-display text-5xl font-bold tracking-tightest">CLUB OVERVIEW</h1>
        <div className="font-body text-lg text-[#4c4546] mt-1">State of the union for the current academic term.</div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {/* Metric 1 */}
        <div className="border-2 border-black p-3 relative group cursor-pointer hover:bg-black hover:text-white transition-0">
          <div className="font-mono text-sm uppercase text-caption-gray mb-0.5 group-hover:text-[#dadada] transition-0">Total Members</div>
          <div className="font-display text-5xl font-bold group-hover:text-white">142</div>
          <div className="font-mono text-[12px] mt-1 text-[#4c4546] group-hover:text-[#dadada]">+12 this semester</div>
          <span className="material-symbols-outlined absolute top-3 right-3 text-[32px] opacity-20 group-hover:opacity-100">group</span>
        </div>
        {/* Metric 2 */}
        <div className="border-2 border-black p-3 relative group cursor-pointer hover:bg-black hover:text-white transition-0">
          <div className="font-mono text-sm uppercase text-caption-gray mb-0.5 group-hover:text-[#dadada] transition-0">Active Tasks</div>
          <div className="font-display text-5xl font-bold group-hover:text-white">28</div>
          <div className="font-mono text-[12px] mt-1 text-[#4c4546] group-hover:text-[#dadada]">5 critical priority</div>
          <span className="material-symbols-outlined absolute top-3 right-3 text-[32px] opacity-20 group-hover:opacity-100">format_list_bulleted</span>
        </div>
        {/* Metric 3 */}
        <div className="border-2 border-black p-3 relative group cursor-pointer hover:bg-black hover:text-white transition-0">
          <div className="font-mono text-sm uppercase text-caption-gray mb-0.5 group-hover:text-[#dadada] transition-0">Upcoming Events</div>
          <div className="font-display text-5xl font-bold group-hover:text-white">04</div>
          <div className="font-mono text-[12px] mt-1 text-[#4c4546] group-hover:text-[#dadada]">Next: Annual Gala (Nov 12)</div>
          <span className="material-symbols-outlined absolute top-3 right-3 text-[32px] opacity-20 group-hover:opacity-100">calendar_today</span>
        </div>
      </div>

      {/* Content Area Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column: Announcements */}
        <div className="lg:col-span-8">
          {/* Black Ribbon Header */}
          <div className="bg-black text-white px-2 py-1 mb-3 font-mono text-sm uppercase">
            Recent Announcements
          </div>
          <div className="space-y-3">
            {/* Announcement Item 1 */}
            <div className="border-2 border-black p-2 group">
              <div className="flex justify-between items-start mb-1">
                <span className="font-mono text-sm uppercase text-caption-gray">URGENT</span>
                <span className="font-mono text-[12px] text-caption-gray">OCT 24, 2023</span>
              </div>
              <h3 className="font-display text-2xl font-bold mb-1 group-hover:text-link-blue hover:underline decoration-2 cursor-pointer transition-0">Budget Proposals Due for Q4</h3>
              <p className="font-body text-base text-[#4c4546]">All committee heads must submit their finalized budget requests by Friday 5PM. No exceptions will be made for late submissions as we prepare the end-of-year financial report.</p>
            </div>
            {/* Announcement Item 2 */}
            <div className="border-2 border-black p-2 group">
              <div className="flex justify-between items-start mb-1">
                <span className="font-mono text-sm uppercase text-caption-gray">UPDATE</span>
                <span className="font-mono text-[12px] text-caption-gray">OCT 22, 2023</span>
              </div>
              <h3 className="font-display text-2xl font-bold mb-1 group-hover:text-link-blue hover:underline decoration-2 cursor-pointer transition-0">New Membership Orientation Schedule</h3>
              <p className="font-body text-base text-[#4c4546]">The orientation for the incoming fall cohort has been rescheduled to Room 402 due to AV equipment maintenance in the main auditorium. Please update your calendars accordingly.</p>
            </div>
            {/* Announcement Item 3 */}
            <div className="border-2 border-black p-2 group">
              <div className="flex justify-between items-start mb-1">
                <span className="font-mono text-sm uppercase text-caption-gray">GENERAL</span>
                <span className="font-mono text-[12px] text-caption-gray">OCT 18, 2023</span>
              </div>
              <h3 className="font-display text-2xl font-bold mb-1 group-hover:text-link-blue hover:underline decoration-2 cursor-pointer transition-0">Gala Ticket Sales Open</h3>
              <p className="font-body text-base text-[#4c4546]">Early bird pricing for the Annual Winter Gala is now available through the student portal. Committees are encouraged to purchase tables in advance.</p>
            </div>
          </div>
        </div>

        {/* Right Column: Quick Actions & Editorial Aside */}
        <div className="lg:col-span-4 lg:border-l-1 border-black lg:pl-3 mt-4 lg:mt-0 pt-4 lg:pt-0 border-t-1 lg:border-t-0">
          {/* Black Ribbon Header */}
          <div className="bg-black text-white px-2 py-1 mb-3 font-mono text-sm uppercase">
            Executive Actions
          </div>
          <div className="space-y-1.5 mb-4">
            <button className="w-full bg-white border-2 border-black font-ui text-base font-bold py-1.5 px-2 hover:bg-black hover:text-white transition-0 text-left flex justify-between items-center group">
              <span>Draft New Announcement</span>
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
            <button className="w-full bg-white border-2 border-black font-ui text-base font-bold py-1.5 px-2 hover:bg-black hover:text-white transition-0 text-left flex justify-between items-center group">
              <span>Review Pending Members</span>
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
            <button className="w-full bg-white border-2 border-black font-ui text-base font-bold py-1.5 px-2 hover:bg-black hover:text-white transition-0 text-left flex justify-between items-center group">
              <span>Update Club Details</span>
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
          </div>

          {/* Editorial Image Block (Carousel) */}
          <FeaturedProfilesCarousel />
        </div>
      </div>
    </div>
  );
}
