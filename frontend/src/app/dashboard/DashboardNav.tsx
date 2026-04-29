"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardNav() {
  const pathname = usePathname();

  const navLinks = [
    { name: "OVERVIEW", href: "/dashboard" },
    { name: "TASK BOARD", href: "/dashboard/task-board" },
    { name: "DOMAIN DIRECTORY", href: "/dashboard/domain-directory" },
    { name: "EVENTS", href: "/dashboard/events" },
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
              isActive
                ? "text-link-blue"
                : "hover:text-link-blue"
            }`}
          >
            {link.name}
          </Link>
        );
      })}
    </nav>
  );
}
