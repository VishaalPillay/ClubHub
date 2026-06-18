"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DashboardContextType = {
  clubId: number;
  clubName: string;
  currentRole: string;
  domainId: number | null;
  userId: number | null;
};

const DashboardContext = createContext<DashboardContextType | null>(null);

import api from "@/lib/axios";

export const DashboardProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [contextVal, setContextVal] = useState<DashboardContextType | null>(null);

  useEffect(() => {
    // Read from localStorage
    const clubIdStr = localStorage.getItem("clubhub_active_club_id");
    const clubName = localStorage.getItem("clubhub_active_club_name");
    const role = localStorage.getItem("clubhub_active_role");
    const domainIdStr = localStorage.getItem("clubhub_active_domain_id");

    if (!clubIdStr || !clubName || !role) {
      router.push("/portal");
      return;
    }

    api.get("/auth/me")
      .then((res) => {
        setContextVal({
          clubId: parseInt(clubIdStr, 10),
          clubName,
          currentRole: role,
          domainId: domainIdStr && domainIdStr !== "null" ? parseInt(domainIdStr, 10) : null,
          userId: res.data.id,
        });
      })
      .catch((e) => {
        console.error("Failed to fetch user ID:", e);
        router.push("/portal");
      });
  }, [router]);

  if (!contextVal) return null; // or a loading spinner

  return (
    <DashboardContext.Provider value={contextVal}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }
  return ctx;
};
