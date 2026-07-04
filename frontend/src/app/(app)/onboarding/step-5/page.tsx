"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function OnboardingStep5() {
  const router = useRouter();
  const [stage, setStage] = useState(0);
  const [code, setCode] = useState("");
  const [clubId, setClubId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Read after mount (in a callback, not the effect body) to avoid an SSR hydration mismatch.
    const t0 = setTimeout(() => {
      setCode(localStorage.getItem("onboarding_club_code") || "CS-XXXX");
      setClubId(localStorage.getItem("onboarding_club_id"));
    }, 0);
    const t1 = setTimeout(() => setStage(1), 100);
    const t2 = setTimeout(() => setStage(2), 900);
    const t3 = setTimeout(() => setStage(3), 1600);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div className="bg-[#FFFFFF] text-[#000000] min-h-screen flex flex-col items-center font-[Inter]">
      {/* Header */}
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

      {/* Main Content Canvas */}
      <main className="flex-grow flex items-center justify-center p-6 md:p-12 w-full max-w-[1600px] mx-auto">
        <div className="max-w-2xl w-full">
          {/* Context & Title */}
          <div className="mb-[48px] text-center flex flex-col items-center">
            <div className="w-full flex justify-center h-[32px] mb-[16px]">
              <div 
                className={`flex items-center justify-center overflow-hidden font-[Space_Grotesk] text-[13px] uppercase font-bold tracking-widest whitespace-nowrap transition-all duration-[700ms] ease-[cubic-bezier(0.85,0,0.15,1)]
                  ${stage < 2 
                    ? "bg-[#000000] h-[2px] text-transparent border-b-[0px] border-transparent" 
                    : "bg-transparent h-[30px] text-[#057DBC] border-b-2 border-[#057DBC] px-[8px]"
                  }
                `}
                style={{
                  width: stage === 0 ? "80%" : stage === 1 ? "100%" : "90px",
                }}
              >
                Launch
              </div>
            </div>
            
            <h1 className={`font-serif text-[64px] leading-[1.05] tracking-[-0.5px] text-[#000000] mb-[24px] transition-all duration-[800ms] transform ${stage >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              Your Club-Space is Ready!
            </h1>
            
            <p className={`font-serif text-[19px] leading-[1.47] text-[#757575] max-w-lg mx-auto transition-all duration-[800ms] delay-[200ms] transform ${stage >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              The foundation is set. It&apos;s time to populate your new editorial environment. Invite your first members or step directly into the command center.
            </p>
          </div>

          {/* Invite Code Module */}
          <div className="border-2 border-[#000000] mb-[48px] bg-[#FFFFFF] p-[32px] flex flex-col justify-between">
            <div>
              <h2 className="font-[Inter] text-[20px] font-bold leading-[1.20] tracking-[-0.28px] text-[#000000] mb-[8px] uppercase">
                Invite Code
              </h2>
              <p className="font-serif text-[16px] text-[#757575] mb-[24px]">
                Share this code with your members — they can join from the portal using
                &quot;Join a Club&quot;.
              </p>
            </div>
            <div className="flex items-stretch border-2 border-[#000000]">
              <input
                aria-label="Invite Code"
                className="w-full border-0 focus:ring-0 font-[Space_Grotesk] text-[12px] tracking-[1.1px] text-[#000000] font-bold bg-[#f3f3f3] px-4 py-3"
                readOnly
                type="text"
                value={code}
              />
              <button
                aria-label="Copy Code"
                className="bg-[#FFFFFF] border-l-2 border-[#000000] px-4 flex items-center justify-center hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors duration-100 group"
                onClick={async () => {
                  await navigator.clipboard.writeText(code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                <span className="material-symbols-outlined text-[#000000] group-hover:text-[#FFFFFF]">
                  {copied ? "check" : "content_copy"}
                </span>
              </button>
            </div>
          </div>

          {/* Primary Call to Action */}
          <div className="flex justify-center border-t border-[#E2E8F0] pt-[48px]">
            <button
              onClick={() => router.push(clubId ? `/c/${clubId}/dashboard` : "/portal")}
              className="bg-[#057DBC] border-2 border-[#000000] text-[#FFFFFF] font-[Inter] text-[16px] font-bold uppercase px-[48px] py-[16px] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors duration-100 flex items-center gap-[8px]"
            >
              Enter Dashboard
              <span className="material-symbols-outlined">arrow_forward</span>
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
