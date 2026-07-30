"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Centered nav for identity-scoped pages (Portal, Directory) — mirrors ClubNav's
 *  styling/active-state so the chrome reads the same whether or not a club is active. */
export default function AppNav() {
  const pathname = usePathname();

  const navLinks = [
    { name: "PORTAL", href: "/portal" },
    { name: "DIRECTORY", href: "/directory" },
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
