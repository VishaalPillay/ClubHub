"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { myClubs } from "@/lib/api/clubs";
import UserAvatarBadge from "@/features/auth/UserAvatarBadge";

export default function OnboardingStep1() {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(""); // "join" | "create"
  const [progress, setProgress] = useState("0%");
  const { data: clubs = [], isPending: clubsLoading } = useQuery({
    queryKey: ["my-clubs"],
    queryFn: myClubs,
  });
  const isFirstClub = clubs.length === 0;

  useEffect(() => {
    const timer = setTimeout(() => setProgress("20%"), 100);
    return () => clearTimeout(timer);
  }, []);

  if (clubsLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="font-mono text-[13px] uppercase tracking-widest text-[#757575] animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FFFFFF] text-[#000000] min-h-screen flex flex-col">
      {/* TopAppBar */}
      <header className="flex justify-between items-center w-full px-6 py-4 bg-white top-0 border-b-2 border-black">
        <div className="text-black font-serif uppercase tracking-tighter font-black text-3xl">
          CLUB-HUB
        </div>
        <UserAvatarBadge />
      </header>

      {/* Main Canvas */}
      <main className="flex-grow flex flex-col justify-center items-center px-[24px] py-[48px] w-full max-w-[1600px] mx-auto">
        <div className="w-full max-w-5xl">
          {/* Header Area with Progress */}
          <div className="w-full flex flex-col items-center mb-[48px]">
            <div className="w-full max-w-5xl flex flex-col gap-[4px] mb-[32px]">
              <div className="flex justify-between items-center w-full">
                <span className="font-[Space_Grotesk] text-[13px] text-[#000000] uppercase tracking-widest">Step 1 of 5</span>
                <span className="font-[Space_Grotesk] text-[13px] text-[#000000]">20%</span>
              </div>
              <div className="w-full h-[2px] bg-[#E2E8F0] relative overflow-hidden">
                <div className="absolute top-0 left-0 h-full bg-[#000000] transition-all duration-1000 ease-out" style={{ width: progress }}></div>
              </div>
            </div>
            <header className="border-b border-[#000000] pb-[32px] w-full max-w-5xl">
              <p className="font-[Space_Grotesk] text-[13px] tracking-[1px] text-[#757575] mb-[16px] uppercase">
                Organization Configuration
              </p>
              <h1 className="font-serif text-[64px] leading-[1.05] tracking-[-0.5px] text-[#000000]">
                {isFirstClub ? (
                  <>Your First Club!<br />Let&apos;s get started.</>
                ) : (
                  <>New Club,<br />Let&apos;s get started.</>
                )}
              </h1>
            </header>
          </div>

          {/* Interactive Selection Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px] mb-[48px]">
            {/* Card 1: Join */}
            <button
              onClick={() => setSelected("join")}
              className={`flex flex-col items-start p-[32px] border-2 bg-[#FFFFFF] text-left transition-all duration-100 hover:bg-[#f3f3f3] group relative ${selected === "join" ? "border-[#057DBC] outline outline-2 outline-[#057DBC] outline-offset-2" : "border-[#000000]"}`}
              type="button"
            >
              {selected === "join" && (
                <div className="absolute top-6 right-6">
                  <span className="material-symbols-outlined text-[#057DBC]" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                </div>
              )}
              <div className="w-full flex justify-between items-start mb-[24px]">
                <span className={`material-symbols-outlined text-[48px] ${selected === "join" ? "text-[#057DBC]" : "text-[#000000]"}`}>group_add</span>
              </div>
              <h2 className={`font-[Inter] text-[20px] font-bold leading-[1.20] tracking-[-0.28px] ${selected === "join" ? "text-[#057DBC]" : "text-[#000000]"} mb-[8px] group-hover:underline`}>
                Join an Existing Club
              </h2>
              <p className="font-serif text-[16px] leading-[1.50] text-[#757575]">
                Search the global directory to request access to an established organization within the network.
              </p>
            </button>

            {/* Card 2: Create */}
            <button
              onClick={() => setSelected("create")}
              className={`flex flex-col items-start p-[32px] border-2 bg-[#FFFFFF] text-left transition-all duration-100 hover:bg-[#f3f3f3] group relative ${selected === "create" ? "border-[#057DBC] outline outline-2 outline-[#057DBC] outline-offset-2" : "border-[#000000]"}`}
              type="button"
            >
              {selected === "create" && (
                <div className="absolute top-6 right-6">
                  <span className="material-symbols-outlined text-[#057DBC]" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                </div>
              )}
              <div className="w-full flex justify-between items-start mb-[24px]">
                <span className={`material-symbols-outlined text-[48px] ${selected === "create" ? "text-[#057DBC]" : "text-[#000000]"}`}>add_box</span>
              </div>
              <h2 className={`font-[Inter] text-[20px] font-bold leading-[1.20] tracking-[-0.28px] ${selected === "create" ? "text-[#057DBC]" : "text-[#000000]"} mb-[8px] group-hover:underline`}>
                Create a Club Space
              </h2>
              <p className="font-serif text-[16px] leading-[1.50] text-[#757575]">
                Initialize a brand new secure space for your organization, setting up rules, rosters, and identity.
              </p>
            </button>
          </div>

          {/* Action Area */}
          <div className="w-full mt-[32px] pt-[24px] border-t border-[#000000] flex justify-between items-center">
            <button onClick={() => router.back()} className="font-[Inter] text-[16px] font-bold text-[#000000] bg-[#FFFFFF] border-2 border-[#000000] py-[8px] px-[24px] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors duration-0 flex items-center gap-[4px]" type="button">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              BACK
            </button>
            <button
              onClick={() => {
                if (selected === "join") router.push("/onboarding/join-flow");
                else if (selected === "create") router.push("/onboarding/step-2");
              }}
              disabled={!selected}
              className="font-[Inter] text-[16px] font-bold text-[#FFFFFF] bg-[#000000] border-2 border-[#000000] py-[8px] px-[24px] hover:bg-[#FFFFFF] hover:text-[#000000] transition-colors duration-0 flex items-center gap-[4px] disabled:opacity-40"
              type="button"
            >
              CONTINUE
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#1A1A1A] text-white font-[Space_Grotesk] text-xs tracking-tight uppercase w-full flex flex-col md:flex-row justify-between items-center gap-4 px-8 py-12 mt-auto">
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
