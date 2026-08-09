import type { Metadata } from "next";
import { Newsreader, Inter, Space_Grotesk } from "next/font/google";
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

// Absolute base for OG/canonical URLs. Inlined at build time like every NEXT_PUBLIC_* value,
// so Cloudflare Pages needs this set before the first production build, not after.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

const TITLE = "Club-Hub — Run your club like a newsroom";
const DESCRIPTION =
  "The operating system for student clubs — memberships, seven-tier roles, sub-teams, weighted tasks, a public points economy, events, and announcements. One account, many clubs.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["club management", "student hub", "task board", "events", "domains"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Club-Hub",
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
      className={`${newsreader.variable} ${inter.variable} ${spaceGrotesk.variable}`}
      /* The boot script writes `data-np-mode`, `data-np-phase` and a custom
         property onto this element before React runs. That is the entire point
         of it, and React cannot know about it — so it reports an attribute
         mismatch on hydration and refuses to patch it up. Suppressed here, and
         only here: this is the one element a pre-paint script is allowed to
         touch. */
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
