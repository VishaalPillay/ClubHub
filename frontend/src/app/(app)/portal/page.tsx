"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { directory, myClubs, pendingRequests, withdrawJoin } from "@/lib/api/clubs";
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState<number | null>(null);
  const [search, setSearch] = useState("");

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
  // Directory is fetched lazily, only once the user actually types a search.
  const { data: allClubs = [], isPending: searchLoading } = useQuery({
    queryKey: ["directory"],
    queryFn: directory,
    enabled: search.trim().length > 0,
    staleTime: 60_000,
  });

  const q = search.trim().toLowerCase();
  const results =
    q.length === 0
      ? []
      : allClubs
          .filter((c) =>
            [c.name, c.description ?? "", c.institution ?? ""].some((t) =>
              t.toLowerCase().includes(q)
            )
          )
          .slice(0, 9);

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
            className="font-ui text-[12px] font-bold uppercase tracking-widest hover:text-[#057DBC] transition-colors"
          >
            Club Directory
          </button>
          <span className="font-mono text-[12px] uppercase tracking-widest text-[#757575]">
            {user.name}
          </span>
          <button
            onClick={signOut}
            className="font-ui text-[12px] font-bold border-2 border-black px-4 py-2 uppercase hover:bg-black hover:text-white transition-colors"
          >
            Sign Out
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
            Welcome back,<br />{user.name.split(" ")[0]}.
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
                      <h2 className="font-display text-[48px] leading-[0.93] tracking-[-0.5px] font-bold text-black uppercase mb-3 group-hover:text-[#057DBC] transition-colors break-words">
                        {club.name}
                      </h2>

                      {/* Description */}
                      {club.description && (
                        <p className="font-ui text-[14px] text-[#757575] mb-6 leading-relaxed">
                          {club.description}
                        </p>
                      )}

                      <div className="mt-auto pt-4 border-t border-[#e2e8f0] flex justify-between items-center">
                        {/* Club Code */}
                        <span className="font-mono text-[11px] uppercase tracking-widest text-[#757575]">
                          {club.code}
                        </span>
                        <span className="font-ui text-[12px] font-bold text-[#057DBC] flex items-center gap-1 group-hover:underline">
                          Enter
                          <span className="material-symbols-outlined text-[16px]">
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

        {/* Search the directory */}
        <section className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-black h-[32px] flex items-center px-4">
              <span className="font-mono text-[11px] text-white uppercase tracking-[1.2px]">
                Search Clubs
              </span>
            </div>
            <span className="font-mono text-[11px] text-[#757575] uppercase tracking-wider hidden sm:inline">
              Every public club, every institution
            </span>
          </div>

          <div className="relative max-w-2xl">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-[#757575]">
              search
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by club name, institution, or keyword…"
              aria-label="Search the club directory"
              className="w-full border-2 border-black bg-white text-black pl-12 pr-4 py-3.5 font-ui text-[15px] rounded-none focus:outline-none focus:border-[#057DBC]"
            />
          </div>

          {q.length > 0 && (
            <div className="mt-6">
              {searchLoading ? (
                <p className="font-mono text-[11px] uppercase tracking-widest text-[#757575] animate-pulse">
                  Searching the directory…
                </p>
              ) : results.length === 0 ? (
                <div className="border-2 border-dashed border-[#e2e8f0] p-8 text-center">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-[#757575] mb-2">
                    No clubs match “{search.trim()}”
                  </p>
                  <p className="font-ui text-[13px] text-[#4c4546]">
                    Have an invite code instead?{" "}
                    <button
                      onClick={() => router.push("/onboarding/join-flow")}
                      className="text-[#057DBC] underline"
                    >
                      Join with a code
                    </button>
                    {" "}— or be the first:{" "}
                    <button
                      onClick={() => router.push("/onboarding/step-1")}
                      className="text-[#057DBC] underline"
                    >
                      create this club
                    </button>
                    .
                  </p>
                </div>
              ) : (
                <div className="border-2 border-black divide-y divide-[#e2e8f0]">
                  {results.map((c) => (
                    <div key={c.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display text-[20px] font-bold leading-tight truncate">
                          {c.name}
                        </h3>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-[#757575] mt-0.5 truncate">
                          {c.institution ?? "Independent"}
                          {c.description ? ` — ${c.description}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => router.push("/onboarding/join-flow")}
                        className="font-ui text-[11px] font-bold border-2 border-black px-4 py-1.5 uppercase hover:bg-black hover:text-white transition-colors whitespace-nowrap"
                      >
                        Join with code
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                          className="font-mono text-[10px] uppercase text-[#757575] hover:text-red-600 underline transition-colors"
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

      {/* Withdraw Confirmation Backdrop */}
      <AnimatePresence>
        {confirmWithdraw && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setConfirmWithdraw(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
