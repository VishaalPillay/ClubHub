"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshAccessToken } from "@/lib/api/client";
import { tokenStore } from "@/lib/auth/tokenStore";
import { logout } from "@/lib/api/auth";
import { getProfile } from "@/lib/api/users";
import type { Profile } from "@/types/api";

type AuthContextType = {
  user: Profile;
  /** Replace the cached profile after an edit (e.g. ProfileMenu save). */
  setUser: (user: Profile) => void;
  /** Revoke the session server-side and bounce to /login. */
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Auth gate for the (app) route group. On mount it restores the session:
 * the access token lives only in memory, so after a reload we silently call
 * /auth/refresh (httpOnly cookie) before fetching the profile. Unauthenticated
 * visitors are redirected to /login. Children render only once authed —
 * the same null-gate behavior the old DashboardProvider had.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tokenStore.get()) {
        const token = await refreshAccessToken();
        if (!token) {
          if (!cancelled) router.replace("/login");
          return;
        }
      }
      try {
        const profile = await getProfile();
        if (!cancelled) setUser(profile);
      } catch {
        if (!cancelled) router.replace("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="font-mono text-12 uppercase tracking-widest text-[#757575] animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  const signOut = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <AuthContext.Provider value={{ user, setUser, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
