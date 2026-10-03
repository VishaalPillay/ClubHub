import type { Metadata, Viewport } from "next";
import { Newsreader, Inter, Space_Grotesk } from "next/font/google";
import { QueryProvider } from "@/lib/queryClient";
import { DeckleDefs } from "@/features/flow/FlowSheet";
import MobileGate from "@/features/flow/MobileGate";
import "./globals.css";

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

// No display face is loaded here for the wordmark. It is not set as text at all: it is
// supplied artwork, rendered to WebP once (scripts/gen-wordmark.mjs → public/brand/), so
// the logo costs no font and nothing flashes while one downloads.

export const metadata: Metadata = {
  title: {
    default: "ClubHub",
    template: "%s | ClubHub",
  },
  description:
    "ClubHub is the all-in-one editorial platform for student clubs. Manage tasks, events, domains, and members — with clarity and authority.",
  keywords: ["club management", "student hub", "task board", "events", "domains"],
  // This is the signed-in application, not the marketing site. Keeping app.<domain>/login
  // out of the index means the landing page at the apex is the only thing that ranks —
  // otherwise the two compete for the same brand query and the login form usually wins.
  robots: { index: false, follow: false },
  // iOS ignores the manifest's display mode and reads these instead: without `capable`
  // a home-screen launch opens in Safari chrome, and without `title` the icon is labelled
  // with the page <title>.
  appleWebApp: { capable: true, title: "ClubHub", statusBarStyle: "default" },
};

// Tints the browser toolbar / installed-window title bar to the newsprint canvas.
export const viewport: Viewport = {
  themeColor: "#f8eedf",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${inter.variable} ${spaceGrotesk.variable}`}
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        {/* GoogleButton loads gsi/client lazily on mount (register/login only); this
            gets the DNS+TLS handshake to Google done ahead of that request instead of
            paying it cold when the account step first appears. */}
        <link rel="preconnect" href="https://accounts.google.com" />
        <link rel="dns-prefetch" href="https://accounts.google.com" />
      </head>
      <body style={{ backgroundColor: "#f8eedf", color: "#1a1a1a", fontFamily: "var(--font-ui)" }}>
        {/* Hidden wholesale below the laptop breakpoint — see MobileGate. */}
        <div className="app-shell">
          <QueryProvider>{children}</QueryProvider>
        </div>
        <MobileGate />
        {/* Defined once for the whole document rather than per shell: two copies
            of the same filter id is a duplicate-ID document, and the gate needs
            it on routes that never mount a FlowShell. */}
        <DeckleDefs />
      </body>
    </html>
  );
}
