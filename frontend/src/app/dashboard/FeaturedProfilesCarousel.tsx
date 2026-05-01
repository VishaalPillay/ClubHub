"use client";

import { useState, useEffect } from "react";

const FEATURED_PROFILES = [
  {
    id: 1,
    name: "Alex Chen",
    role: "Lead Developer",
    domain: "Technical",
    image: "https://i.pravatar.cc/300?u=alex",
    description: "Driving the backend architecture for the new portal overhaul."
  },
  {
    id: 2,
    name: "Samira Tariq",
    role: "Systems Architect",
    domain: "Technical",
    image: "https://i.pravatar.cc/300?u=samira",
    description: "Optimizing database queries and maintaining uptime during peak events."
  },
  {
    id: 3,
    name: "Maya Lin",
    role: "UI/UX Lead",
    domain: "Design",
    image: "https://i.pravatar.cc/300?u=maya",
    description: "Spearheading the new brutalist design system implementation."
  },
  {
    id: 4,
    name: "Jordan Smith",
    role: "Visual Designer",
    domain: "Design",
    image: "https://i.pravatar.cc/300?u=jordan",
    description: "Creating the print-ready assets for the upcoming winter gala."
  },
  {
    id: 5,
    name: "Sarah Johnson",
    role: "Project Manager",
    domain: "Management",
    image: "https://i.pravatar.cc/300?u=sarah",
    description: "Keeping all cross-functional teams aligned for the Q4 deliverables."
  },
  {
    id: 6,
    name: "David Lee",
    role: "Communications Head",
    domain: "Management",
    image: "https://i.pravatar.cc/300?u=david",
    description: "Managing external PR and student body outreach campaigns."
  }
];

export default function FeaturedProfilesCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % FEATURED_PROFILES.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isHovered]);

  const profile = FEATURED_PROFILES[currentIndex];

  return (
    <div className="mt-4 border-t-1 border-hairline-tint pt-4">
      {/* Black Ribbon Header */}
      <div className="bg-black text-white px-2 py-1 mb-3 font-mono text-sm uppercase">
        Featured Profiles
      </div>
      
      <div 
        className="group relative cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="aspect-[4/3] border-2 border-black overflow-hidden mb-1 bg-[#e2e2e2] relative">
          {/* We map through all to preload images and use opacity for smooth transitions if needed, 
              or simply render the current one. Simple render is fine. */}
          <img 
            key={profile.id}
            alt={profile.name} 
            className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-300" 
            src={profile.image} 
          />
          {/* Domain Tag */}
          <div className="absolute top-2 left-2 bg-black text-white font-mono text-[11px] px-2 py-0.5 uppercase tracking-widest">
            {profile.domain}
          </div>
        </div>
        <h4 className="font-ui text-xl font-bold mb-0.5">{profile.name}</h4>
        <div className="font-mono text-xs uppercase text-caption-gray mb-1 tracking-wider">{profile.role}</div>
        <p className="font-body text-base text-[#4c4546]">{profile.description}</p>

        {/* Carousel Indicators */}
        <div className="flex gap-1 mt-3">
          {FEATURED_PROFILES.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1 flex-1 border border-black ${idx === currentIndex ? 'bg-black' : 'bg-transparent'}`} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}
