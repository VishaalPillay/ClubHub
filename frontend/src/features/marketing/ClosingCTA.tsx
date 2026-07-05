import Link from "next/link";
import Reveal from "@/features/marketing/Reveal";

/** Final edition — the single blue accent of the page. */
export default function ClosingCTA() {
  return (
    <section className="py-16 md:py-24 text-center border-t-2 border-black">
      <Reveal>
        <p className="wired-kicker mb-4">Final edition</p>
        <h2 className="font-display text-[40px] md:text-[64px] leading-[0.98] tracking-[-0.5px] font-normal mb-9">
          Your club deserves a front page.
        </h2>
        <Link
          href="/register"
          className="inline-block font-ui text-[15px] font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-10 py-4 uppercase no-underline hover:bg-black hover:border-black transition-colors"
        >
          Join the network
        </Link>
      </Reveal>
    </section>
  );
}
