"use client";

import Link from "next/link";

import FlowShell from "@/features/flow/FlowShell";

/**
 * Chrome for the (public) auth pages. It is `FlowShell` with the signed-out
 * right-hand slot — a link to whichever of login/register you are not on.
 *
 * The masthead and footer themselves used to be duplicated here; they now live
 * in FlowShell alongside the onboarding flows, so the two halves of the front
 * door can't drift apart again.
 */
export default function AuthShell({
  active,
  children,
}: {
  active: "login" | "register";
  children: React.ReactNode;
}) {
  const other =
    active === "login"
      ? { label: "Register", href: "/register" }
      : { label: "Login", href: "/login" };

  return (
    <FlowShell
      right={
        <Link
          href={other.href}
          className="font-ui text-[14px] font-bold border-2 border-black px-4 py-2 uppercase no-underline bg-black text-paper transition-colors hover:bg-paper hover:text-black"
        >
          {other.label}
        </Link>
      }
    >
      {children}
    </FlowShell>
  );
}
