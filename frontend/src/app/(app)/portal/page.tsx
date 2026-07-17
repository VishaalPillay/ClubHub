"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { myClubs, pendingRequests, withdrawJoin } from "@/lib/api/clubs";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ROLE_LABELS } from "@/lib/roles";
import type { MyClub } from "@/types/api";

const ROLE_COLORS: Record<string, string> = {
  president: "bg-black text-white",
  vice_president: "bg-black text-white",
  secretary: "bg-[#1a1a1a] text-white",
  joint_secretary: "bg-[#1a1a1a] text-white",
  lead: "bg-[#057DBC] text-white",
  associate: "bg-[#057DBC] text-white",
  member: "bg-[#757575] text-white",
};

export default function PortalPage() {
  return (
    <Suspense fallback={null}>
      <PortalContent />
    </Suspense>
  );
}

function PortalContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState<number | null>(null);
  // Snapshot on first render only — the URL gets cleaned up right after, but the
  // greeting for this visit should stay "You're in" rather than flip mid-view.
  const [isFreshArrival] = useState(() => searchParams.get("welcome") === "1");

  useEffect(() => {
    if (searchParams.get("welcome") === "1") {
      router.replace("/portal", { scroll: false });
    }
  }, [searchParams, router]);

  const { data: clubs = [], isPending: clubsLoading } = useQuery({
    queryKey: ["my-clubs"],
    queryFn: myClubs,
    refetchInterval: 10_000, // membership appears once a join request is approved
  });
  const { data: pending = [] } = useQuery({
    queryKey: ["pending-requests"],
    queryFn: pendingRequests,
    refetchInterval: 10_000,
  });

  const enterClub = (club: MyClub) => router.push(`/c/${club.id}/dashboard`);

  const withdraw = async (requestId: number) => {
    setWithdrawingId(requestId);
    try {
      await withdrawJoin(requestId);
      queryClient.invalidateQueries({ queryKey: ["pending-requests"] });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to withdraw.");
    } finally {
      setWithdrawingId(null);
      setConfirmWithdraw(null);
    }
  };

  if (clubsLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="font-mono text-12 uppercase tracking-widest text-[#757575] animate-pulse">
          Loading your clubs...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white text-black min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center w-full px-8 py-4 bg-white border-b-2 border-black sticky top-0 z-30">
        <div className="font-display text-[32px] font-black uppercase tracking-tighter">
          CLUB-HUB
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={() => router.push("/directory")}
            className="group flex items-center font-ui text-[12px] font-bold uppercase tracking-widest hover:text-[#057DBC] transition-colors"
          >
            Club Directory
            <span className="material-symbols-outlined text-[16px] max-w-0 -translate-x-1 opacity-0 overflow-hidden transition-all duration-300 ease-out group-hover:max-w-[24px] group-hover:translate-x-0 group-hover:opacity-100 group-hover:ml-1">
              arrow_forward
            </span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-8 py-12">
        {/* Page Title */}
        <div className="border-b-2 border-black pb-6 mb-12">
          <p className="font-mono text-[12px] uppercase tracking-widest text-[#757575] mb-3">
            Club Portal
          </p>
          <h1 className="font-display text-[64px] leading-[0.93] tracking-[-0.5px] font-bold">
            {isFreshArrival ? "You're in, " : "Welcome back, "}
            {user.name.split(" ")[0]}.
          </h1>
        </div>

        {/* Active Clubs */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-black h-[32px] flex items-center px-4">
                <span className="font-mono text-[11px] text-white uppercase tracking-[1.2px]">
                  Your Clubs
                </span>
              </div>
              <span className="font-mono text-[11px] text-[#757575] uppercase tracking-wider">
                {clubs.length} Active
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push("/onboarding/join-flow")}
                className="font-ui text-[12px] font-bold border-2 border-[#057DBC] text-[#057DBC] px-5 py-2 uppercase hover:bg-[#057DBC] hover:text-white transition-colors"
              >
                Join a Club
              </button>
              <button
                onClick={() => router.push("/onboarding/step-1")}
                className="font-ui text-[12px] font-bold border-2 border-black bg-black text-white px-5 py-2 uppercase hover:bg-white hover:text-black transition-colors"
              >
                Create New Club
              </button>
            </div>
          </div>

          {clubs.length === 0 ? (
            <div className="border-2 border-dashed border-[#e2e8f0] p-16 flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-[48px] text-[#757575] mb-4">
                group
              </span>
              <p className="font-mono text-[12px] uppercase tracking-widest text-[#757575] mb-4">
                No Active Clubs
              </p>
              <p className="font-ui text-[14px] text-[#4c4546]">
                Create a new club or join an existing one using a club code.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {clubs.map((club) => (
                  <motion.div
                    key={club.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-2 border-black bg-white group cursor-pointer hover:bg-[#f3f3f3] transition-colors flex flex-col"
                    onClick={() => enterClub(club)}
                  >
                    {/* Top accent */}
                    <div className="h-1 bg-black w-full" />

                    <div className="p-8 flex flex-col flex-1">
                      {/* Role pill */}
                      <div className="mb-6">
                        <span className={`inline-block font-mono text-[10px] uppercase tracking-widest px-3 py-1 ${ROLE_COLORS[club.role] ?? "bg-[#757575] text-white"}`}>
                          {ROLE_LABELS[club.role] ?? club.role}
                        </span>
                      </div>

                      {/* Club Name */}
                      <h2 className="font-display text-[48px] leading-[0.93] tracking-[-0.5px] font-bold text-black uppercase mb-3 break-words">
                        {club.name}
                      </h2>

                      {/* Institution / college */}
                      {club.institution && (
                        <p className="font-ui text-[14px] text-[#757575] mb-6 leading-relaxed">
                          {club.institution}
                        </p>
                      )}

                      <div className="mt-auto pt-4 border-t border-[#e2e8f0] flex justify-between items-center">
                        {/* Club Code */}
                        <span className="font-mono text-[11px] uppercase tracking-widest text-[#757575]">
                          {club.code}
                        </span>
                        <span className="font-ui text-[12px] font-bold text-[#057DBC] flex items-center gap-1">
                          Enter
                          <span className="material-symbols-outlined text-[16px] transition-transform duration-200 group-hover:scale-125">
                            arrow_forward
                          </span>
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Pending Requests */}
        {pending.length > 0 && (
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-[#757575] h-[32px] flex items-center px-4">
                <span className="font-mono text-[11px] text-white uppercase tracking-[1.2px]">
                  Join Requests
                </span>
              </div>
              <span className="font-mono text-[11px] text-[#757575] uppercase tracking-wider">
                Auto-refreshes every 10s
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {pending.filter(req => req.status !== 'approved').map((req) => (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="border-2 border-[#e2e8f0] bg-[#f9f9f9] p-6 flex flex-col gap-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-[#757575] mb-1">
                          {req.status === 'pending' ? 'Awaiting Approval' : 'Rejected'}
                        </p>
                        <h3 className="font-display text-[26px] leading-[1.08] font-bold text-black break-words">
                          {req.club_name}
                        </h3>
                      </div>
                      <div className={`w-3 h-3 rounded-full mt-1 ${req.status === 'pending' ? 'bg-[#f59e0b] animate-pulse' : 'bg-red-600'}`} title={req.status} />
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="inline-block font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 bg-[#757575] text-white">
                        {ROLE_LABELS[req.requested_role] ?? req.requested_role}
                      </span>
                      <span className="font-mono text-[10px] text-[#757575] uppercase">
                        {req.code}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-[#e2e8f0] flex items-center justify-between">
                      <span className="font-mono text-[10px] text-[#757575] uppercase">
                        {new Date(req.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric"
                        })}
                      </span>
                      {req.status === 'rejected' ? (
                        <button
                          onClick={() => withdraw(req.id)}
                          className="font-mono text-[10px] uppercase text-[#757575] hover:text-black underline transition-colors"
                        >
                          Dismiss
                        </button>
                      ) : confirmWithdraw === req.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmWithdraw(null)}
                            className="font-mono text-[10px] uppercase px-3 py-1 border border-black hover:bg-black hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => withdraw(req.id)}
                            disabled={withdrawingId === req.id}
                            className="font-mono text-[10px] uppercase px-3 py-1 border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50"
                          >
                            {withdrawingId === req.id ? "..." : "Confirm"}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmWithdraw(req.id)}
                          className="font-mono text-[10px] uppercase px-3 py-1 border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                    {req.status === 'rejected' && (
                      <p className="font-ui text-sm text-red-600 border-l-2 border-red-600 pl-2">
                        Your request was rejected. Try again later or contact the club leadership.
                      </p>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#1a1a1a] text-white py-10 px-8 flex justify-between items-center mt-auto">
        <div className="font-display text-[20px] font-black uppercase tracking-tighter text-white">
          CLUB-HUB
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#757575]">
          © 2026 CLUB-HUB EDITORIAL. ALL RIGHTS RESERVED.
        </div>
      </footer>
    </div>
  );
}
