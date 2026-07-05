"use client";

import Link from "next/link";

/**
 * Shared chrome for the (public) auth pages — masthead with wordmark + Login/Register
 * links, centered content area, and the editorial footer. Extracted from the old
 * combined AuthCard so LoginCard and RegisterWizard stay form-only.
 */
export default function AuthShell({
  active,
  children,
}: {
  active: "login" | "register";
  children: React.ReactNode;
}) {
  const tab = (mode: "login" | "register", label: string, href: string) => (
    <Link
      href={href}
      className={`font-ui text-[14px] font-bold border-2 border-black px-4 py-2 uppercase no-underline transition-colors ${
        active === mode
          ? "bg-black text-white"
          : "bg-white text-black hover:bg-black hover:text-white"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="bg-[#FFFFFF] text-[#000000] min-h-screen flex flex-col">
      <header className="flex justify-between items-center w-full px-6 py-4 bg-white top-0 border-b-2 border-black">
        <Link
          href="/"
          className="text-black font-display text-[28px] uppercase tracking-tighter font-black no-underline"
        >
          CLUB-HUB
        </Link>
        <div className="flex gap-3">
          {tab("login", "Login", "/login")}
          {tab("register", "Register", "/register")}
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center w-full max-w-[1600px] mx-auto px-6 py-12">
        {children}
      </main>

      <footer className="bg-[#1A1A1A] text-white text-xs uppercase w-full flex flex-col md:flex-row justify-between items-center gap-4 px-8 py-10 mt-auto">
        <div className="text-white font-black tracking-widest">
          © 2026 CLUB-HUB EDITORIAL. ALL RIGHTS RESERVED.
        </div>
        <div className="flex flex-wrap justify-center gap-6 font-mono tracking-widest">
          <Link href="#" className="text-neutral-400 hover:text-white underline">Privacy</Link>
          <Link href="#" className="text-neutral-400 hover:text-white underline">Terms</Link>
          <Link href="#" className="text-neutral-400 hover:text-white underline">Contact</Link>
        </div>
      </footer>
    </div>
  );
}
