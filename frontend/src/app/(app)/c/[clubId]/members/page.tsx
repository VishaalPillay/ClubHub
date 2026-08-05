"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GithubLogo, InstagramLogo, LinkedinLogo } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Toast, { type ToastTone } from "@/components/ui/Toast";
import { useClub } from "@/features/club/ClubProvider";
import WingedLetter from "@/features/members/WingedLetter";
import { listDomains, createDomain, updateDomain, deleteDomain } from "@/lib/api/domains";
import { listMembers, updateMemberRole, removeMember } from "@/lib/api/members";
import { createActionRequest } from "@/lib/api/requests";
import { humanizeRole, isSecPlus } from "@/lib/roles";

type MemberRow = {
  user_id: number;
  name: string;
  role: string;
  domain_id: number | null;
  points: number;
  pic: string;
  github_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  rank?: number;
};

/** LinkedIn/GitHub/Instagram — links to the member's actual profile when set, else a
 * dimmed non-interactive placeholder so the socials column never shifts row-to-row. */
function SocialIcons({ member }: { member: MemberRow }) {
  const links: Array<{ url: string | null; Icon: typeof LinkedinLogo; label: string }> = [
    { url: member.linkedin_url, Icon: LinkedinLogo, label: "LinkedIn" },
    { url: member.github_url, Icon: GithubLogo, label: "GitHub" },
    { url: member.instagram_url, Icon: InstagramLogo, label: "Instagram" },
  ];
  return (
    <div className="col-span-2 flex justify-center gap-3 text-black">
      {links.map(({ url, Icon, label }) =>
        url ? (
          <a
            key={label}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#057DBC] transition-colors"
            aria-label={label}
          >
            <Icon size={20} weight="fill" />
          </a>
        ) : (
          <span key={label} className="text-caption-gray cursor-not-allowed" aria-label={`${label} not provided`}>
            <Icon size={20} weight="fill" />
          </span>
        )
      )}
    </div>
  );
}

type DomainCard = {
  id: number;
  name: string;
  desc: string;
  membersCount: number;
  members: MemberRow[];
};

const ITEMS_PER_PAGE = 10;

