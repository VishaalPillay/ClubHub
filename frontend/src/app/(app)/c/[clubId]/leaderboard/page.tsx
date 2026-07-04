"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useClub } from "@/features/club/ClubProvider";
import { getLeaderboard } from "@/lib/api/leaderboard";
import { listDomains } from "@/lib/api/domains";
import { humanizeRole } from "@/lib/roles";

const ITEMS_PER_PAGE = 10;

/** Club leaderboard — GET /clubs/{id}/leaderboard?domain_id= with a domain filter. */
export default function LeaderboardPage() {
  const { clubId, userId } = useClub();
  const [domainFilter, setDomainFilter] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: domains = [] } = useQuery({
    queryKey: ["club", clubId, "domains"],
    queryFn: () => listDomains(clubId),
  });

  const { data: entries = [], isPending } = useQuery({
    queryKey: ["club", clubId, "leaderboard", domainFilter],
    queryFn: () => getLeaderboard(clubId, domainFilter),
  });

  const totalPages = Math.ceil(entries.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = entries.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const myEntry = entries.find((e) => e.user_id === userId);

  return (
    <div className="w-full relative">
      {/* Editorial Ribbon Header */}
      <div className="flex justify-between items-end mb-6 w-full gap-4">
        <div className="flex flex-col flex-1">
          <div className="w-full h-[2px] bg-black"></div>
          <h1 className="bg-black text-white px-3 py-1 font-mono text-12 uppercase tracking-widest w-max inline-block">
            Leaderboard
          </h1>
        </div>
        <select
          value={domainFilter ?? ""}
          onChange={(e) => {
            setDomainFilter(e.target.value === "" ? null : Number(e.target.value));
            setCurrentPage(1);
          }}
          className="border-2 border-black p-2 font-mono text-12 uppercase bg-white outline-none focus:border-[#057DBC] shrink-0"
        >
          <option value="">All Domains</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* My standing */}
      {myEntry && (
        <div className="border-2 border-black bg-black text-white p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-display text-4xl font-bold">#{myEntry.rank}</span>
            <div>
              <div className="font-ui text-16 font-bold uppercase">Your Standing</div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-[#dadada]">
                {humanizeRole(myEntry.role)}{myEntry.domain_name ? ` · ${myEntry.domain_name}` : ""}
              </div>
            </div>
          </div>
          <div className="font-display text-4xl font-bold">{myEntry.points.toLocaleString()}<span className="font-mono text-[11px] uppercase tracking-widest ml-2">pts</span></div>
        </div>
      )}

      <div className="w-full border-2 border-black">
        <div className="grid grid-cols-12 bg-black text-white font-mono text-xs uppercase tracking-widest p-3">
          <div className="col-span-1 text-center">Rank</div>
          <div className="col-span-5">Member</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-2">Domain</div>
          <div className="col-span-2 text-right">Points</div>
        </div>

        <div className="flex flex-col">
          {isPending ? (
            <div className="p-4 text-center font-mono text-12 uppercase text-caption-gray animate-pulse">Loading standings...</div>
          ) : currentItems.length > 0 ? currentItems.map((item) => (
            <div
              key={item.user_id}
              className={`grid grid-cols-12 items-center p-3 border-b-2 border-black last:border-b-0 transition-colors ${item.user_id === userId ? "bg-[#f3f3f3]" : "hover:bg-hairline-tint"}`}
            >
              <div className="col-span-1 text-center font-display text-xl font-bold text-caption-gray">
                #{item.rank}
              </div>
              <div className="col-span-5 flex items-center gap-3">
                <div className="w-10 h-10 border-2 border-black overflow-hidden bg-[#e2e2e2] shrink-0">
                  <img
                    alt={item.name}
                    className="w-full h-full object-cover grayscale"
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=e2e2e2&color=000&size=150`}
                  />
                </div>
                <div className="font-ui text-16 font-bold truncate">
                  {item.name}
                  {item.user_id === userId && (
                    <span className="ml-2 font-mono text-[9px] uppercase bg-black text-white px-1.5 py-0.5 tracking-widest">You</span>
                  )}
                </div>
              </div>
              <div className="col-span-2 font-mono text-12 uppercase tracking-wider text-caption-gray">
                {humanizeRole(item.role)}
              </div>
              <div className="col-span-2 font-mono text-12 uppercase tracking-wider text-caption-gray">
                {item.domain_name ?? "—"}
              </div>
              <div className="col-span-2 text-right font-display text-2xl font-bold">
                {item.points.toLocaleString()}
              </div>
            </div>
          )) : (
            <div className="p-4 text-center font-ui text-14 text-caption-gray">No members found.</div>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-between items-center border-t-2 border-black pt-4">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="font-ui text-14 font-bold border-2 border-black px-4 py-2 uppercase hover:bg-black hover:text-white transition-0 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-black bg-white"
        >
          Previous
        </button>
        <span className="font-mono text-12 tracking-widest uppercase">
          Page {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="font-ui text-14 font-bold border-2 border-black px-4 py-2 uppercase hover:bg-black hover:text-white transition-0 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-black bg-white"
        >
          Next Page
        </button>
      </div>
    </div>
  );
}
