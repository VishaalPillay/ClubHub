"use client";

import { useState } from "react";

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  /** "solid" (default) fills black with a white/paper initial — the nav trigger, leaderboard,
   *  member list. "outline" inverts that: a paper-white fill with a black initial, for contexts
   *  that want the opposite emphasis (e.g. the dashboard's Top Contributors card, which is
   *  already framed by its own black border/ribbon). */
  variant?: "solid" | "outline";
}

/**
 * Fills its parent box (give the parent the size/border/rounding) with the user's photo,
 * or — no avatar_url, or the URL fails to load (dead link, or a third-party placeholder
 * service that's offline/blocked) — a plain first-letter initial. The fallback is pure CSS,
 * so unlike a generated-avatar service it can never itself show the browser's broken-image
 * glyph.
 */
export function Avatar({ name, avatarUrl, className = "", variant = "solid" }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  // Adjust state during render (React's recommended alternative to an effect for this
  // exact case, already used in CollegeSelect.tsx) — a new avatarUrl deserves a fresh
  // chance to load before falling back again.
  const [prevAvatarUrl, setPrevAvatarUrl] = useState(avatarUrl);
  if (avatarUrl !== prevAvatarUrl) {
    setPrevAvatarUrl(avatarUrl);
    setFailed(false);
  }

  if (avatarUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- runtime avatar URL (local /media or S3), not a static asset
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setFailed(true)}
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  const fillClass = variant === "outline" ? "bg-paper text-black" : "bg-black text-paper";
  return (
    <div
      className={`w-full h-full flex items-center justify-center leading-none font-display font-bold ${fillClass} ${className}`}
    >
      {/* leading-none: the default line-height added enough space above/below the glyph
          to visibly throw off flexbox centering — this initial should sit dead center. */}
      <span className="translate-y-[0.08em]">{name.trim().charAt(0).toUpperCase() || "?"}</span>
    </div>
  );
}
