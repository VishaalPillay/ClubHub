import type { Metadata } from "next";
import { Newsreader, Inter, Space_Grotesk, Playfair_Display } from "next/font/google";
import "./globals.css";
import { BOOT_SCRIPT } from "@/features/newspaper/bootScript";

// next/font downloads and self-hosts these at build time, so they survive output:"export"
// with no runtime font requests. All three are load-bearing: newspaper.css reads all four
// --font-* aliases defined in globals.css, which are fed by the variables below.

// WiredDisplay / BreveText substitute — display headlines and body decks
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

// Apercu substitute — UI labels, buttons, navigation
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

// WiredMono substitute — ALL-CAPS kickers, eyebrows, timestamps
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

// Front-page headline: a heavy high-contrast serif. Newsreader's bold is a text face and
// reads as body copy at headline size; the front page needs a masthead-weight voice.
// One weight only — nothing else on the site uses it, so no other weight is downloaded.
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["900"],
  variable: "--font-playfair",
  display: "swap",
});

// No display face is loaded here for the wordmark. It is not set as text at all: it is
// supplied artwork, rendered to WebP once (scripts/gen-wordmark.mjs → public/brand/). The
// nameplate is the largest thing on page one, so Masthead marks it `priority` and the
// <img> reserves its box from intrinsic size — it lands in the LCP path without shifting it.

// Absolute base for OG/canonical URLs. Inlined at build time like every NEXT_PUBLIC_* value,
// so Cloudflare Pages needs this set before the first production build, not after.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

const TITLE = "ClubHub";
const DESCRIPTION =
  "ClubHub is the free home for student clubs: members, seven-tier roles, tasks, events, announcements and a public points leaderboard. Find clubs worth joining, or start your own in about a minute.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["club management", "student hub", "task board", "events", "domains"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "ClubHub",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

/**
 * Root layout for the marketing site.
 *
 * Deliberately leaner than the app's layout (frontend/src/app/layout.tsx): no QueryProvider
 * (the landing issues zero queries) and no Material Symbols stylesheet (newspaper.css uses
 * none). Both were only ever inherited because the app's root layout wrapped every route.
 * Dropping them removes a client-side provider and a render-blocking font request from the
 * LCP path of the one page that most needs to be fast.
 */
/**
 * Decides reading mode before first paint. See bootScript.ts for why this has
 * to be a blocking inline script and cannot be done in React.
 */
function BootScript() {
  return <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${inter.variable} ${spaceGrotesk.variable} ${playfair.variable}`}
      /* The boot script writes `data-np-mode` onto this element before React
         runs. That is the entire point of it, and React cannot know about it —
         so it reports an attribute mismatch on hydration and refuses to patch it
         up. Suppressed here, and only here: this is the one element a pre-paint
         script is allowed to touch. */
      suppressHydrationWarning
    >
      <head>
        <BootScript />
      </head>
      <body style={{ backgroundColor: "#ffffff", color: "#1a1a1a", fontFamily: "var(--font-ui)" }}>
        {children}
      </body>
    </html>
  );
}
