export default function EventsPage() {
  return (
    <div className="w-full">
      {/* Editorial Ribbon */}
      <div className="bg-black w-full mb-6 flex justify-between items-center px-2 py-1">
        <h1 className="text-white font-mono text-12 uppercase tracking-widest">Events Calendar</h1>
        <button className="bg-white text-black font-ui text-12 px-2 py-0.5 border-2 border-black hover:bg-black hover:text-white transition-0 uppercase">New Event</button>
      </div>

      {/* Events Grid */}
      <div className="flex flex-col gap-0 border-t-2 border-black">
        {/* Event 1 */}
        <article className="flex flex-col lg:flex-row py-6 border-b border-[#E2E8F0] gap-6 group hover:bg-[#f3f3f3] transition-colors">
          <div className="w-full lg:w-1/4 shrink-0">
            <img
              alt="Event Image"
              className="w-full aspect-square object-cover grayscale"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBuJC2T8AnafUlEI4s6d3eEGigIJ38Nlpc5VgZ4yw69NCRdoqs-kVY6dIgjIlcK3jlDsWV3dr3WlObIaqKR-KDPYOdQ1XfnIORN1q8s6tvEwtUWjC0X_984O-zqqElrjUQ3JScAwekhuHfEYE6zfpUYYxBahcS8CufwoDo9UzeUelN18-ppFzYipdTwigQuh4IM8KVL3GhzyrsgDdf0yPp6dE24x9u3_KNf5gwgPaeUuqZNIBII1L-7UCLDBJDX5upjuDEATOugJgGy"
            />
          </div>
          <div className="flex flex-col justify-between flex-1 py-2">
            <div>
              <p className="font-mono text-[13px] text-[#757575] uppercase mb-1 tracking-[1px]">
                OCT 15 • 7:00 PM
              </p>
              <h2 className="font-display text-[26px] leading-[1.18] text-black mb-2 group-hover:text-[#057DBC] group-hover:underline decoration-2 transition-colors cursor-pointer">
                Annual General Meeting & Leadership Elections
              </h2>
              <p className="font-body text-[16px] leading-[1.50] text-[#4c4546] max-w-2xl mb-4">
                Join us for the most important meeting of the year. We will be reviewing the annual budget, discussing key initiatives for the upcoming semester, and voting on the new executive board members.
              </p>
              <div className="flex items-center gap-4 font-mono text-[12px] text-[#757575]">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">location_on</span> Main Auditorium
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">group</span> 120/150 RSVP
                </span>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between lg:justify-start lg:gap-8">
              <button className="bg-white text-black border-2 border-black px-6 py-2 font-ui text-[16px] hover:bg-black hover:text-white transition-colors duration-0 uppercase tracking-wide font-bold">
                Manage Event
              </button>
              <span className="font-mono text-xs text-[#64bbfd] bg-[#eeeeee] px-2 py-1 uppercase tracking-wider">
                High Priority
              </span>
            </div>
          </div>
        </article>

        {/* Event 2 */}
        <article className="flex flex-col lg:flex-row py-6 border-b border-[#E2E8F0] gap-6 group hover:bg-[#f3f3f3] transition-colors">
          <div className="w-full lg:w-1/4 shrink-0">
            <img
              alt="Event Image"
              className="w-full aspect-square object-cover grayscale"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCPgBQ5nJg-EUHEhxomkBwwRZ55JZb6H9Did6WEdOkzlHgf9KSH47QNwFFFSDSFlqbag27e-worK0zVAhpmF8qk1-URp5_pgVmMV5Al5nlVNpgrSpFf88Miba-dJ9IRYPV72pQu9FjwIKEfkypeiUkotDVwO6MgPN9r2StmhHy2wGZkWNCFAQMxM7hNymu_q8wQMXAvhnE-wbv5nhKFR8XPt4l937Ne3tnzSb85ahWWu_X7ceSDxELLe9odT5TWPG7YlZjNhrLmToja"
            />
          </div>
          <div className="flex flex-col justify-between flex-1 py-2">
            <div>
              <p className="font-mono text-[13px] text-[#757575] uppercase mb-1 tracking-[1px]">
                OCT 22 • 5:30 PM
              </p>
              <h2 className="font-display text-[26px] leading-[1.18] text-black mb-2 group-hover:text-[#057DBC] group-hover:underline decoration-2 transition-colors cursor-pointer">
                Tech Workshop: Intro to Web Systems
              </h2>
              <p className="font-body text-[16px] leading-[1.50] text-[#4c4546] max-w-2xl mb-4">
                A hands-on workshop led by our senior developers. Bring your laptops. We will cover the basics of our new tech stack and best practices for contributing to the club's open-source projects.
              </p>
              <div className="flex items-center gap-4 font-mono text-[12px] text-[#757575]">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">location_on</span> Lab 4B
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">group</span> 45/50 RSVP
                </span>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between lg:justify-start lg:gap-8">
              <button className="bg-white text-black border-2 border-black px-6 py-2 font-ui text-[16px] hover:bg-black hover:text-white transition-colors duration-0 uppercase tracking-wide font-bold">
                Register
              </button>
            </div>
          </div>
        </article>

        {/* Event 3 */}
        <article className="flex flex-col lg:flex-row py-6 border-b-2 border-black gap-6 group hover:bg-[#f3f3f3] transition-colors">
          <div className="w-full lg:w-1/4 shrink-0">
            <img
              alt="Event Image"
              className="w-full aspect-square object-cover grayscale"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC0J--nN2vTRNCafzYBAzxCPNuqg13gpsKR4otAZCO2HwuVPXNnDGmKM20L7JCdNwR3lpzP10hr-C7qqRlbZpIrej7z9cjo21S1H5AZhcIC738fKr-6WV5Z92unVaBshWWcJEpY17I0UTwHXx-QirLWr8QQkLmF2t3FbAFE7mQFzg8HYX79xAtv7LkId_lBYXM6pIYrSlp1CxbH_erlzSEcbtW8fr5RNVZF-nLW-AcRRjFgfLZkA2UQ2PJJgsx5UpDRVtvaHQ02KQ1u"
            />
          </div>
          <div className="flex flex-col justify-between flex-1 py-2">
            <div>
              <p className="font-mono text-[13px] text-[#757575] uppercase mb-1 tracking-[1px]">
                NOV 05 • 8:00 PM
              </p>
              <h2 className="font-display text-[26px] leading-[1.18] text-black mb-2 group-hover:text-[#057DBC] group-hover:underline decoration-2 transition-colors cursor-pointer">
                Alumni Networking Mixer
              </h2>
              <p className="font-body text-[16px] leading-[1.50] text-[#4c4546] max-w-2xl mb-4">
                Connect with past club presidents and successful alumni currently working in the industry. Dress code is business casual. Beverages and light appetizers will be provided.
              </p>
              <div className="flex items-center gap-4 font-mono text-[12px] text-[#757575]">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">location_on</span> The Grand Hall
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">group</span> 80/200 RSVP
                </span>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between lg:justify-start lg:gap-8">
              <button className="bg-white text-black border-2 border-black px-6 py-2 font-ui text-[16px] hover:bg-black hover:text-white transition-colors duration-0 uppercase tracking-wide font-bold">
                Register
              </button>
            </div>
          </div>
        </article>
      </div>
      <div className="mt-8 flex justify-center">
        <button className="font-mono text-[13px] tracking-[1px] uppercase border-b border-black pb-1 hover:text-[#057DBC] hover:border-[#057DBC] transition-colors">
          Load Past Events
        </button>
      </div>
    </div>
  );
}
