"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();

  return (
    <div className="bg-[#FFFFFF] text-[#000000] min-h-screen flex flex-col">
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
      <main className="flex-grow flex items-center justify-center w-full max-w-[1600px] mx-auto px-6 py-[48px]">
        <div className="w-full max-w-2xl border border-[#000000] p-[32px] md:p-[48px] bg-[#FFFFFF]">
          <div className="mb-[32px] border-b border-[#E2E8F0] pb-[24px]">

            <h1 className="font-serif text-[26px] md:text-[64px] leading-[1.05] tracking-[-0.5px] text-[#000000] uppercase">
              CREATE YOUR ACCOUNT
            </h1>
          </div>
          
          <form className="space-y-[24px]">
            <div className="flex flex-col md:flex-row gap-[24px]">
              <div className="flex-1 flex flex-col gap-[8px]">
                <label className="font-[Inter] text-[16px] font-bold text-[#000000] uppercase" htmlFor="firstName">
                  First Name
                </label>
                <input
                  className="border-2 border-[#000000] bg-[#FFFFFF] text-[#000000] p-3 font-serif text-[16px] focus:outline-none focus:ring-0 focus:border-[#000000] rounded-none"
                  id="firstName"
                  placeholder="Enter first name"
                  type="text"
                />
              </div>
              <div className="flex-1 flex flex-col gap-[8px]">
                <label className="font-[Inter] text-[16px] font-bold text-[#000000] uppercase" htmlFor="lastName">
                  Last Name
                </label>
                <input
                  className="border-2 border-[#000000] bg-[#FFFFFF] text-[#000000] p-3 font-serif text-[16px] focus:outline-none focus:ring-0 focus:border-[#000000] rounded-none"
                  id="lastName"
                  placeholder="Enter last name"
                  type="text"
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-[8px]">
              <label className="font-[Inter] text-[16px] font-bold text-[#000000] uppercase" htmlFor="email">
                Email
              </label>
              <input
                className="border-2 border-[#000000] bg-[#FFFFFF] text-[#000000] p-3 font-serif text-[16px] focus:outline-none focus:ring-0 focus:border-[#000000] rounded-none"
                id="email"
                placeholder="Enter email address"
                type="email"
              />
            </div>
            
            <div className="flex flex-col gap-[8px]">
              <label className="font-[Inter] text-[16px] font-bold text-[#000000] uppercase" htmlFor="dob">
                Date of Birth
              </label>
              <div className="relative">
                <input
                  className="border-2 border-[#000000] bg-[#FFFFFF] text-[#000000] p-3 w-full font-serif text-[16px] focus:outline-none focus:ring-0 focus:border-[#000000] rounded-none appearance-none pr-12"
                  id="dob"
                  type="date"
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-[8px]">
              <label className="font-[Inter] text-[16px] font-bold text-[#000000] uppercase" htmlFor="password">
                Password
              </label>
              <input
                className="border-2 border-[#000000] bg-[#FFFFFF] text-[#000000] p-3 font-serif text-[16px] focus:outline-none focus:ring-0 focus:border-[#000000] rounded-none"
                id="password"
                placeholder="Create a password"
                type="password"
              />
            </div>
            
            <div className="pt-[24px] border-t border-[#E2E8F0] mt-[32px]">
              <button
                className="w-full bg-[#FFFFFF] border-2 border-[#000000] text-[#057DBC] font-[Inter] text-[16px] font-bold p-4 uppercase hover:bg-[#057DBC] hover:text-[#FFFFFF] hover:border-[#057DBC] transition-none flex justify-center items-center gap-2 rounded-none"
                type="button"
                onClick={() => router.push("/onboarding/step-1")}
              >
                NEXT STEP <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </form>
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
