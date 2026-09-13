"use client";

import { useState } from "react";

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}

/**
 * Fills its parent box (give the parent the size/border/rounding) with the user's photo,
 * or — no avatar_url, or the URL fails to load (dead link, or a third-party placeholder
 * service that's offline/blocked) — a plain first-letter initial. The fallback is pure CSS,
 * so unlike a generated-avatar service it can never itself show the browser's broken-image
 * glyph.
 */
export function Avatar({ name, avatarUrl, className = "" }: AvatarProps) {
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

  return (
    <div
      className={`w-full h-full flex items-center justify-center bg-black text-paper font-display font-bold ${className}`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}
