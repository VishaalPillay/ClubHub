import DashboardNav from "./DashboardNav";
import ProfileMenu from "./ProfileMenu";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white text-black min-h-screen flex flex-col antialiased selection:bg-black selection:text-white">
      {/* TopAppBar */}
      <header className="bg-white text-black w-full border-b-2 border-black flex px-8 py-4 sticky top-0 z-30 justify-between items-center relative">
        <div className="flex items-center gap-4 z-10">
          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 hover:bg-[#f1f1f1] transition-0">
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
          <div className="font-display text-[32px] font-black uppercase tracking-tighter">CLUB-HUB</div>
        </div>
        
        {/* Navigation Links (Absolutely Centered) */}
        <DashboardNav />
        
        <div className="flex items-center gap-6 z-10">
          <ProfileMenu />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Dashboard Canvas */}
        <main className="flex-1 p-8 lg:p-12 max-w-[1600px] mx-auto w-full">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-ink text-white py-12 px-8 flex flex-col items-center mt-auto">
          <div className="font-display text-2xl font-black uppercase tracking-tighter mb-8 text-white">CLUB-HUB</div>
          <div className="flex flex-wrap justify-center gap-8 font-ui text-xs uppercase tracking-widest text-[#dadada]">
            <a className="hover:text-white transition-150 cursor-pointer no-underline text-[#dadada]" href="#">Privacy Policy</a>
            <a className="hover:text-white transition-150 cursor-pointer no-underline text-[#dadada]" href="#">Terms of Service</a>
            <a className="hover:text-white transition-150 cursor-pointer no-underline text-[#dadada]" href="#">Contact Us</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
