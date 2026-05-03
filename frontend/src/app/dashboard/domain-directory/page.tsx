"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GithubLogo, LinkedinLogo, InstagramLogo } from "@phosphor-icons/react";

type Member = {
  id: number;
  name: string;
  role: "Lead" | "Associate Lead" | "Member";
  points: number;
  pic: string;
};

const DOMAINS_DATA = [
  {
    id: "technical",
    name: "Technical",
    desc: "Engineering, development, and IT infrastructure management across global systems.",
    membersCount: 142,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAjy39WAPpGxTyzwmG8Zi9Etj38kUgDGh1dIUQXjLb2q73_IlPL_iyoO1NPObIhQDxHwl6jfx2H3nRMAAdsOhhkTOlHs6GB80Hb5A5LDO-lI2o8f0OqxyVrmOeDDyn-pm82CGCK2xIVf_pHLQK1cikg0MD86RzlGR4K32jY198WnnTOIBDQcW8mQ2VUj5q_eE8Da7x_8NJh9Cx_LUM7mO7bibZ7SDW8HGq7Xy_zhAVpa1SgcOjlXItDYO_EQKMkOsYFbbUiINbs9lXt",
    members: [
      { id: 1, name: "Alex Chen", role: "Lead", points: 1450, pic: "https://i.pravatar.cc/150?u=alex" },
      { id: 2, name: "Samira Tariq", role: "Associate Lead", points: 1320, pic: "https://i.pravatar.cc/150?u=samira" },
      { id: 3, name: "Emma Wong", role: "Member", points: 890, pic: "https://i.pravatar.cc/150?u=emma" },
      { id: 4, name: "Noah Wilson", role: "Member", points: 680, pic: "https://i.pravatar.cc/150?u=noah" },
      { id: 101, name: "Lucas Chen", role: "Member", points: 650, pic: "https://i.pravatar.cc/150?u=101" },
      { id: 102, name: "Ethan Hunt", role: "Member", points: 640, pic: "https://i.pravatar.cc/150?u=102" },
      { id: 103, name: "Mia Wong", role: "Member", points: 630, pic: "https://i.pravatar.cc/150?u=103" },
      { id: 104, name: "Sophia Li", role: "Member", points: 620, pic: "https://i.pravatar.cc/150?u=104" },
      { id: 105, name: "Jackson Park", role: "Member", points: 610, pic: "https://i.pravatar.cc/150?u=105" },
      { id: 106, name: "Aiden Kim", role: "Member", points: 600, pic: "https://i.pravatar.cc/150?u=106" },
      { id: 107, name: "Isabella Davis", role: "Member", points: 590, pic: "https://i.pravatar.cc/150?u=107" },
      { id: 108, name: "Liam Smith", role: "Member", points: 580, pic: "https://i.pravatar.cc/150?u=108" },
      { id: 109, name: "Olivia Johnson", role: "Member", points: 570, pic: "https://i.pravatar.cc/150?u=109" },
    ] as Member[],
  },
  {
    id: "corporate",
    name: "Corporate",
    desc: "Legal, finance, human resources, and high-level strategic operations.",
    membersCount: 87,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDsTdyn8-sgGGtH634r7rTqftF6uxvpKxB75Pxj4r8xzYa3ll82KJYECL7u8z7y2z58XiwNSpYHL8gouo2ZoUA_H0C-bq1s0F6gD5k2QTa6Xx7HOXhFE0Au-eLnaziHVFtLsVJyfeHlDFWYpOkh_5Bleb6re-SF04Gvyi4k86Vk-zi_vHUImpc3IRZwjDzan-BfmYeqarkcOcWlYS8jgH2S2FNdrdZ8zA40IE8LQ8VoTmzzSDnpUBiIjb6d6aDfuYB2K7JiyvpE9hbJ",
    members: [
      { id: 5, name: "Liam Davis", role: "Lead", points: 1250, pic: "https://i.pravatar.cc/150?u=liam2" },
      { id: 6, name: "Olivia Martinez", role: "Associate Lead", points: 1100, pic: "https://i.pravatar.cc/150?u=olivia2" },
      { id: 7, name: "James Anderson", role: "Member", points: 950, pic: "https://i.pravatar.cc/150?u=james2" },
    ] as Member[],
  },
  {
    id: "creative",
    name: "Creative",
    desc: "Design, content production, brand identity, and user experience research.",
    membersCount: 115,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAa5ImWwisPmCtoR5S1Fjd4_1qkmqmiUvl7KACXYDcl9V4rjMDTZBJw7Z2RS0Cp3VmzbFD16M5cOm7M25KzyrTBYLtl4j5UiQCRRMJ9TcuELpZ9m-RBAEySYuL-4x67wokQuwmw61uZnrUDeaZRkvHapoeVjjafx1i7vXIiv3DrdiscEE5YBLPGOCzx7Rth3c2ax5DxLoyGzKPnM5uXBhMnPx6aCwftFCNdTT1sWsQHiuICqwoyUO01eqfrtGfPyY0PLETqwjCd49rH",
    members: [
      { id: 8, name: "Maya Lin", role: "Lead", points: 1280, pic: "https://i.pravatar.cc/150?u=maya" },
      { id: 9, name: "Jordan Smith", role: "Associate Lead", points: 1150, pic: "https://i.pravatar.cc/150?u=jordan" },
      { id: 10, name: "Ava Taylor", role: "Member", points: 620, pic: "https://i.pravatar.cc/150?u=ava" },
    ] as Member[],
  },
  {
    id: "management",
    name: "Management",
    desc: "Product leadership, project management, and cross-functional team coordination.",
    membersCount: 54,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuB_D6OHLgtXVSf01RPCICRb-FNBLDFpH0P0ZY23a2VY0K9_Zs4BGIIZswcWwJ0S2jGLwG_OweA9NP4hpq4KqoeZTPHyfhIKzkgqAp8-2YqOVsjIVw_SVCx3xlmAWloxLJ3PsmmVXWyiLUhzU4SRpISpxoG-TvkiTOERP-3TpkRIfngzwbK2Edu_NonFWNoPpbQ0VJw5Ef2VfFjqqAJQs5r9ALET8FwtqFxUa-ea7g-Tsxy5MjUyEhjatP2kUzczGXUgxt3uGdjHLeXZ",
    members: [
      { id: 11, name: "Sarah Johnson", role: "Lead", points: 1090, pic: "https://i.pravatar.cc/150?u=sarah" },
      { id: 12, name: "David Lee", role: "Associate Lead", points: 950, pic: "https://i.pravatar.cc/150?u=david" },
      { id: 13, name: "Lucas Chen", role: "Member", points: 720, pic: "https://i.pravatar.cc/150?u=lucas" },
    ] as Member[],
  }
];

