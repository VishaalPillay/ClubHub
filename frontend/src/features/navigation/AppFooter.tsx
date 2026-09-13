import Image from "next/image";
import { Wordmark } from "@/components/ui/Wordmark";

/**
 * The one footer for every identity-scoped and club-scoped page (portal,
 * directory, the club shell). Wordmark pinned left, byline pinned right — the
 * same left/right shape portal and directory each used to build by hand
 * before this existed, just with a shared implementation.
 *
 * The credit line used to be three unwired links (Privacy Policy / Terms of
 * Service / Contact Us, all `href="#"`) — dead ends rather than real pages.
 * Swapped for a plain byline image instead of leaving them, or building three
 * pages nobody asked for. It's also a real link now, to the GitHub profile.
 */
export default function AppFooter() {
  return (
    <footer className="bg-ink text-paper py-5 px-8 flex items-center justify-between mt-auto">
      <Wordmark className="w-[150px]" invert />
      <a
        href="https://github.com/VishaalPillay"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Vishaal Pillay on GitHub"
      >
        <Image
          src="/brand/by-vishaal-pillay.webp"
          alt="By Vishaal Pillay"
          width={720}
          height={245}
          className="w-[230px] h-auto select-none"
          draggable={false}
        />
      </a>
    </footer>
  );
}
