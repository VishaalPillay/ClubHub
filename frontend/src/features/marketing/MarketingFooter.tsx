import Link from "next/link";

/** Black editorial footer — wordmark, nav, copyright. */
export default function MarketingFooter() {
  return (
    <footer className="bg-black text-white py-10 px-6 md:px-10 flex flex-col md:flex-row items-center justify-between gap-5 mt-auto">
      <div className="font-display text-xl font-black uppercase tracking-tighter text-white">
        CLUB-HUB
      </div>
      <nav className="flex flex-wrap justify-center gap-6 font-mono text-[10px] uppercase tracking-widest">
        <a href="#features" className="text-[#bdb9b2] hover:text-white underline">Features</a>
        <a href="#how-it-works" className="text-[#bdb9b2] hover:text-white underline">
          How it works
        </a>
        <Link href="/login" className="text-[#bdb9b2] hover:text-white underline">Sign In</Link>
        <Link href="/register" className="text-[#bdb9b2] hover:text-white underline">Register</Link>
      </nav>
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#757575]">
        © 2026 CLUB-HUB EDITORIAL. ALL RIGHTS RESERVED.
      </div>
    </footer>
  );
}
