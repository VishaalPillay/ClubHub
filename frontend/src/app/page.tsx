import { redirect } from "next/navigation";

/**
 * Root page — redirects straight to /register for now.
 * Once auth is implemented, this can check for a valid session
 * and redirect to /board if authenticated.
 */
export default function Home() {
  redirect("/register");
}
