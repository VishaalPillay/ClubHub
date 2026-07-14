"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { directory, joinClub, myClubs, pendingRequests } from "@/lib/api/clubs";
import { JOINABLE_ROLES } from "@/lib/roles";
import type { DirectoryClub } from "@/types/api";

/** Roles this club is actually requestable for right now — domain-scoped roles
 *  need at least one domain to exist, mirroring the backend's DOMAIN_REQUIRED rule. */
function requestableRoles(club: DirectoryClub) {
  const enabled = club.enabled_roles ?? [];
  return JOINABLE_ROLES.filter(
    (r) => enabled.includes(r.value) && (!r.needsDomain || club.domains.length > 0)
  );
}

/** Public club directory — every club with is_public=true. Click a card to request
 * to join directly (no invite code needed); an invite code is still the fallback
 * for clubs that aren't accepting open requests. */
export default function DirectoryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: clubs = [], isPending } = useQuery({
    queryKey: ["directory"],
    queryFn: directory,
  });
  const { data: myClubList = [] } = useQuery({ queryKey: ["my-clubs"], queryFn: myClubs });
  const { data: pending = [] } = useQuery({
    queryKey: ["pending-requests"],
    queryFn: pendingRequests,
  });

  const myClubIds = useMemo(() => new Set(myClubList.map((c) => c.id)), [myClubList]);
  const pendingClubIds = useMemo(
    () => new Set(pending.filter((r) => r.status === "pending").map((r) => r.club_id)),
    [pending]
  );

  const filtered = clubs.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.description ?? "").toLowerCase().includes(q) ||
      (c.institution ?? "").toLowerCase().includes(q)
    );
  });

  // ── Request-to-join modal ─────────────────────────────────────────────────
  const [joinTarget, setJoinTarget] = useState<DirectoryClub | null>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [justRequested, setJustRequested] = useState(false);

  const availableRoles = useMemo(
    () => (joinTarget ? requestableRoles(joinTarget) : []),
    [joinTarget]
  );
  const roleConfig = availableRoles.find((r) => r.value === selectedRole);

  const openJoinModal = (club: DirectoryClub) => {
    const roles = requestableRoles(club);
    const preferred = roles.find((r) => r.value === "member") ?? roles[0];
    setJoinTarget(club);
    setSelectedRole(preferred?.value ?? "");
    setSelectedDomainId(null);
    setMessage("");
    setSubmitError("");
    setJustRequested(false);
  };

  const closeModal = () => setJoinTarget(null);

  const submitRequest = async () => {
    if (!joinTarget || !selectedRole) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await joinClub({
        club_id: joinTarget.id,
        requested_role: selectedRole,
        requested_domain_id: selectedDomainId,
        message: message || null,
      });
      setJustRequested(true);
      queryClient.invalidateQueries({ queryKey: ["pending-requests"] });
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Failed to send request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white text-black min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center w-full px-8 py-4 bg-white border-b-2 border-black sticky top-0 z-30">
        <button
          onClick={() => router.push("/portal")}
          className="font-display text-[32px] font-black uppercase tracking-tighter hover:text-link-blue transition-colors"
        >
          CLUB-HUB
        </button>
        <div className="flex items-center gap-6">
          <button
            onClick={() => router.push("/portal")}
            className="font-ui text-[12px] font-bold uppercase tracking-widest hover:text-[#057DBC] transition-colors"
          >
            My Portal
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-8 py-12">
        <div className="border-b-2 border-black pb-6 mb-8">
          <p className="font-mono text-[12px] uppercase tracking-widest text-[#757575] mb-3">
            Public Directory
          </p>
          <h1 className="font-display text-[64px] leading-[0.93] tracking-[-0.5px] font-bold">
            Discover clubs.
          </h1>
          <p className="font-body text-lg text-[#4c4546] mt-3 max-w-2xl">
            Browse every public club on the network. Click one to send a request to join —
            no invite code required.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-10 items-stretch md:items-center justify-between">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, description, or institution..."
            className="border-2 border-black bg-white text-black p-3 font-ui text-[15px] w-full md:max-w-md focus:outline-none focus:border-[#057DBC]"
          />
          <button
            onClick={() => router.push("/onboarding/join-flow")}
            className="font-ui text-[12px] font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-6 py-3 uppercase hover:bg-white hover:text-[#057DBC] transition-colors shrink-0"
          >
            Have a code? Join a club
          </button>
        </div>

        {isPending ? (
          <div className="font-mono text-12 uppercase tracking-widest text-[#757575] animate-pulse">
            Loading directory...
          </div>
        ) : filtered.length === 0 ? (
          <div className="border-2 border-dashed border-[#e2e8f0] p-16 flex flex-col items-center justify-center text-center">
            <span className="material-symbols-outlined text-[48px] text-[#757575] mb-4">
              search_off
            </span>
            <p className="font-mono text-[12px] uppercase tracking-widest text-[#757575]">
              No clubs match your search.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((club, idx) => {
              const isMember = myClubIds.has(club.id);
              const isRequested = pendingClubIds.has(club.id);
              const joinable = !isMember && !isRequested && requestableRoles(club).length > 0;

              return (
                <motion.div
                  key={club.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.4) }}
                  onClick={() => joinable && openJoinModal(club)}
                  className={`border-2 border-black bg-white flex flex-col group transition-colors ${
                    joinable ? "cursor-pointer hover:bg-[#f3f3f3]" : ""
                  }`}
                >
                  <div className="h-1 bg-black w-full" />
                  <div className="p-8 flex flex-col flex-1">
                    <h2 className="font-display text-[40px] leading-[0.95] tracking-[-0.5px] font-bold text-black uppercase mb-3 break-words group-hover:text-[#057DBC] transition-colors">
                      {club.name}
                    </h2>
                    {club.institution && (
                      <p className="font-ui text-[14px] text-[#757575] leading-relaxed">
                        {club.institution}
                      </p>
                    )}
                    <div className="mt-auto pt-4 border-t border-[#e2e8f0] flex items-center justify-between">
                      {isMember ? (
                        <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 bg-black text-white">
                          You&apos;re a member
                        </span>
                      ) : isRequested ? (
                        <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 bg-[#757575] text-white">
                          Requested
                        </span>
                      ) : joinable ? (
                        <span className="font-ui text-[12px] font-bold text-[#057DBC] flex items-center gap-1 group-hover:underline">
                          Request to join
                          <span className="material-symbols-outlined text-[16px]">
                            arrow_forward
                          </span>
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-widest text-[#757575]">
                          Invite-only · ask leadership for the code
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="bg-[#1a1a1a] text-white py-10 px-8 flex justify-between items-center mt-auto">
        <div className="font-display text-[20px] font-black uppercase tracking-tighter text-white">
          CLUB-HUB
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#757575]">
          © 2026 CLUB-HUB EDITORIAL. ALL RIGHTS RESERVED.
        </div>
      </footer>

      {/* Request-to-join modal */}
      <AnimatePresence>
        {joinTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-6"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="bg-white border-2 border-black w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {justRequested ? (
                <div className="p-10 text-center">
                  <div className="w-14 h-14 bg-black flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-white text-[28px]">check</span>
                  </div>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-[#757575] mb-3">
                    Request Sent
                  </p>
                  <h3 className="font-display text-[32px] leading-[1.05] font-bold mb-4">
                    You&apos;re in the queue.
                  </h3>
                  <p className="font-ui text-[14px] text-[#757575] mb-8 leading-relaxed">
                    Your request to join <strong>{joinTarget.name}</strong>{" "}
                    has been sent. The club&apos;s leadership will review it shortly.
                  </p>
                  <button
                    onClick={closeModal}
                    className="font-ui text-[13px] font-bold border-2 border-black bg-black text-white px-8 py-3 uppercase hover:bg-white hover:text-black transition-colors w-full"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="p-8">
                  <div className="flex items-start justify-between mb-6 border-b-2 border-black pb-4">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-widest text-[#757575] mb-1">
                        Request to Join
                      </p>
                      <h3 className="font-display text-[32px] leading-[1.05] font-bold">
                        {joinTarget.name}
                      </h3>
                      {joinTarget.institution && (
                        <p className="font-ui text-[13px] text-[#757575] mt-1">
                          {joinTarget.institution}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={closeModal}
                      className="text-[#757575] hover:text-black transition-colors"
                      aria-label="Close"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  {availableRoles.length === 0 ? (
                    <div className="border-2 border-dashed border-[#e2e8f0] p-6 text-center">
                      <p className="font-mono text-[11px] uppercase tracking-widest text-[#757575] mb-2">
                        Not accepting open requests right now
                      </p>
                      <p className="font-ui text-[13px] text-[#4c4546]">
                        Ask its leadership for an invite code instead.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-6">
                        <label className="font-mono text-[11px] uppercase tracking-widest text-[#757575] block mb-3">
                          I&apos;d like to join as
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {availableRoles.map((role) => (
                            <button
                              key={role.value}
                              onClick={() => {
                                setSelectedRole(role.value);
                                setSelectedDomainId(null);
                              }}
                              className={`font-mono text-[11px] uppercase tracking-widest px-4 py-2 border-2 transition-colors ${
                                selectedRole === role.value
                                  ? "border-[#057DBC] bg-[#057DBC] text-white"
                                  : "border-black hover:bg-[#f3f3f3]"
                              }`}
                            >
                              {role.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {roleConfig?.needsDomain && (
                        <div className="mb-6">
                          <label className="font-mono text-[11px] uppercase tracking-widest text-[#757575] block mb-2">
                            Domain
                          </label>
                          <select
                            value={selectedDomainId ?? ""}
                            onChange={(e) =>
                              setSelectedDomainId(e.target.value ? Number(e.target.value) : null)
                            }
                            className="border-2 border-black p-3 font-mono text-[13px] uppercase tracking-wider outline-none focus:border-[#057DBC] w-full bg-white"
                          >
                            <option value="">-- Select a domain --</option>
                            {joinTarget.domains.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="mb-6">
                        <label className="font-mono text-[11px] uppercase tracking-widest text-[#757575] block mb-2">
                          Message <span className="normal-case">(optional)</span>
                        </label>
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Introduce yourself or explain why you'd like to join..."
                          rows={3}
                          className="border-2 border-black p-3 font-ui text-[14px] w-full outline-none focus:border-[#057DBC] resize-none placeholder:text-[#ccc]"
                        />
                      </div>

                      {submitError && (
                        <p className="font-mono text-[11px] text-red-600 uppercase tracking-widest mb-4">
                          {submitError}
                        </p>
                      )}

                      <div className="flex justify-end gap-3 pt-4 border-t border-[#e2e8f0]">
                        <button
                          onClick={closeModal}
                          className="font-ui text-[13px] font-bold border-2 border-black px-6 py-3 uppercase hover:bg-black hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={submitRequest}
                          disabled={submitting || !selectedRole || (roleConfig?.needsDomain && !selectedDomainId)}
                          className="font-ui text-[13px] font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-6 py-3 uppercase hover:bg-black hover:border-black transition-colors disabled:opacity-40 flex items-center gap-2"
                        >
                          {submitting ? "Sending..." : "Send Request"}
                          <span className="material-symbols-outlined text-[16px]">send</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
