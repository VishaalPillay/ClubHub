import "@/features/newspaper/newspaper.css";

import NewspaperShell from "@/features/newspaper/NewspaperShell";
import NewspaperSheet from "@/features/newspaper/NewspaperSheet";
import { PAGES, PAGES_PER_SHEET, SHEET_COUNT } from "@/features/newspaper/edition";

import Page1Front from "@/features/newspaper/pages/Page1Front";
import Page2Situation from "@/features/newspaper/pages/Page2Situation";
import Page3Governance from "@/features/newspaper/pages/Page3Governance";
import Page4League from "@/features/newspaper/pages/Page4League";
import Page5Listings from "@/features/newspaper/pages/Page5Listings";
import Page6Masthead from "@/features/newspaper/pages/Page6Masthead";
import Page7Letters from "@/features/newspaper/pages/Page7Letters";
import Page8Colophon from "@/features/newspaper/pages/Page8Colophon";

// Title/description/OG now live in layout.tsx — there is exactly one route here, and the
// layout is where metadataBase and the OG block have to sit anyway.

/** The eight page bodies, in edition order. All Server Components. */
const BODIES = [
  Page1Front,
  Page2Situation,
  Page3Governance,
  Page4League,
  Page5Listings,
  Page6Masthead,
  Page7Letters,
  Page8Colophon,
] as const;

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Club-Hub",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "The operating system for student clubs — memberships, seven-tier roles, sub-teams, weighted tasks, a public points economy, events, and announcements.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

/**
 * Public landing page — the newspaper on a developer's desk.
 *
 * The eight pages are bound into four LEAVES, two pages per leaf, exactly like
 * newsprint: leaf k prints page 2k on the front and page 2k+1 on the back. Turn
 * a leaf and you read its other side. See the pagination table in edition.ts.
 *
 * This file stays a Server Component. Every `<Body />` is *created* here, so
 * React serialises its rendered output into the RSC payload and hands the client
 * shell an opaque slot: the shell can position the pages but can never re-render
 * them. That is what keeps the whole edition at zero JS.
 *
 * The shell renders plain mode on the server (eight articles in normal flow,
 * fronts and backs interleaved in reading order) and only upgrades to the 3D
 * newspaper client-side, after hydration — so this is also the complete,
 * crawlable, no-JS document.
 */
export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <NewspaperShell pages={PAGES} sheetCount={SHEET_COUNT}>
        {Array.from({ length: SHEET_COUNT }, (_, k) => {
          const f = k * PAGES_PER_SHEET;
          const b = f + 1;
          const Front = BODIES[f];
          const Back = BODIES[b];
          return (
            <NewspaperSheet
              key={PAGES[f].id}
              index={k}
              frontPage={PAGES[f]}
              backPage={PAGES[b]}
              front={<Front />}
              back={Back ? <Back /> : undefined}
            />
          );
        })}
      </NewspaperShell>
    </>
  );
}
