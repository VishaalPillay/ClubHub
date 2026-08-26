import Image from "next/image";
import { Wordmark } from "@/components/ui/Wordmark";

/**
 * The one footer for every identity-scoped and club-scoped page (portal,
 * directory, the club shell). Before this, three pages each built their own:
 * portal and directory used a left-wordmark/right-copyright row, and only the
 * club shell centred the wordmark with a credit line underneath — that
 * centred shape is the one kept here, everywhere.
 *
 * The credit line used to be three unwired links (Privacy Policy / Terms of
 * Service / Contact Us, all `href="#"`) — dead ends rather than real pages.
 * Swapped for a plain byline image instead of leaving them, or building three
 * pages nobody asked for.
 */
export default function AppFooter() {
  return (
    <footer className="bg-ink text-paper py-5 px-8 flex flex-col items-center mt-auto">
      <div className="mb-3">
        <Wordmark className="w-[150px]" invert />
      </div>
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
