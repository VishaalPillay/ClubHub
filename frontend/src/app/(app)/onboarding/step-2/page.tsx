"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import UserAvatarBadge from "@/features/auth/UserAvatarBadge";

export default function OnboardingStep2() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", institution: "" });
  const [progress, setProgress] = useState("20%");

  useEffect(() => {
    const timer = setTimeout(() => setProgress("40%"), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-[#FFFFFF] text-[#000000] min-h-screen flex flex-col">
      {/* TopAppBar */}
      <header className="flex justify-between items-center w-full px-6 py-4 bg-white top-0 border-b-2 border-black">
        <div className="text-black font-serif uppercase tracking-tighter font-black text-3xl">
          CLUB-HUB
        </div>
        <UserAvatarBadge />
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center w-full px-6 py-[24px]">
        {/* Main Onboarding Canvas */}
        <div className="w-full max-w-[720px] flex flex-col">
          {/* Progress Indicator (Structural Hairline) */}
          <header className="w-full mb-[32px]">
            <div className="flex justify-between items-end mb-[4px]">
              <span className="font-[Space_Grotesk] text-[13px] uppercase tracking-[2px] text-[#000000]">Step 2 of 5</span>
              <span className="font-[Space_Grotesk] text-[13px] text-[#757575]">40%</span>
            </div>
            {/* Base hairline track */}
            <div className="w-full h-[2px] bg-[#E2E8F0] relative overflow-hidden">
              {/* Active progress fill */}
              <div className="absolute top-0 left-0 h-[2px] bg-[#000000] transition-all duration-1000 ease-out" style={{ width: progress }}></div>
            </div>
          </header>

          {/* Editorial Header Block */}
          <section className="mb-[32px] border-b-2 border-[#000000] pb-[16px]">
            <h1 className="font-serif text-[64px] leading-[1.05] tracking-[-0.5px] text-[#000000] mb-[8px]">
              Name your Club-Space.
            </h1>
            <p className="font-serif text-[19px] leading-[1.47] text-[#757575] max-w-[500px]">
              Establish the typographic identity of your organization.
            </p>
          </section>

          {/* Brutalist Form Layout */}
          <form className="flex flex-col gap-[32px]">
            {/* Full Name Input */}
            <div className="flex flex-col gap-[8px]">
              <label className="font-[Inter] text-[16px] font-bold uppercase text-[#000000]" htmlFor="club-name">
                Full Club Name
              </label>
              <input
                className="w-full border-2 border-[#000000] bg-transparent rounded-none px-[16px] py-[8px] font-serif text-[16px] text-[#000000] placeholder:text-[#999999] focus:outline-none focus:ring-0 focus:border-[#057DBC] transition-colors"
                id="club-name"
                placeholder="e.g. The Architecture League"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* College / Institution Input */}
            <div className="flex flex-col gap-[8px]">
              <label className="font-[Inter] text-[16px] font-bold uppercase text-[#000000]" htmlFor="club-institution">
                College / Institution
              </label>
              <input
                className="w-full border-2 border-[#000000] bg-transparent rounded-none px-[16px] py-[8px] font-serif text-[16px] text-[#000000] placeholder:text-[#999999] focus:outline-none focus:ring-0 focus:border-[#057DBC] transition-colors"
                id="club-institution"
                placeholder="e.g. Stanford University"
                type="text"
                value={form.institution}
                onChange={(e) => setForm({ ...form, institution: e.target.value })}
              />
            </div>

            {/* Action Area */}
            <div className="w-full mt-[32px] pt-[24px] border-t border-[#000000] flex justify-between items-center">
              <button onClick={() => router.back()} className="font-[Inter] text-[16px] font-bold text-[#000000] bg-[#FFFFFF] border-2 border-[#000000] py-[8px] px-[24px] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors duration-0 flex items-center gap-[4px]" type="button">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                BACK
              </button>
              <button
                onClick={() => {
                  localStorage.setItem("onboarding_club_name", form.name);
                  localStorage.setItem("onboarding_club_institution", form.institution);
                  router.push("/onboarding/step-3");
                }}
                disabled={!form.name || !form.institution}
                className="font-[Inter] text-[16px] font-bold text-[#FFFFFF] bg-[#000000] border-2 border-[#000000] py-[8px] px-[24px] hover:bg-[#FFFFFF] hover:text-[#000000] transition-colors duration-0 flex items-center gap-[4px] disabled:opacity-50" type="button"
              >
                CONTINUE
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#1A1A1A] text-white font-[Space_Grotesk] text-xs tracking-tight uppercase w-full p-12 flex flex-col md:flex-row justify-between items-center gap-4 mt-auto">
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
