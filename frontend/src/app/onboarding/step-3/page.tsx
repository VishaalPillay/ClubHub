"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function OnboardingStep3() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [domains, setDomains] = useState<string[]>(["Technical", "Management", "Creative"]);
  const [progress, setProgress] = useState("40%");

  useEffect(() => {
    const timer = setTimeout(() => setProgress("60%"), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (domain.trim() && !domains.includes(domain.trim())) {
      setDomains([...domains, domain.trim()]);
      setDomain("");
    }
  };

  const removeDomain = (domainToRemove: string) => {
    setDomains(domains.filter(d => d !== domainToRemove));
  };

  return (
    <div className="bg-[#FFFFFF] text-[#000000] min-h-screen flex flex-col font-serif">
      {/* TopAppBar */}
      <header className="flex justify-between items-center w-full px-6 py-4 bg-white top-0 border-b-2 border-black">
        <div className="text-black font-serif uppercase tracking-tighter font-black text-3xl">
          CLUB-HUB
        </div>
        <div className="flex gap-4">
          <button className="font-[Inter] text-[16px] font-bold border-2 border-[#000000] bg-[#FFFFFF] text-[#000000] px-4 py-2 hover:bg-[#000000] hover:text-[#FFFFFF] transition-none uppercase">
            LOGIN
          </button>
          <button className="font-[Inter] text-[16px] font-bold border-2 border-[#000000] bg-[#FFFFFF] text-[#000000] px-4 py-2 hover:bg-[#000000] hover:text-[#FFFFFF] transition-none uppercase">
            HELP
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col justify-center items-center px-6 py-[24px] w-full max-w-[1600px] mx-auto">
        <div className="w-full max-w-[600px] flex flex-col">
          {/* Progress Indicator */}
          <header className="w-full mb-[32px]">
            <div className="flex justify-between items-end mb-[4px]">
              <span className="font-[Space_Grotesk] text-[13px] uppercase tracking-[2px] text-[#000000]">Step 3 of 5</span>
              <span className="font-[Space_Grotesk] text-[13px] text-[#757575]">60%</span>
            </div>
            {/* Base hairline track */}
            <div className="w-full h-[2px] bg-[#E2E8F0] relative overflow-hidden">
              {/* Active progress fill */}
              <div className="absolute top-0 left-0 h-[2px] bg-[#000000] transition-all duration-1000 ease-out" style={{ width: progress }}></div>
            </div>
          </header>

          {/* Context & Title */}
          <div className="mb-[32px]">
            <h1 className="font-serif text-[64px] leading-[1.05] tracking-[-0.5px] text-[#000000] mb-[8px]">
              Define your Domains
            </h1>
            <p className="font-serif text-[19px] leading-[1.47] text-[#4c4546] max-w-md">
              What departments make up your club?
            </p>
          </div>

          {/* Input Area */}
          <form onSubmit={handleAddDomain} className="flex flex-col sm:flex-row gap-4 mb-[32px] w-full">
            <div className="flex-1 relative">
              <input
                className="w-full bg-[#FFFFFF] border-2 border-[#000000] rounded-none px-4 py-3 font-[Inter] text-[16px] font-bold text-[#000000] placeholder:text-[#757575] focus:outline-none focus:ring-0 focus:border-[#000000] transition-none"
                placeholder="e.g. Marketing, Finance, Logistics"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="bg-[#FFFFFF] border-2 border-[#000000] text-[#000000] font-[Inter] text-[16px] font-bold px-8 py-3 rounded-none uppercase hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors duration-0 whitespace-nowrap"
            >
              Add Domain
            </button>
          </form>

          {/* Domain Pills */}
          <div className="border-t border-[#000000] pt-[24px]">
            <h3 className="font-[Space_Grotesk] text-[13px] text-[#000000] uppercase mb-4">
              Active Domains
            </h3>
            <div className="flex flex-wrap gap-3">
              {domains.map((d, i) => (
                <div key={i} className="inline-flex items-center gap-2 border-2 border-[#000000] bg-[#FFFFFF] px-3 py-1.5 rounded-none group hover:bg-[#f3f3f3] transition-colors cursor-default">
                  <span className="font-[Space_Grotesk] text-[12px] text-[#000000] uppercase">
                    {d}
                  </span>
                  <button onClick={() => removeDomain(d)} className="text-[#757575] hover:text-[#000000] transition-colors focus:outline-none flex items-center justify-center">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Area */}
          <div className="w-full mt-[32px] pt-[24px] border-t border-[#000000] flex justify-between items-center">
            <button onClick={() => router.back()} className="font-[Inter] text-[16px] font-bold text-[#000000] bg-[#FFFFFF] border-2 border-[#000000] py-[8px] px-[24px] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors duration-0 flex items-center gap-[4px]" type="button">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              BACK
            </button>
            <button onClick={() => router.push("/onboarding/step-4")} className="font-[Inter] text-[16px] font-bold text-[#FFFFFF] bg-[#000000] border-2 border-[#000000] py-[8px] px-[24px] hover:bg-[#FFFFFF] hover:text-[#000000] transition-colors duration-0 flex items-center gap-[4px]" type="button">
              CONTINUE
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
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
