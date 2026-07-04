"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClub } from "@/features/club/ClubProvider";

export default function ClubNav() {
  const pathname = usePathname();
  const { clubId } = useClub();
  const base = `/c/${clubId}`;

  const navLinks = [
    { name: "OVERVIEW", href: `${base}/dashboard` },
    { name: "TASK BOARD", href: `${base}/tasks` },
    { name: "LEADERBOARD", href: `${base}/leaderboard` },
    { name: "MEMBERS", href: `${base}/members` },
    { name: "EVENTS", href: `${base}/events` },
  ];

  return (
    <nav className="hidden lg:flex gap-8 font-ui text-[14px] font-bold uppercase tracking-widest text-black absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap">
      {navLinks.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.name}
            href={link.href}
            className={`transition-150 cursor-pointer no-underline ${
              isActive ? "text-link-blue" : "hover:text-link-blue"
            }`}
          >
            {link.name}
          </Link>
        );
      })}
    </nav>
  );
}
