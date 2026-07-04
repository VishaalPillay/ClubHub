"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { directory } from "@/lib/api/clubs";
import { useAuth } from "@/lib/auth/AuthProvider";

/** Public club directory — every club with is_public=true. Joining still needs the invite code. */
export default function DirectoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: clubs = [], isPending } = useQuery({
    queryKey: ["directory"],
    queryFn: directory,
  });

  const filtered = clubs.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.description ?? "").toLowerCase().includes(q) ||
      (c.institution ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-white text-black min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center w-full px-8 py-4 bg-white border-b-2 border-black sticky top-0 z-30">
        <button
          onClick={() => router.push("/portal")}
          className="font-display text-[32px] font-black uppercase tracking-tighter hover:text-link-blue transition-colors"
        >
          CLUB-HUB
        </button>
        <div className="flex items-center gap-6">
          <span className="font-mono text-[12px] uppercase tracking-widest text-[#757575]">
            {user.name}
          </span>
          <button
            onClick={() => router.push("/portal")}
            className="font-ui text-[12px] font-bold border-2 border-black px-4 py-2 uppercase hover:bg-black hover:text-white transition-colors"
          >
            My Portal
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-8 py-12">
        <div className="border-b-2 border-black pb-6 mb-8">
          <p className="font-mono text-[12px] uppercase tracking-widest text-[#757575] mb-3">
            Public Directory
          </p>
          <h1 className="font-display text-[64px] leading-[0.93] tracking-[-0.5px] font-bold">
            Discover clubs.
          </h1>
          <p className="font-body text-lg text-[#4c4546] mt-3 max-w-2xl">
            Browse every public club on the network. To join one, ask its leadership for the
            invite code and use it below.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-10 items-stretch md:items-center justify-between">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, description, or institution..."
            className="border-2 border-black bg-white text-black p-3 font-ui text-[15px] w-full md:max-w-md focus:outline-none focus:border-[#057DBC]"
          />
          <button
            onClick={() => router.push("/onboarding/join-flow")}
            className="font-ui text-[12px] font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-6 py-3 uppercase hover:bg-white hover:text-[#057DBC] transition-colors shrink-0"
          >
            Have a code? Join a club
          </button>
        </div>

        {isPending ? (
          <div className="font-mono text-12 uppercase tracking-widest text-[#757575] animate-pulse">
            Loading directory...
          </div>
        ) : filtered.length === 0 ? (
          <div className="border-2 border-dashed border-[#e2e8f0] p-16 flex flex-col items-center justify-center text-center">
            <span className="material-symbols-outlined text-[48px] text-[#757575] mb-4">
              search_off
            </span>
            <p className="font-mono text-[12px] uppercase tracking-widest text-[#757575]">
              No clubs match your search.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((club, idx) => (
              <motion.div
                key={club.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.4) }}
                className="border-2 border-black bg-white flex flex-col"
              >
                <div className="h-1 bg-black w-full" />
                <div className="p-8 flex flex-col flex-1">
                  {club.institution && (
                    <span className="inline-block w-max font-mono text-[10px] uppercase tracking-widest px-3 py-1 bg-[#f3f3f3] border border-black mb-4">
                      {club.institution}
                    </span>
                  )}
                  <h2 className="font-display text-[40px] leading-[0.95] tracking-[-0.5px] font-bold text-black uppercase mb-3 break-words">
                    {club.name}
                  </h2>
                  {club.description && (
                    <p className="font-ui text-[14px] text-[#757575] leading-relaxed">
                      {club.description}
                    </p>
                  )}
                  <div className="mt-auto pt-4 border-t border-[#e2e8f0]">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#757575]">
                      Invite-only · ask leadership for the code
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <footer className="bg-[#1a1a1a] text-white py-10 px-8 flex justify-between items-center mt-auto">
        <div className="font-display text-[20px] font-black uppercase tracking-tighter text-white">
          CLUB-HUB
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#757575]">
          © 2026 CLUB-HUB EDITORIAL. ALL RIGHTS RESERVED.
        </div>
      </footer>
    </div>
  );
}
