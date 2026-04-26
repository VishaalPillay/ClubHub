import type { Metadata } from "next";
import { Newsreader, Inter, Space_Grotesk } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "Club-Hub — Manage Your Club, Effortlessly",
    template: "%s | Club-Hub",
  },
  description:
    "Club-Hub is the all-in-one editorial platform for student clubs. Manage tasks, events, domains, and members — with clarity and authority.",
  keywords: ["club management", "student hub", "task board", "events", "domains"],
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
      </head>
      <body style={{ backgroundColor: "#ffffff", color: "#1a1a1a", fontFamily: "var(--font-ui)" }}>
        {children}
      </body>
    </html>
  );
}
