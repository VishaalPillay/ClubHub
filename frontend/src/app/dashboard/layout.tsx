import DashboardNav from "./DashboardNav";

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
          <div className="flex items-center gap-3 font-ui text-base">
            <span>Aarav (President)</span>
            <div className="w-10 h-10 border border-black overflow-hidden bg-[#e2e2e2]">
              <img 
                alt="Aarav" 
                className="w-full h-full object-cover grayscale" 
                data-alt="Black and white portrait of a young professional man looking directly at the camera with a neutral expression" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAegbAJ2PnOcflbgSQ459A6dOFs424Wdg5RQP58XlREoXSA1mByO-wekNdsxmByzZGB5GVaNUiqD9b0P5Da-BgOqi25KGo6faOOZ1XJ0GxEGO_OH9tSantjDo_HEDzqschFfr7_uCEpG7jt8LFR8WfvMrZMzB4ldTzaARd8BZkzn6P9k-LO5KTjkHblcEqa-nbZ1VwwEsFL4EWAi4I8IlPNY2zGtisDQ_hPzpNzBgKwa7X4QyIGiT1rPeJ2QBTlqvVkMVcZ5HS8Y1ix"
              />
            </div>
          </div>
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
