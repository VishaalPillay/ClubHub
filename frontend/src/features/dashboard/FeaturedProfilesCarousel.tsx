"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/lib/api/leaderboard";
import { useClub } from "@/features/club/ClubProvider";
import { humanizeRole } from "@/lib/roles";

/** Top point-earners of the club (live leaderboard data), auto-advancing every 3s. */
export default function FeaturedProfilesCarousel() {
  const { clubId } = useClub();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const { data: entries = [] } = useQuery({
    queryKey: ["club", clubId, "leaderboard", null],
    queryFn: () => getLeaderboard(clubId),
  });

  const featured = entries.slice(0, 6);

  useEffect(() => {
    if (isHovered || featured.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featured.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isHovered, featured.length]);

  if (featured.length === 0) return null;

  const profile = featured[Math.min(currentIndex, featured.length - 1)];

  return (
    <div className="mt-4 border-t-1 border-hairline-tint pt-4">
      {/* Black Ribbon Header */}
      <div className="bg-black text-white px-2 py-1 mb-3 font-mono text-sm uppercase">
        Top Contributors
      </div>

      <div
        className="group relative cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="aspect-[4/3] border-2 border-black overflow-hidden mb-1 bg-[#e2e2e2] relative">
          <img
            key={profile.user_id}
            alt={profile.name}
            className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-300"
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=e2e2e2&color=000&size=400`}
          />
          {/* Domain Tag */}
          <div className="absolute top-2 left-2 bg-black text-white font-mono text-[11px] px-2 py-0.5 uppercase tracking-widest">
            {profile.domain_name ?? "Club-wide"}
          </div>
          {/* Rank Tag */}
          <div className="absolute top-2 right-2 bg-[#057DBC] text-white font-mono text-[11px] px-2 py-0.5 uppercase tracking-widest">
            #{profile.rank}
          </div>
        </div>
        <h4 className="font-ui text-xl font-bold mb-0.5">{profile.name}</h4>
        <div className="font-mono text-xs uppercase text-caption-gray mb-1 tracking-wider">
          {humanizeRole(profile.role)}
        </div>
        <p className="font-body text-base text-[#4c4546]">
          {profile.points.toLocaleString()} points earned this term.
        </p>

        {/* Carousel Indicators */}
        <div className="flex gap-1 mt-3">
          {featured.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 border border-black ${idx === currentIndex ? "bg-black" : "bg-transparent"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
