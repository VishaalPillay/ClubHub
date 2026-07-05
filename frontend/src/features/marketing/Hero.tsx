import Link from "next/link";
import ProductMock from "@/features/marketing/ProductMock";
import Reveal from "@/features/marketing/Reveal";

/** Hero band — kicker, display headline, deck, CTAs, and the product plate. */
export default function Hero() {
  return (
    <section className="py-14 md:py-20 border-b-2 border-black grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
      <Reveal className="lg:col-span-7">
        <p className="wired-kicker mb-6">Vol. 2 — The Student Club Operating System</p>
        <h1 className="font-display text-[52px] md:text-[88px] leading-[0.93] tracking-[-0.5px] font-bold uppercase">
          Run your club like a newsroom.
        </h1>
        <p className="font-body text-[19px] leading-[1.55] text-[#4c4546] max-w-2xl mt-8">
          Memberships, seven-tier roles, sub-teams, weighted tasks, a public points economy,
          events, and announcements — one account, many clubs. Club-Hub is the operating
          system student clubs never had.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mt-10">
          <Link
            href="/register"
            className="font-ui text-[15px] font-bold border-2 border-black bg-black text-white px-8 py-4 uppercase no-underline text-center hover:bg-white hover:text-black transition-colors"
          >
            Start a club — it&apos;s free
          </Link>
          <Link
            href="/login"
            className="font-ui text-[15px] font-bold border-2 border-black bg-white text-black px-8 py-4 uppercase no-underline text-center hover:bg-black hover:text-white transition-colors"
          >
            Sign in
          </Link>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#757575] mt-7">
          No credit card · Google or email · 60 seconds to your first club
        </p>
      </Reveal>
      <Reveal delay={0.12} className="lg:col-span-5">
        <ProductMock />
      </Reveal>
    </section>
  );
}
