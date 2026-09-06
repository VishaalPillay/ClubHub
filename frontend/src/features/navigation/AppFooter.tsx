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
 * pages nobody asked for.
 */
export default function AppFooter() {
  return (
    <footer className="bg-ink text-paper py-5 px-8 flex items-center justify-between mt-auto">
      <Wordmark className="w-[150px]" invert />
      <Image
        src="/brand/by-vishaal-pillay.webp"
        alt="By Vishaal Pillay"
        width={720}
        height={245}
        className="w-[230px] h-auto select-none"
        draggable={false}
      />
    </footer>
  );
}
