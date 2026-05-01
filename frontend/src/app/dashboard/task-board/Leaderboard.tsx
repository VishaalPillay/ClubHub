"use client";

import { useState } from "react";

const LEADERBOARD_DATA = [
  { id: 1, name: "Alex Chen", domain: "Technical", points: 1450, pic: "https://i.pravatar.cc/150?u=alex" },
  { id: 2, name: "Samira Tariq", domain: "Technical", points: 1320, pic: "https://i.pravatar.cc/150?u=samira" },
  { id: 3, name: "Maya Lin", domain: "Design", points: 1280, pic: "https://i.pravatar.cc/150?u=maya" },
  { id: 4, name: "Jordan Smith", domain: "Design", points: 1150, pic: "https://i.pravatar.cc/150?u=jordan" },
  { id: 5, name: "Sarah Johnson", domain: "Management", points: 1090, pic: "https://i.pravatar.cc/150?u=sarah" },
  { id: 6, name: "David Lee", domain: "Management", points: 950, pic: "https://i.pravatar.cc/150?u=david" },
  { id: 7, name: "Emma Wong", domain: "Technical", points: 890, pic: "https://i.pravatar.cc/150?u=emma" },
  { id: 8, name: "Liam Davis", domain: "Design", points: 820, pic: "https://i.pravatar.cc/150?u=liam" },
  { id: 9, name: "Olivia Martinez", domain: "Management", points: 750, pic: "https://i.pravatar.cc/150?u=olivia" },
  { id: 10, name: "Noah Wilson", domain: "Technical", points: 680, pic: "https://i.pravatar.cc/150?u=noah" },
  { id: 11, name: "Ava Taylor", domain: "Design", points: 620, pic: "https://i.pravatar.cc/150?u=ava" },
  { id: 12, name: "James Anderson", domain: "Management", points: 550, pic: "https://i.pravatar.cc/150?u=james" }
];

const ITEMS_PER_PAGE = 5;

export default function Leaderboard() {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(LEADERBOARD_DATA.length / ITEMS_PER_PAGE);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = LEADERBOARD_DATA.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="mt-12 w-full">
      {/* Editorial Ribbon Header */}
      <div className="bg-black w-full mb-6 flex justify-between items-center px-2 py-1">
        <h2 className="text-white font-mono text-12 uppercase tracking-widest">Leaderboard</h2>
      </div>

      <div className="w-full border-2 border-black">
        {/* Table Header */}
        <div className="grid grid-cols-12 bg-black text-white font-mono text-xs uppercase tracking-widest p-3">
          <div className="col-span-1 text-center">Rank</div>
          <div className="col-span-6">Member</div>
          <div className="col-span-3">Domain</div>
          <div className="col-span-2 text-right">Points</div>
        </div>

        {/* Table Body */}
        <div className="flex flex-col">
          {currentItems.map((item, index) => (
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
          ))}
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="mt-4 flex justify-between items-center border-t-2 border-black pt-4">
        <button 
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="font-ui text-14 font-bold border-2 border-black px-4 py-2 uppercase hover:bg-black hover:text-white transition-0 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-black"
        >
          Previous
        </button>
        <span className="font-mono text-12 tracking-widest uppercase">
          Page {currentPage} / {totalPages}
        </span>
        <button 
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="font-ui text-14 font-bold border-2 border-black px-4 py-2 uppercase hover:bg-black hover:text-white transition-0 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-black"
        >
          Next Page
        </button>
      </div>
    </div>
  );
}
