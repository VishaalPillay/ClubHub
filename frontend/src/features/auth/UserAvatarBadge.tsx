"use client";

import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * Plain avatar badge for the onboarding header — replaces the old unwired
 * LOGIN/HELP buttons with the one thing that's actually true on these pages:
 * you're already signed in as this person.
 */
export default function UserAvatarBadge() {
  const { user } = useAuth();
  const src =
    user.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=000&color=fff&size=80`;

  return (
    <div
      className="w-10 h-10 border-2 border-black overflow-hidden flex-none"
      title={user.name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- runtime avatar URL (local /media, S3, or ui-avatars fallback) */}
      <img alt={user.name} src={src} className="w-full h-full object-cover" />
    </div>
  );
}
