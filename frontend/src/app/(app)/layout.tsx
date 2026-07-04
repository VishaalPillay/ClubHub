import { AuthProvider } from "@/lib/auth/AuthProvider";

/**
 * Authenticated route group. Everything below /portal, /directory, /onboarding
 * and /c/[clubId] requires a session — AuthProvider restores it (silent refresh)
 * or redirects to /login.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
