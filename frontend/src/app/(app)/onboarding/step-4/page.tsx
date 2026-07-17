"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClub } from "@/lib/api/clubs";
import { createDomain } from "@/lib/api/domains";
import UserAvatarBadge from "@/features/auth/UserAvatarBadge";

export default function OnboardingStep4() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // President and Member are mandatory — always enabled, cannot be toggled off.
  const [roles, setRoles] = useState({
    president: true,
    secretary: false,
    lead: true,
    member: true,
    vicePresident: true,
    jointSecretary: false,
    associateLead: false,
  });

  const [progress, setProgress] = useState("60%");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setProgress("80%"), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleFinish = async () => {
    setLoading(true);
    try {
      const name = localStorage.getItem("onboarding_club_name") || "Untitled Club";
      const institution = localStorage.getItem("onboarding_club_institution") || "";
      const domainsStr = localStorage.getItem("onboarding_club_domains");
      const domains = domainsStr ? JSON.parse(domainsStr) : [];

      // Map UI roles to backend roles
      const enabled_roles = [];
      if (roles.vicePresident) enabled_roles.push("vice_president");
      if (roles.secretary) enabled_roles.push("secretary");
      if (roles.jointSecretary) enabled_roles.push("joint_secretary");
      if (roles.lead) enabled_roles.push("lead");
      if (roles.associateLead) enabled_roles.push("associate");
      if (roles.member) enabled_roles.push("member");

      // Create the club (the caller becomes president), then its domains.
      const club = await createClub(name, null, enabled_roles, institution || null);
      for (const d of domains) {
        await createDomain(club.id, d, "");
      }

      // Step-5 shows the invite code and links into the new club's dashboard.
      localStorage.setItem("onboarding_club_code", club.code);
      localStorage.setItem("onboarding_club_id", String(club.id));

      // The portal/club shell read memberships from this cache — step-1 already
      // populated it with the pre-creation (clubless) list, and the app's 60s
      // default staleTime means neither invalidateQueries (only refetches *active*
      // observers; nothing observes this key during onboarding) nor fetchQuery
      // (staleTime-gated — it'd just hand back that same stale cache entry) would
      // actually hit the network here. ClubProvider would then mount on the fresh
      // club's dashboard, see the still-clubless list, and bounce to /portal.
      // refetchQueries always performs a real fetch regardless of staleTime;
      // `type: "all"` includes this presently-unobserved query in that refetch.
      await queryClient.refetchQueries({ queryKey: ["my-clubs"], type: "all" });

      router.push("/onboarding/step-5");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to create club.");
      setLoading(false);
    }
  };

  // President and Member are mandatory and locked — they can't be toggled off.
  const LOCKED_ROLES: (keyof typeof roles)[] = ["president", "member"];

  const toggleRole = (role: keyof typeof roles) => {
    if (LOCKED_ROLES.includes(role)) return;
    setRoles((prev) => ({ ...prev, [role]: !prev[role] }));
  };

  return (
    <div className="bg-[#FFFFFF] text-[#000000] min-h-screen flex flex-col font-[Inter]">
      {/* TopAppBar */}
      <header className="flex justify-between items-center w-full px-6 py-4 bg-white top-0 border-b-2 border-black">
        <div className="text-black font-serif uppercase tracking-tighter font-black text-3xl">
          CLUB-HUB
        </div>
        <UserAvatarBadge />
      </header>

      {/* Main Content Canvas */}
      <main className="flex-grow flex flex-col justify-center items-center w-full px-6 max-w-[1600px] mx-auto py-[24px]">
        {/* Top Area (Progress and Title) */}
        <div className="w-full flex flex-col items-center mb-[32px]">
          {/* Progress Bar */}
          <div className="w-full max-w-2xl flex flex-col gap-[4px] mb-[48px]">
            <div className="flex justify-between items-center w-full">
              <span className="font-[Space_Grotesk] text-[13px] text-[#000000] uppercase tracking-widest">Step 4 of 5</span>
              <span className="font-[Space_Grotesk] text-[13px] text-[#000000]">80%</span>
            </div>
            <div className="w-full h-[1px] bg-[#E2E8F0] relative overflow-hidden">
              <div className="absolute top-0 left-0 h-full bg-[#000000] transition-all duration-1000 ease-out" style={{ width: progress }}></div>
            </div>
          </div>
          <h1 className="font-serif text-[64px] leading-[1.05] tracking-[-0.5px] text-[#000000] text-center mb-[8px]">
            Establish your Hierarchy
          </h1>
          <p className="font-serif text-[19px] leading-[1.47] text-[#757575] text-center max-w-2xl mb-[48px]">
            Select the structural roles necessary for your organization&apos;s operational density.
          </p>
        </div>

        {/* Hierarchy Selection Grid */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-y-0 gap-x-[24px] border-t border-[#000000] pt-[24px]">
          {/* Column 1 */}
          <div className="flex flex-col">
            <button
              onClick={() => toggleRole("president")}
              className="w-full text-left p-[16px] flex items-center justify-between group transition-colors duration-0 mb-[8px] bg-[#000000] text-[#FFFFFF] border-[2px] border-[#057DBC] cursor-default"
              title="President is always included and cannot be removed."
            >
              <span className="font-[Inter] text-[16px] font-bold">President</span>
              <span className="material-symbols-outlined text-[#057DBC]" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
            </button>
            <div className="w-full h-[1px] bg-[#E2E8F0] mb-[8px] hidden md:block"></div>
            
            <button
              onClick={() => toggleRole("secretary")}
              className={`w-full text-left p-[16px] flex items-center justify-between group transition-colors duration-0 mb-[8px] ${roles.secretary ? "bg-[#000000] text-[#FFFFFF] border-[2px] border-[#057DBC]" : "bg-[#FFFFFF] text-[#000000] border-2 border-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF]"}`}
            >
              <span className="font-[Inter] text-[16px] font-bold">Secretary</span>
              {roles.secretary ? (
                <span className="material-symbols-outlined text-[#057DBC]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              ) : (
                <span className="material-symbols-outlined text-transparent group-hover:text-[#FFFFFF]">add</span>
              )}
            </button>
            <div className="w-full h-[1px] bg-[#E2E8F0] mb-[8px] hidden md:block"></div>

            <button
              onClick={() => toggleRole("lead")}
              className={`w-full text-left p-[16px] flex items-center justify-between group transition-colors duration-0 mb-[8px] ${roles.lead ? "bg-[#000000] text-[#FFFFFF] border-[2px] border-[#057DBC]" : "bg-[#FFFFFF] text-[#000000] border-2 border-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF]"}`}
            >
              <span className="font-[Inter] text-[16px] font-bold">Lead</span>
              {roles.lead ? (
                <span className="material-symbols-outlined text-[#057DBC]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              ) : (
                <span className="material-symbols-outlined text-transparent group-hover:text-[#FFFFFF]">add</span>
              )}
            </button>
            <div className="w-full h-[1px] bg-[#E2E8F0] mb-[8px] hidden md:block"></div>

            <button
              onClick={() => toggleRole("member")}
              className="w-full text-left p-[16px] flex items-center justify-between group transition-colors duration-0 mb-[8px] bg-[#000000] text-[#FFFFFF] border-[2px] border-[#057DBC] cursor-default"
              title="Member is always included and cannot be removed."
            >
              <span className="font-[Inter] text-[16px] font-bold">Member</span>
              <span className="material-symbols-outlined text-[#057DBC]" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
            </button>
          </div>

          {/* Column 2 */}
          <div className="flex flex-col">
            <button
              onClick={() => toggleRole("vicePresident")}
              className={`w-full text-left p-[16px] flex items-center justify-between group transition-colors duration-0 mb-[8px] ${roles.vicePresident ? "bg-[#000000] text-[#FFFFFF] border-[2px] border-[#057DBC]" : "bg-[#FFFFFF] text-[#000000] border-2 border-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF]"}`}
            >
              <span className="font-[Inter] text-[16px] font-bold">Vice President</span>
              {roles.vicePresident ? (
                <span className="material-symbols-outlined text-[#057DBC]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              ) : (
                <span className="material-symbols-outlined text-transparent group-hover:text-[#FFFFFF]">add</span>
              )}
            </button>
            <div className="w-full h-[1px] bg-[#E2E8F0] mb-[8px] hidden md:block"></div>

            <button
              onClick={() => toggleRole("jointSecretary")}
              className={`w-full text-left p-[16px] flex items-center justify-between group transition-colors duration-0 mb-[8px] ${roles.jointSecretary ? "bg-[#000000] text-[#FFFFFF] border-[2px] border-[#057DBC]" : "bg-[#FFFFFF] text-[#000000] border-2 border-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF]"}`}
            >
              <span className="font-[Inter] text-[16px] font-bold">Joint Secretary</span>
              {roles.jointSecretary ? (
                <span className="material-symbols-outlined text-[#057DBC]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              ) : (
                <span className="material-symbols-outlined text-transparent group-hover:text-[#FFFFFF]">add</span>
              )}
            </button>
            <div className="w-full h-[1px] bg-[#E2E8F0] mb-[8px] hidden md:block"></div>

            <button
              onClick={() => toggleRole("associateLead")}
              className={`w-full text-left p-[16px] flex items-center justify-between group transition-colors duration-0 mb-[8px] ${roles.associateLead ? "bg-[#000000] text-[#FFFFFF] border-[2px] border-[#057DBC]" : "bg-[#FFFFFF] text-[#000000] border-2 border-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF]"}`}
            >
              <span className="font-[Inter] text-[16px] font-bold">Associate Lead</span>
              {roles.associateLead ? (
                <span className="material-symbols-outlined text-[#057DBC]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              ) : (
                <span className="material-symbols-outlined text-transparent group-hover:text-[#FFFFFF]">add</span>
              )}
            </button>
          </div>
        </div>

        {/* Action Area */}
        <div className="w-full max-w-4xl mt-[32px] pt-[24px] border-t border-[#000000] flex justify-between items-center">
          <button onClick={() => router.back()} className="font-[Inter] text-[16px] font-bold text-[#000000] bg-[#FFFFFF] border-2 border-[#000000] py-[8px] px-[24px] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors duration-0 flex items-center gap-[4px]" type="button">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            BACK
          </button>
          <button 
            onClick={handleFinish} 
            disabled={loading}
            className="font-[Inter] text-[16px] font-bold text-[#FFFFFF] bg-[#000000] border-2 border-[#000000] py-[8px] px-[24px] hover:bg-[#FFFFFF] hover:text-[#000000] transition-colors duration-0 flex items-center gap-[4px] disabled:opacity-50" 
            type="button"
          >
            {loading ? "CREATING..." : "FINISH"}
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#1A1A1A] text-white font-[Space_Grotesk] text-xs tracking-tight uppercase p-12 w-full flex flex-col md:flex-row justify-between items-center gap-4 px-8 mt-auto">
        <div className="text-white font-black tracking-widest text-center md:text-left">
          © 2024 CLUB-HUB EDITORIAL. ALL RIGHTS RESERVED.
        </div>
        <div className="flex flex-wrap justify-center gap-[24px]">
          <Link href="#" className="text-neutral-400 hover:text-white underline transition-none">Privacy</Link>
          <Link href="#" className="text-neutral-400 hover:text-white underline transition-none">Terms</Link>
          <Link href="#" className="text-neutral-400 hover:text-white underline transition-none">Contact</Link>
          <Link href="#" className="text-neutral-400 hover:text-white underline transition-none">Archive</Link>
        </div>
      </footer>
    </div>
  );
}
