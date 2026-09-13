"use client";

import { useAuth } from "@/lib/auth/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";

/**
 * Name + avatar badge for the onboarding header — replaces the old unwired
 * LOGIN/HELP buttons with the one thing that's actually true on these pages:
 * you're already signed in as this person.
 *
 * First name only, same as `ProfileMenu`'s trigger in the portal/club shell —
 * this badge is otherwise a copy of that pattern, just without the settings
 * modal it opens (there is no profile menu here, only the identity).
 */
export default function UserAvatarBadge() {
  const { user } = useAuth();

  return (
    <div className="flex items-center gap-3 font-ui text-[15px]" title={user.name}>
      <span className="font-bold uppercase tracking-wide text-black">
        {user.name.split(" ")[0]}
      </span>
      <div className="w-10 h-10 rounded-full border-2 border-black overflow-hidden flex-none">
        <Avatar name={user.name} avatarUrl={user.avatar_url} className="text-sm" />
      </div>
    </div>
  );
}
