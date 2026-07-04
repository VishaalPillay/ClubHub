"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { myClubs } from "@/lib/api/clubs";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * Club context for /c/[clubId]/* pages. The active club comes from the URL segment
 * (replacing the old clubhub_active_* localStorage keys), and the caller's role/domain
 * is resolved from GET /clubs/my. Non-members get bounced to /portal — mirroring the
 * backend's 403 NOT_A_MEMBER, but before any club data is requested.
 */

type ClubContextType = {
  clubId: number;
  clubName: string;
  clubCode: string;
  currentRole: string;
  domainId: number | null;
  userId: number;
};

const ClubContext = createContext<ClubContextType | null>(null);

export function ClubProvider({
  clubId,
  children,
}: {
  clubId: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAuth();

  const { data: clubs, isPending } = useQuery({
    queryKey: ["my-clubs"],
    queryFn: myClubs,
  });

  const club = clubs?.find((c) => c.id === clubId);

  useEffect(() => {
    if (!Number.isFinite(clubId) || (!isPending && clubs && !club)) {
      router.replace("/portal");
    }
  }, [clubId, isPending, clubs, club, router]);

  if (isPending || !club) return null;

  return (
    <ClubContext.Provider
      value={{
        clubId,
        clubName: club.name,
        clubCode: club.code,
        currentRole: club.role,
        domainId: club.domain_id,
        userId: user.id,
      }}
    >
      {children}
    </ClubContext.Provider>
  );
}

export function useClub(): ClubContextType {
  const ctx = useContext(ClubContext);
  if (!ctx) throw new Error("useClub must be used within ClubProvider");
  return ctx;
}
