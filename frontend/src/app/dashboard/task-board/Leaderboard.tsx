"use client";

import { useState } from "react";

export type LeaderboardMember = {
  id: number;
  name: string;
  domain: string;
  points: number;
  pic: string;
};

const ITEMS_PER_PAGE = 5;

export default function Leaderboard({ members }: { members: LeaderboardMember[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const sortedMembers = [...members].sort((a, b) => b.points - a.points);
  const totalPages = Math.ceil(sortedMembers.length / ITEMS_PER_PAGE) || 1;

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = sortedMembers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="mt-12 w-full">
      <div className="bg-black w-full mb-6 flex justify-between items-center px-2 py-1">
        <h2 className="text-white font-mono text-12 uppercase tracking-widest">Leaderboard</h2>
      </div>

      <div className="w-full border-2 border-black">
        <div className="grid grid-cols-12 bg-black text-white font-mono text-xs uppercase tracking-widest p-3">
          <div className="col-span-1 text-center">Rank</div>
          <div className="col-span-6">Member</div>
          <div className="col-span-3">Domain</div>
          <div className="col-span-2 text-right">Points</div>
        </div>

        <div className="flex flex-col">
          {currentItems.length > 0 ? currentItems.map((item, index) => (
            <div 
              key={item.id} 
              className="grid grid-cols-12 items-center p-3 border-b-2 border-black last:border-b-0 hover:bg-hairline-tint transition-colors"
            >
              <div className="col-span-1 text-center font-display text-xl font-bold text-caption-gray">
                #{startIndex + index + 1}
              </div>
              <div className="col-span-6 flex items-center gap-3">
                <div className="w-10 h-10 border-2 border-black overflow-hidden bg-[#e2e2e2] shrink-0">
                  <img 
                    alt={item.name} 
                    className="w-full h-full object-cover grayscale" 
                    src={item.pic}
                  />
                </div>
                <div className="font-ui text-16 font-bold truncate">{item.name}</div>
              </div>
              <div className="col-span-3 font-mono text-12 uppercase tracking-wider text-caption-gray">
                {item.domain}
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
