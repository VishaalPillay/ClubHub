"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ClubProvider } from "@/features/club/ClubProvider";
import ClubNav from "@/features/club/ClubNav";
import ProfileMenu from "@/features/profile/ProfileMenu";
import { Wordmark } from "@/components/ui/Wordmark";

/**
 * Club-scoped app shell. The active club is the URL segment (/c/[clubId]/...),
 * resolved to a membership by ClubProvider — the localStorage club context is gone.
 */
export default function ClubLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ clubId: string }>();
  const clubId = Number(params.clubId);

  return (
    <ClubProvider clubId={clubId}>
      <div className="bg-paper text-black min-h-screen flex flex-col antialiased selection:bg-black selection:text-paper">
        {/* TopAppBar */}
        <header className="bg-paper text-black w-full border-b-2 border-black flex px-8 py-4 sticky top-0 z-30 justify-between items-center relative">
          <div className="flex items-center gap-4 z-10">
            <Link href="/portal" className="block cursor-pointer no-underline" title="Back to club portal">
              <Wordmark className="w-[210px]" />
            </Link>
          </div>

          {/* Navigation Links (Absolutely Centered) */}
          <ClubNav />

          <div className="flex items-center gap-6 z-10">
            <ProfileMenu />
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen">
          <main className="flex-1 p-8 lg:p-12 max-w-[1600px] mx-auto w-full">{children}</main>

          <footer className="bg-ink text-paper py-12 px-8 flex flex-col items-center mt-auto">
            <div className="mb-8">
              <Wordmark className="w-[180px]" invert />
            </div>
            <div className="flex flex-wrap justify-center gap-8 font-ui text-xs uppercase tracking-widest text-[#ddd8cc]">
              <a className="hover:text-paper transition-150 cursor-pointer no-underline text-[#ddd8cc]" href="#">
                Privacy Policy
              </a>
              <a className="hover:text-paper transition-150 cursor-pointer no-underline text-[#ddd8cc]" href="#">
                Terms of Service
              </a>
              <a className="hover:text-paper transition-150 cursor-pointer no-underline text-[#ddd8cc]" href="#">
                Contact Us
              </a>
            </div>
          </footer>
        </div>
      </div>
    </ClubProvider>
  );
}
