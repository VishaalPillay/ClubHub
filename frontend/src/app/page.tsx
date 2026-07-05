import ClosingCTA from "@/features/marketing/ClosingCTA";
import FAQ from "@/features/marketing/FAQ";
import FeatureStories from "@/features/marketing/FeatureStories";
import Hero from "@/features/marketing/Hero";
import HowItWorks from "@/features/marketing/HowItWorks";
import MarketingFooter from "@/features/marketing/MarketingFooter";
import MarketingNav from "@/features/marketing/MarketingNav";
import ProblemStrip from "@/features/marketing/ProblemStrip";
import RolesLadder from "@/features/marketing/RolesLadder";
import Testimonials from "@/features/marketing/Testimonials";

export const metadata = {
  title: "Club-Hub — Run your club like a newsroom",
  description:
    "The operating system for student clubs — memberships, seven-tier roles, sub-teams, weighted tasks, a public points economy, events, and announcements. One account, many clubs.",
};

/**
 * Public landing page — Wired-editorial, elevated: hero with product plate,
 * problem strip, six feature stories, how-it-works, roles ladder, stats &
 * pull-quotes, FAQ, closing CTA. Composition lives in features/marketing/*.
 */
export default function LandingPage() {
  return (
    <div className="bg-white text-black min-h-screen flex flex-col">
      {/* Utility strip */}
      <div className="wired-utility-nav justify-between">
        <span>EST. 2026 · THE CLUB OPERATIONS PAPER</span>
        <span className="hidden md:inline">STUDENT-RUN · MULTI-TENANT · OPEN FOR ENROLLMENT</span>
      </div>

      <MarketingNav />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-6 md:px-10 overflow-x-clip">
        <Hero />
        <ProblemStrip />
        <FeatureStories />
        <HowItWorks />
        <RolesLadder />
        <Testimonials />
        <FAQ />
        <ClosingCTA />
      </main>

      <MarketingFooter />
    </div>
  );
}
