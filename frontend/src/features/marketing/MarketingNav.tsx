import Link from "next/link";

/** Sticky masthead for the landing page — wordmark, section anchors, auth CTAs. */
export default function MarketingNav() {
  const anchors = [
    ["#features", "Features"],
    ["#how-it-works", "How it works"],
    ["#roles", "Roles"],
    ["#faq", "FAQ"],
  ] as const;

  return (
    <header className="flex items-center gap-8 w-full px-6 md:px-10 py-4 bg-white border-b-2 border-black sticky top-0 z-30">
      <div className="font-display text-[32px] font-black uppercase tracking-tighter">
        CLUB-HUB
      </div>
      <nav className="hidden lg:flex items-center gap-6 font-mono text-[11px] uppercase tracking-widest">
        {anchors.map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="text-black no-underline border-b-2 border-transparent pb-0.5 hover:border-black transition-colors"
          >
            {label}
          </a>
        ))}
      </nav>
      <nav className="flex items-center gap-3 ml-auto">
        <Link
          href="/login"
          className="font-ui text-[14px] font-bold border-2 border-black px-4 py-2 uppercase no-underline text-black hover:bg-black hover:text-white transition-colors"
        >
          Login
        </Link>
        <Link
          href="/register"
          className="font-ui text-[14px] font-bold border-2 border-black bg-black text-white px-4 py-2 uppercase no-underline hover:bg-white hover:text-black transition-colors"
        >
          Register
        </Link>
      </nav>
    </header>
  );
}