const ITEMS_PER_PAGE = 10;

export default function DomainDirectoryPage() {
  const [domains, setDomains] = useState(DOMAINS_DATA);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [actionModal, setActionModal] = useState<{ type: 'Promote' | 'Kick', memberId: number, memberName: string } | null>(null);
  const [actionReason, setActionReason] = useState("");
  
  // New Domain Modal
  const [isNewDomainModalOpen, setIsNewDomainModalOpen] = useState(false);
  const [newDomainData, setNewDomainData] = useState({ name: "", desc: "", image: "" });

  // Update / Delete Domain Modal state
  const [deleteDomainModalId, setDeleteDomainModalId] = useState<string | null>(null);
  const [updateDomainData, setUpdateDomainData] = useState<{ id: string, name: string, desc: string, image: string } | null>(null);

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      setCurrentPage(1); // Reset pagination
    }
  };

  const handleActionSubmit = () => {
    // Submit logic
    setActionModal(null);
    setActionReason("");
  };

  const handleCreateDomain = () => {
    const newDomain = {
      id: newDomainData.name.toLowerCase().replace(/\s+/g, '-'),
      name: newDomainData.name,
      desc: newDomainData.desc,
      membersCount: 0,
      image: newDomainData.image || "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=1500", // Fallback image
      members: []
    };
    setDomains([...domains, newDomain]);
    setIsNewDomainModalOpen(false);
    setNewDomainData({ name: "", desc: "", image: "" });
  };

  const confirmDeleteDomain = () => {
    if (deleteDomainModalId) {
      setDomains(domains.filter(d => d.id !== deleteDomainModalId));
      setDeleteDomainModalId(null);
    }
  };

  const confirmUpdateDomain = () => {
    if (updateDomainData) {
      setDomains(domains.map(d => d.id === updateDomainData.id ? { ...d, name: updateDomainData.name, desc: updateDomainData.desc, image: updateDomainData.image } : d));
      setUpdateDomainData(null);
    }
  };

  // Sort domains: expanded domain pops to the top
  const orderedDomains = [...domains].sort((a, b) => {
    if (a.id === expandedId) return -1;
    if (b.id === expandedId) return 1;
    return 0; // Preserve existing order for others
  });

  return (
    <div className="w-full flex flex-col gap-8 relative">
      {/* Editorial Ribbon */}
      <div className="flex justify-between items-end mb-6 w-full gap-4">
        <div className="flex flex-col flex-1">
          <div className="w-full h-[2px] bg-black"></div>
          <h1 className="bg-black text-white px-3 py-1 font-mono text-12 uppercase tracking-widest w-max inline-block">
            Domain Directory
          </h1>
        </div>
        <button 
          onClick={() => setIsNewDomainModalOpen(true)} 
          className="bg-[#057DBC] text-white font-ui text-12 font-bold px-4 py-1.5 border-2 border-[#057DBC] hover:bg-white hover:text-[#057DBC] transition-colors uppercase shrink-0"
        >
          New Domain
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {orderedDomains.map((domain) => {
          const isExpanded = expandedId === domain.id;
          
          // Pre-sort all members by points
          const sortedMembers = [...domain.members].sort((a, b) => b.points - a.points);

          const leads = sortedMembers.filter(m => m.role === 'Lead' || m.role === 'Associate Lead');
          const membersList = sortedMembers.filter(m => m.role === 'Member');
          
          // Start the Ranking for the Members only
          const members = membersList.map((m, idx) => ({ ...m, rank: idx + 1 }));

          const totalPages = Math.ceil(members.length / ITEMS_PER_PAGE);
          const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
          const currentMembers = members.slice(startIndex, startIndex + ITEMS_PER_PAGE);

          return (
            <motion.article 
              layout
              key={domain.id}
              onClick={() => !isExpanded && toggleExpand(domain.id)}
              className={`flex flex-col border-2 border-black rounded-none group/domain transition-colors duration-75 bg-white relative ${isExpanded ? 'md:col-span-2 shadow-none cursor-default' : 'col-span-1 hover:border-[3px] cursor-pointer'}`}
            >
              {/* Three dot menu */}
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/domain:opacity-100 transition-opacity z-10 bg-white/90 rounded px-1">
                <button className="text-black hover:text-[#057DBC]" title="Update" onClick={e => { e.stopPropagation(); setUpdateDomainData({ id: domain.id, name: domain.name, desc: domain.desc, image: domain.image }); }}>
                  <span className="material-symbols-outlined text-[20px]">edit</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); setDeleteDomainModalId(domain.id); }} className="text-black hover:text-red-600" title="Delete">
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>

              <div 
                className={`p-6 flex flex-col flex-1 border-b-2 border-black ${isExpanded ? 'cursor-pointer' : ''}`}
                onClick={(e) => {
                  if (isExpanded) {
                    e.stopPropagation();
                    toggleExpand(domain.id);
                  }
                }}
              >
                <motion.h2 layout className="font-display text-[64px] leading-[0.93] tracking-[-0.5px] font-bold text-black uppercase mb-6 group-hover/domain:text-[#057DBC] transition-colors break-words">
                  {domain.name}
                </motion.h2>
                <motion.p layout className="font-display text-[26px] leading-[1.08] text-[#757575] mb-8">
                  {domain.desc}
                </motion.p>
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
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
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
                              <div key={member.id} className={`grid grid-cols-12 items-center p-3 border-b-2 ${index === leads.length - 1 ? 'border-b-0' : 'border-b-black'} hover:bg-hairline-tint transition-colors`}>
                                <div className="col-span-7 flex items-center gap-3">
                                  <div className="w-10 h-10 border-2 border-black overflow-hidden bg-[#e2e2e2] shrink-0">
                                    <img alt={member.name} className="w-full h-full object-cover grayscale" src={member.pic} />
                                  </div>
                                  <div className="font-ui text-16 font-bold truncate flex flex-col">
                                    <span>{member.name}</span>
                                    <span className="font-mono text-[10px] text-caption-gray uppercase tracking-widest mt-0.5">{member.role}</span>
                                  </div>
                                </div>
                                <div className="col-span-2 flex justify-center gap-3 text-black">
                                  <a href="#" className="hover:text-[#057DBC] transition-colors" aria-label="LinkedIn"><LinkedinLogo size={20} weight="fill" /></a>
                                  <a href="#" className="hover:text-[#057DBC] transition-colors" aria-label="GitHub"><GithubLogo size={20} weight="fill" /></a>
                                  <a href="#" className="hover:text-[#057DBC] transition-colors" aria-label="Instagram"><InstagramLogo size={20} weight="fill" /></a>
                                </div>
                                <div className="col-span-3 flex justify-end gap-2 text-black">
                                  <button onClick={() => setActionModal({ type: 'Promote', memberId: member.id, memberName: member.name })} className="font-ui text-[11px] font-bold border-2 border-[#057DBC] text-[#057DBC] px-2 py-1 uppercase hover:bg-[#057DBC] hover:text-white transition-colors">Promote</button>
                                  <button onClick={() => setActionModal({ type: 'Kick', memberId: member.id, memberName: member.name })} className="font-ui text-[11px] font-bold border-2 border-red-600 text-red-600 px-2 py-1 uppercase hover:bg-red-600 hover:text-white transition-colors">Kick</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* MEMBERS SECTION */}
                      {members.length > 0 && (
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
                              <div key={member.id} className={`grid grid-cols-12 items-center p-3 border-b-2 ${index === currentMembers.length - 1 ? 'border-b-0' : 'border-b-black'} hover:bg-hairline-tint transition-colors`}>
                                <div className="col-span-1 text-center font-display text-xl font-bold text-caption-gray">#{member.rank}</div>
                                <div className="col-span-4 flex items-center gap-3">
                                  <div className="w-10 h-10 border-2 border-black overflow-hidden bg-[#e2e2e2] shrink-0">
                                    <img alt={member.name} className="w-full h-full object-cover grayscale" src={member.pic} />
                                  </div>
                                  <div className="font-ui text-16 font-bold truncate">{member.name}</div>
                                </div>
                                <div className="col-span-2 text-right font-display text-xl font-bold">{member.points.toLocaleString()}</div>
                                <div className="col-span-2 flex justify-center gap-3 text-black">
                                  <a href="#" className="hover:text-[#057DBC] transition-colors" aria-label="LinkedIn"><LinkedinLogo size={20} weight="fill" /></a>
                                  <a href="#" className="hover:text-[#057DBC] transition-colors" aria-label="GitHub"><GithubLogo size={20} weight="fill" /></a>
                                  <a href="#" className="hover:text-[#057DBC] transition-colors" aria-label="Instagram"><InstagramLogo size={20} weight="fill" /></a>
                                </div>
                                <div className="col-span-3 flex justify-end gap-2 text-black">
                                  <button onClick={() => setActionModal({ type: 'Promote', memberId: member.id, memberName: member.name })} className="font-ui text-[11px] font-bold border-2 border-[#057DBC] text-[#057DBC] px-2 py-1 uppercase hover:bg-[#057DBC] hover:text-white transition-colors">Promote</button>
                                  <button onClick={() => setActionModal({ type: 'Kick', memberId: member.id, memberName: member.name })} className="font-ui text-[11px] font-bold border-2 border-red-600 text-red-600 px-2 py-1 uppercase hover:bg-red-600 hover:text-white transition-colors">Kick</button>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {/* Pagination for Members */}
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

      {/* Action Modal (Promote / Kick) */}
      <AnimatePresence>
        {actionModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white border-2 border-black w-full max-w-md flex flex-col"
            >
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">
                  {actionModal.type} Member
                </h2>
                <button onClick={() => setActionModal(null)} className="text-white hover:text-red-500 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>
              <div className="p-6">
                <p className="font-ui text-16 mb-6">
                  Are you sure you want to {actionModal.type.toLowerCase()} <strong>{actionModal.memberName}</strong>?
                </p>
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
                  <button 
                    onClick={() => setActionModal(null)}
                    className="font-ui text-14 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleActionSubmit}
                    className={`font-ui text-14 font-bold border-2 border-black px-6 py-2 uppercase text-white transition-colors ${
                      actionModal.type === 'Promote' 
                        ? 'bg-[#057DBC] border-[#057DBC] hover:bg-white hover:text-[#057DBC]' 
                        : 'bg-red-600 border-red-600 hover:bg-white hover:text-red-600'
                    }`}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Domain Modal */}
      <AnimatePresence>
        {isNewDomainModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white border-2 border-black w-full max-w-md flex flex-col my-8"
            >
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">Create New Domain</h2>
                <button onClick={() => setIsNewDomainModalOpen(false)} className="text-white hover:text-red-500 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Domain Name</label>
                  <input 
                    type="text" 
                    value={newDomainData.name} 
                    onChange={e => setNewDomainData({...newDomainData, name: e.target.value})}
                    placeholder="e.g. Finance"
                    className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Description</label>
                  <textarea 
                    value={newDomainData.desc} 
                    onChange={e => setNewDomainData({...newDomainData, desc: e.target.value})}
                    placeholder="Brief description of the domain..."
                    className="border-2 border-black p-2 font-ui text-14 resize-none h-24 outline-none focus:border-[#057DBC]"
                  />
                </div>



                <div className="flex justify-end gap-3 mt-4">
                  <button 
                    onClick={() => setIsNewDomainModalOpen(false)}
                    className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleCreateDomain}
                    disabled={!newDomainData.name.trim()}
                    className="font-ui text-12 font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-6 py-2 uppercase hover:bg-white hover:text-[#057DBC] transition-colors disabled:opacity-50 disabled:hover:bg-[#057DBC] disabled:hover:text-white"
                  >
                    Create
                  </button>
                </div>
                
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteDomainModalId && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white border-2 border-black w-full max-w-sm flex flex-col"
            >
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">Confirm Deletion</h2>
              </div>
              <div className="p-6 flex flex-col gap-4 text-center">
                <span className="material-symbols-outlined text-red-600 text-5xl mx-auto">warning</span>
                <p className="font-body text-16 text-[#4c4546]">Are you sure you want to delete this domain? This will remove all associated members.</p>
                <div className="flex justify-center gap-3 mt-2">
                  <button onClick={() => setDeleteDomainModalId(null)} className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors">
                    Cancel
                  </button>
                  <button onClick={confirmDeleteDomain} className="font-ui text-12 font-bold border-2 border-red-600 bg-red-600 text-white px-6 py-2 uppercase hover:bg-white hover:text-red-600 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Update Domain Modal */}
      <AnimatePresence>
        {updateDomainData && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white border-2 border-black w-full max-w-md flex flex-col my-8"
            >
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">Update Domain</h2>
                <button onClick={() => setUpdateDomainData(null)} className="text-white hover:text-red-500 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Domain Name</label>
                  <input 
                    type="text" 
                    value={updateDomainData.name} 
                    onChange={e => setUpdateDomainData({...updateDomainData, name: e.target.value})}
                    className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Description</label>
                  <textarea 
                    value={updateDomainData.desc} 
                    onChange={e => setUpdateDomainData({...updateDomainData, desc: e.target.value})}
                    className="border-2 border-black p-2 font-ui text-14 resize-none h-24 outline-none focus:border-[#057DBC]"
                  />
                </div>



                <div className="flex justify-end gap-3 mt-4">
                  <button 
                    onClick={() => setUpdateDomainData(null)}
                    className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmUpdateDomain}
                    disabled={!updateDomainData.name.trim()}
                    className="font-ui text-12 font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-6 py-2 uppercase hover:bg-white hover:text-[#057DBC] transition-colors disabled:opacity-50"
                  >
                    Save Changes
                  </button>
                </div>
                
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