export default function MembersPage() {
  const { clubId, currentRole, domainId } = useClub();
  const queryClient = useQueryClient();

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [actionModal, setActionModal] = useState<{ type: 'Promote' | 'Kick', memberId: number, memberName: string, memberDomainId: number } | null>(null);
  const [actionReason, setActionReason] = useState("");

  // Send-off animation state machine, replacing the old blocking alert():
  //   form → (confirm succeeds) folding → flying → toast
  // `folding` collapses the modal into a letter; `flight` then owns the winged fly-away
  // and carries the message to show once it lands.
  const [submitting, setSubmitting] = useState(false);
  const [folding, setFolding] = useState(false);
  const [flight, setFlight] = useState<
    { tone: "angel" | "devil"; message: string } | null
  >(null);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  const dismissToast = useCallback(() => setToast(null), []);

  const [isNewDomainModalOpen, setIsNewDomainModalOpen] = useState(false);
  const [newDomainData, setNewDomainData] = useState({ name: "", desc: "" });

  const [deleteDomainModalId, setDeleteDomainModalId] = useState<number | null>(null);
  const [updateDomainData, setUpdateDomainData] = useState<{ id: number, name: string, desc: string } | null>(null);

  const isExecutive = isSecPlus(currentRole);

  const { data: domainsData = [] } = useQuery({
    queryKey: ["club", clubId, "domains"],
    queryFn: () => listDomains(clubId),
  });
  const { data: membersData = [] } = useQuery({
    queryKey: ["club", clubId, "members"],
    queryFn: () => listMembers(clubId),
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["club", clubId, "domains"] });
    queryClient.invalidateQueries({ queryKey: ["club", clubId, "members"] });
    queryClient.invalidateQueries({ queryKey: ["my-clubs"] });
  };

  const members: MemberRow[] = membersData.map((m) => ({
    user_id: m.user_id,
    name: m.name,
    role: humanizeRole(m.role),
    domain_id: m.domain_id,
    points: m.points || 0,
    pic: `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=e2e2e2&color=000&size=150`,
    github_url: m.github_url,
    linkedin_url: m.linkedin_url,
    instagram_url: m.instagram_url,
  }));

  const domains: DomainCard[] = domainsData.map((d) => ({
    id: d.id,
    name: d.name,
    desc: d.description ?? "",
    membersCount: members.filter((m) => m.domain_id === d.id).length,
    members: members.filter((m) => m.domain_id === d.id),
  }));

  const toggleExpand = (id: number) => {
    if (!isExecutive) return;
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      setCurrentPage(1);
    }
  };

  const [actionNewRole, setActionNewRole] = useState("associate");

  /** Clear the action modal + its form back to a neutral state. */
  const resetActionForm = () => {
    setActionModal(null);
    setActionReason("");
    setActionNewRole("associate");
    setFolding(false);
    setSubmitting(false);
  };

  const handleActionSubmit = async () => {
    if (!actionModal || submitting) return;
    const isPromote = actionModal.type === "Promote";
    const { memberName } = actionModal;
    setSubmitting(true);

    try {
      let message: string;
      if (isExecutive) {
        if (isPromote) {
          await updateMemberRole(clubId, actionModal.memberId, actionNewRole, actionModal.memberDomainId ?? domainId);
          message = `${memberName} is now ${humanizeRole(actionNewRole)}.`;
        } else {
          await removeMember(clubId, actionModal.memberId);
          message = `${memberName} has been removed from the club.`;
        }
      } else {
        // Lead or Associate raising an action request for officials to approve.
        await createActionRequest(clubId, {
          target_id: actionModal.memberId,
          action_type: actionModal.type.toLowerCase() as 'promote' | 'kick',
          new_role: isPromote ? actionNewRole : null,
          reason: actionReason,
        });
        message = `Request to ${isPromote ? "promote" : "remove"} ${memberName} sent — officials will review it.`;
      }
      // Refresh behind the overlay so the roster is already correct when it clears.
      refetch();
      setFlight({ tone: isPromote ? "angel" : "devil", message });
      setFolding(true); // the modal now collapses; onAnimationComplete launches the letter
    } catch (e: unknown) {
      setToast({ text: e instanceof Error ? e.message : "Action failed.", tone: "error" });
      resetActionForm();
    }
  };

  /** Fold finished — drop the modal so only the winged letter remains. */
  const handleFoldComplete = () => {
    if (!folding) return; // guard: also fires for the modal's entrance animation
    setActionModal(null);
    setActionReason("");
    setActionNewRole("associate");
    setSubmitting(false);
  };

  /** The letter has flown off — surface the outcome. */
  const handleFlightDone = () => {
    if (flight) {
      setToast({ text: flight.message, tone: flight.tone === "angel" ? "success" : "error" });
    }
    setFlight(null);
    setFolding(false);
  };

  const handleCreateDomain = async () => {
    try {
      await createDomain(clubId, newDomainData.name, newDomainData.desc);
      setIsNewDomainModalOpen(false);
      setNewDomainData({ name: "", desc: "" });
      refetch();
      setToast({ text: `Domain "${newDomainData.name}" created.`, tone: "success" });
    } catch (e: unknown) {
      setToast({
        text: e instanceof Error ? e.message : "Failed to create domain.",
        tone: "error",
      });
    }
  };

  const confirmDeleteDomain = async () => {
    if (deleteDomainModalId) {
      try {
        await deleteDomain(clubId, deleteDomainModalId);
        setDeleteDomainModalId(null);
        refetch();
        setToast({ text: "Domain deleted.", tone: "info" });
      } catch (e: unknown) {
        setToast({
          text: e instanceof Error ? e.message : "Failed to delete domain.",
          tone: "error",
        });
      }
    }
  };

  const confirmUpdateDomain = async () => {
    if (updateDomainData) {
      try {
        await updateDomain(clubId, updateDomainData.id, {
          name: updateDomainData.name,
          description: updateDomainData.desc,
        });
        setUpdateDomainData(null);
        refetch();
        setToast({ text: "Domain updated.", tone: "success" });
      } catch (e: unknown) {
        setToast({
          text: e instanceof Error ? e.message : "Failed to update domain.",
          tone: "error",
        });
      }
    }
  };

  const visibleDomains = isExecutive ? domains : domains.filter(d => d.id === domainId);

  const orderedDomains = [...visibleDomains].sort((a, b) => {
    if (a.id === expandedId) return -1;
    if (b.id === expandedId) return 1;
    return 0;
  });

  return (
    <div className="w-full flex flex-col gap-8 relative">
      <div className="flex justify-between items-end mb-6 w-full gap-4">
        <div className="flex flex-col flex-1">
          <div className="w-full h-[2px] bg-black"></div>
          <h1 className="bg-black text-white px-3 py-1 font-mono text-12 uppercase tracking-widest w-max inline-block">
            {isExecutive ? "Domain Directory" : "Your Domain"}
          </h1>
        </div>
        {isExecutive && (
          <button
            onClick={() => setIsNewDomainModalOpen(true)}
            className="bg-[#057DBC] text-white font-ui text-12 font-bold px-4 py-1.5 border-2 border-[#057DBC] hover:bg-white hover:text-[#057DBC] transition-colors uppercase shrink-0"
          >
            New Domain
          </button>
        )}
      </div>

      <div className={isExecutive ? "grid grid-cols-1 md:grid-cols-2 gap-6 items-start" : "flex flex-col gap-6"}>
        {orderedDomains.map((domain) => {
          const isExpanded = isExecutive ? expandedId === domain.id : true;

          const sortedMembers = [...domain.members].sort((a, b) => b.points - a.points);

          const leads = sortedMembers.filter(m => ['Lead', 'Associate'].includes(m.role));
          const membersList = sortedMembers.filter(m => m.role === 'Member');

          const rankedMembers = membersList.map((m, idx) => ({ ...m, rank: idx + 1 }));

          const totalPages = Math.ceil(rankedMembers.length / ITEMS_PER_PAGE);
          const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
          const currentMembers = rankedMembers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

          return (
            <motion.article
              layout
              key={domain.id}
              onClick={() => !isExpanded && toggleExpand(domain.id)}
              className={`flex flex-col border-2 border-black rounded-none group/domain transition-colors duration-75 bg-white relative ${isExpanded ? 'md:col-span-2 shadow-none cursor-default' : 'col-span-1 hover:border-[3px] cursor-pointer'}`}
            >
              {isExecutive && !isExpanded && (
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/domain:opacity-100 transition-opacity z-10 bg-white/90 rounded px-1">
                  <button className="text-black hover:text-[#057DBC]" title="Update" onClick={e => { e.stopPropagation(); setUpdateDomainData({ id: domain.id, name: domain.name, desc: domain.desc }); }}>
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteDomainModalId(domain.id); }} className="text-black hover:text-red-600" title="Delete">
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                </div>
              )}

              <div
                className={`p-6 flex flex-col flex-1 border-b-2 border-black ${isExpanded && isExecutive ? 'cursor-pointer' : ''}`}
                onClick={(e) => {
                  if (isExpanded && isExecutive) {
                    e.stopPropagation();
                    toggleExpand(domain.id);
                  }
                }}
              >
                <motion.h2 layout className="font-display text-[64px] leading-[0.93] tracking-[-0.5px] font-bold text-black uppercase mb-6 group-hover/domain:text-[#057DBC] transition-colors break-words">
                  {domain.name} Domain
                </motion.h2>
                {isExecutive && (
                  <motion.p layout className="font-display text-[26px] leading-[1.08] text-[#757575] mb-8">
                    {domain.desc}
                  </motion.p>
                )}
                {isExecutive && (
                  <div className="mt-auto pt-4 border-t border-[#E2E8F0] flex justify-between items-center">
                    <div className="bg-[#057DBC] text-white font-mono text-[12px] tracking-[1.1px] px-2 py-1 uppercase">
                      TOTAL MEMBERS: {domain.membersCount}
                    </div>
                    <span
                      className={`material-symbols-outlined text-[#057DBC] transition-transform duration-300 ${isExpanded ? 'rotate-90 opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      style={{ fontVariationSettings: "'FILL' 0" }}
                    >
                      arrow_forward
                    </span>
                  </div>
                )}
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={isExecutive ? { opacity: 0, height: 0 } : false}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={isExecutive ? { opacity: 0, height: 0 } : undefined}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden bg-white"
                  >
                    <div className="w-full border-t-2 border-black" onClick={(e) => e.stopPropagation()}>

                      {/* LEADS SECTION */}
                      {leads.length > 0 && (
                        <div className="w-full">
                          <div className="bg-black text-white font-mono text-12 uppercase tracking-widest px-3 py-2 flex items-center">
                            Leads
                          </div>
                          <div className="grid grid-cols-12 bg-[#e2e2e2] text-black font-mono text-xs uppercase tracking-widest p-3 border-b-2 border-black">
                            <div className="col-span-7">Name</div>
                            <div className="col-span-2 text-center">Socials</div>
                            <div className="col-span-3 text-right">Actions</div>
                          </div>
                          <div className="flex flex-col border-b-2 border-black">
                            {leads.map((member, index) => (
                              <div key={member.user_id} className={`grid grid-cols-12 items-center p-3 border-b-2 ${index === leads.length - 1 ? 'border-b-0' : 'border-b-black'} hover:bg-hairline-tint transition-colors`}>
                                <div className="col-span-7 flex items-center gap-3">
                                  <div className="w-10 h-10 border-2 border-black overflow-hidden bg-[#e2e2e2] shrink-0">
                                    <img alt={member.name} className="w-full h-full object-cover" src={member.pic} />
                                  </div>
                                  <div className="font-ui text-16 font-bold truncate flex flex-col">
                                    <span>{member.name}</span>
                                    <span className="font-mono text-[10px] text-caption-gray uppercase tracking-widest mt-0.5">{member.role}</span>
                                  </div>
                                </div>
                                <SocialIcons member={member} />
                                <div className="col-span-3 flex justify-end gap-2 text-black">
                                  {(['president', 'vice_president'].includes(currentRole) || (isExecutive && member.role === 'Associate')) && <button onClick={() => setActionModal({ type: 'Promote', memberId: member.user_id, memberName: member.name, memberDomainId: domain.id })} className="font-ui text-[11px] font-bold border-2 border-[#057DBC] text-[#057DBC] px-2 py-1 uppercase hover:bg-[#057DBC] hover:text-white transition-colors">Promote</button>}
                                  {(isExecutive || (currentRole === 'lead' && member.role === 'Associate')) && <button onClick={() => setActionModal({ type: 'Kick', memberId: member.user_id, memberName: member.name, memberDomainId: domain.id })} className="font-ui text-[11px] font-bold border-2 border-red-600 text-red-600 px-2 py-1 uppercase hover:bg-red-600 hover:text-white transition-colors">Kick</button>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* MEMBERS SECTION */}
                      {rankedMembers.length > 0 && (
                        <div className="w-full">
                          <div className="bg-black text-white font-mono text-12 uppercase tracking-widest px-3 py-2 flex items-center">
                            Members
                          </div>
                          <div className="grid grid-cols-12 bg-[#e2e2e2] text-black font-mono text-xs uppercase tracking-widest p-3 border-b-2 border-black">
                            <div className="col-span-1 text-center">Rank</div>
                            <div className="col-span-4">Name</div>
                            <div className="col-span-2 text-right">Points</div>
                            <div className="col-span-2 text-center">Socials</div>
                            <div className="col-span-3 text-right">Actions</div>
                          </div>
                          <div className="flex flex-col">
                            {currentMembers.map((member, index) => (
                              <div key={member.user_id} className={`grid grid-cols-12 items-center p-3 border-b-2 ${index === currentMembers.length - 1 ? 'border-b-0' : 'border-b-black'} hover:bg-hairline-tint transition-colors`}>
                                <div className="col-span-1 text-center font-display text-xl font-bold text-caption-gray">#{member.rank}</div>
                                <div className="col-span-4 flex items-center gap-3">
                                  <div className="w-10 h-10 border-2 border-black overflow-hidden bg-[#e2e2e2] shrink-0">
                                    <img alt={member.name} className="w-full h-full object-cover" src={member.pic} />
                                  </div>
                                  <div className="font-ui text-16 font-bold truncate">{member.name}</div>
                                </div>
                                <div className="col-span-2 text-right font-display text-xl font-bold">{member.points.toLocaleString()}</div>
                                <SocialIcons member={member} />
                                <div className="col-span-3 flex justify-end gap-2 text-black">
                                  {['president', 'vice_president', 'secretary', 'joint_secretary', 'lead'].includes(currentRole) && <button onClick={() => setActionModal({ type: 'Promote', memberId: member.user_id, memberName: member.name, memberDomainId: domain.id })} className="font-ui text-[11px] font-bold border-2 border-[#057DBC] text-[#057DBC] px-2 py-1 uppercase hover:bg-[#057DBC] hover:text-white transition-colors">Promote</button>}
                                  {['president', 'vice_president', 'secretary', 'joint_secretary', 'lead', 'associate'].includes(currentRole) && <button onClick={() => setActionModal({ type: 'Kick', memberId: member.user_id, memberName: member.name, memberDomainId: domain.id })} className="font-ui text-[11px] font-bold border-2 border-red-600 text-red-600 px-2 py-1 uppercase hover:bg-red-600 hover:text-white transition-colors">Kick</button>}
                                </div>
                              </div>
                            ))}
                          </div>

                          {totalPages > 1 && (
                            <div className="flex justify-between items-center border-t-2 border-black p-4 bg-[#e2e2e2]">
                              <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="font-ui text-12 font-bold border-2 border-black px-4 py-2 uppercase hover:bg-black hover:text-white transition-0 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-black bg-white"
                              >
                                Previous
                              </button>
                              <span className="font-mono text-12 tracking-widest uppercase">
                                Page {currentPage} / {totalPages}
                              </span>
                              <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="font-ui text-12 font-bold border-2 border-black px-4 py-2 uppercase hover:bg-black hover:text-white transition-0 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-black bg-white"
                              >
                                Next Page
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.article>
          );
        })}
      </div>

      {/* Action modal + its send-off flight share one backdrop, so the letter flies
          against the same dimmed page instead of the overlay blinking between stages. */}
      <AnimatePresence>
        {(actionModal || flight) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 overflow-hidden"
          >
            {actionModal && (
            <motion.div
              initial={{ scale: 0.95 }}
              // The fold: collapse to a thin horizontal band, like creasing a letter shut.
              animate={folding ? { scaleY: 0.05, scaleX: 0.9 } : { scale: 1, scaleY: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: folding ? 0.32 : 0.2, ease: [0.4, 0, 0.2, 1] }}
              onAnimationComplete={handleFoldComplete}
              style={{ originY: 0.5 }}
              className="bg-white border-2 border-black w-full max-w-md flex flex-col"
            >
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">
                  {actionModal.type} Member
                </h2>
                <button onClick={resetActionForm} className="text-white hover:text-red-500 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>
              {/* Contents fade first and fast, so the fold reads as paper, not as squashed text. */}
              <motion.div
                className="p-6"
                animate={{ opacity: folding ? 0 : 1 }}
                transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
              >
                <p className="font-ui text-16 mb-6">
                  Are you sure you want to {actionModal.type.toLowerCase()} <strong>{actionModal.memberName}</strong>?
                </p>
                {actionModal.type === 'Promote' && (
                  <div className="flex flex-col gap-2 mb-4">
                    <label className="font-mono text-12 uppercase tracking-widest text-[#757575]">
                      Select New Role
                    </label>
                    <select
                      value={actionNewRole}
                      onChange={e => setActionNewRole(e.target.value)}
                      className="w-full border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC] bg-white"
                    >
                      {['president', 'vice_president'].includes(currentRole) && (
                        <>
                          <option value="vice_president">Vice President</option>
                          <option value="secretary">Secretary</option>
                          <option value="joint_secretary">Joint Secretary</option>
                        </>
                      )}
                      {isExecutive && <option value="lead">Lead</option>}
                      <option value="associate">Associate</option>
                    </select>
                  </div>
                )}
                <div className="flex flex-col gap-2 mb-8">
                  <label className="font-mono text-12 uppercase tracking-widest text-[#757575]">
                    Reason for {actionModal.type.toLowerCase()}
                  </label>
                  <textarea
                    className="w-full border-2 border-black p-3 font-ui text-14 resize-none h-28 outline-none focus:border-[#057DBC] transition-colors"
                    placeholder={`Provide a reason for this action...`}
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-4">
                  <button onClick={resetActionForm} disabled={submitting} className="font-ui text-14 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors disabled:opacity-40">Cancel</button>
                  <button onClick={handleActionSubmit} disabled={submitting} className={`font-ui text-14 font-bold border-2 border-black px-6 py-2 uppercase text-white transition-colors disabled:opacity-60 ${actionModal.type === 'Promote' ? 'bg-[#057DBC] border-[#057DBC] hover:bg-white hover:text-[#057DBC]' : 'bg-red-600 border-red-600 hover:bg-white hover:text-red-600'}`}>
                    {submitting ? "Sending..." : "Confirm"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
            )}

            {/* The folded letter sprouts wings and flies off with the outcome. */}
            {flight && <WingedLetter tone={flight.tone} onDone={handleFlightDone} />}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isNewDomainModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white border-2 border-black w-full max-w-md flex flex-col">
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">Create New Domain</h2>
                <button onClick={() => setIsNewDomainModalOpen(false)} className="text-white hover:text-red-500 transition-colors"><span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span></button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Domain Name</label>
                  <input type="text" value={newDomainData.name} onChange={e => setNewDomainData({...newDomainData, name: e.target.value})} className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Description</label>
                  <textarea value={newDomainData.desc} onChange={e => setNewDomainData({...newDomainData, desc: e.target.value})} className="border-2 border-black p-2 font-ui text-14 resize-none h-24 outline-none focus:border-[#057DBC]" />
                </div>
                <div className="flex justify-end gap-3 mt-4">
                  <button onClick={() => setIsNewDomainModalOpen(false)} className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors">Cancel</button>
                  <button onClick={handleCreateDomain} disabled={!newDomainData.name.trim()} className="font-ui text-12 font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-6 py-2 uppercase hover:bg-white hover:text-[#057DBC] transition-colors disabled:opacity-50">Create</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteDomainModalId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white border-2 border-black w-full max-w-sm flex flex-col">
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">Confirm Deletion</h2>
              </div>
              <div className="p-6 flex flex-col gap-4 text-center">
                <span className="material-symbols-outlined text-red-600 text-5xl mx-auto">warning</span>
                <p className="font-body text-16 text-[#4c4546]">Are you sure you want to delete this domain? Its members will be left without a domain assignment.</p>
                <div className="flex justify-center gap-3 mt-2">
                  <button onClick={() => setDeleteDomainModalId(null)} className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors">Cancel</button>
                  <button onClick={confirmDeleteDomain} className="font-ui text-12 font-bold border-2 border-red-600 bg-red-600 text-white px-6 py-2 uppercase hover:bg-white hover:text-red-600 transition-colors">Delete</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {updateDomainData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white border-2 border-black w-full max-w-md flex flex-col">
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">Update Domain</h2>
                <button onClick={() => setUpdateDomainData(null)} className="text-white hover:text-red-500 transition-colors"><span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span></button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Domain Name</label>
                  <input type="text" value={updateDomainData.name} onChange={e => setUpdateDomainData({...updateDomainData, name: e.target.value})} className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Description</label>
                  <textarea value={updateDomainData.desc} onChange={e => setUpdateDomainData({...updateDomainData, desc: e.target.value})} className="border-2 border-black p-2 font-ui text-14 resize-none h-24 outline-none focus:border-[#057DBC]" />
                </div>
                <div className="flex justify-end gap-3 mt-4">
                  <button onClick={() => setUpdateDomainData(null)} className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors">Cancel</button>
                  <button onClick={confirmUpdateDomain} disabled={!updateDomainData.name.trim()} className="font-ui text-12 font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-6 py-2 uppercase hover:bg-white hover:text-[#057DBC] transition-colors disabled:opacity-50">Save Changes</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast message={toast?.text ?? null} tone={toast?.tone} onDismiss={dismissToast} />

    </div>
  );
}
