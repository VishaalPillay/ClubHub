import { redirect } from "next/navigation";

/**
 * `app.<domain>/` has no content of its own — the marketing site moved to its own static
 * deployment at the apex (see landing/). Anyone landing here wants the product, so hand
 * straight off to /portal and let the (app) AuthProvider decide what that means: it silently
 * refreshes on mount and routes to the portal when the session restores, /login when it does
 * not, and /register when the profile is incomplete. No new logic, no flash of empty shell.
 */
export default function Home() {
  redirect("/portal");
}
