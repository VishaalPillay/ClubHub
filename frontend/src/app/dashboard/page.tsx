"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FeaturedProfilesCarousel from "./FeaturedProfilesCarousel";
import { useDashboard } from "./DashboardContext";
import api from "@/lib/axios";

type AnnouncementType = 'urgent' | 'general';
type AnnouncementScope = 'global' | 'domain';

type Announcement = {
  id: number;
  club_id: number;
  author_id: number;
  author_name: string;
  type: AnnouncementType;
  title: string;
  body: string;
  scope: AnnouncementScope;
  domain_id: number | null;
  created_at: string;
};

export default function OverviewPage() {
  const { clubId, currentRole, domainId, userId } = useDashboard();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [pendingJoinRequestsCount, setPendingJoinRequestsCount] = useState(0);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftData, setDraftData] = useState<{ type: AnnouncementType, scope: AnnouncementScope, title: string, body: string }>({
    type: 'general',
    scope: 'global',
    title: '',
    body: ''
  });
  const [deleteModalId, setDeleteModalId] = useState<number | null>(null);
  const [updateData, setUpdateData] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);

  // RBAC checks
  const isSecPlus = ['president', 'vice_president', 'secretary', 'joint_secretary'].includes(currentRole);
  const isVPPlus = ['president', 'vice_president'].includes(currentRole);
  const canDraft = ['lead', 'joint_secretary', 'secretary', 'vice_president', 'president'].includes(currentRole);
  const isMember = currentRole === 'member';

  const fetchAnnouncements = async () => {
    try {
      const res = await api.get(`/clubs/${clubId}/announcements`, {
        headers: { "X-Club-ID": String(clubId) }
      });
      setAnnouncements(res.data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    if (isSecPlus) {
      api.get(`/clubs/${clubId}/requests`, { headers: { "X-Club-ID": String(clubId) } })
         .then(res => setPendingJoinRequestsCount(res.data.length))
         .catch(e => console.error(e));
    }
  }, [clubId, isSecPlus]);

  const handlePublish = async () => {
    if (!draftData.title.trim() || !draftData.body.trim()) return;
    try {
      await api.post(`/clubs/${clubId}/announcements`, {
        type: draftData.type,
        title: draftData.title,
        body: draftData.body,
        scope: isSecPlus ? draftData.scope : 'domain',
        domain_id: isSecPlus ? (draftData.scope === 'domain' ? domainId : null) : domainId,
      }, { headers: { "X-Club-ID": String(clubId) } });
      
      setIsDrafting(false);
      setDraftData({ type: 'general', scope: 'global', title: '', body: '' });
      fetchAnnouncements();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to publish");
    }
  };

  const getPillColor = (type: AnnouncementType) => {
    switch (type) {
      case 'urgent': return 'bg-red-600';
      case 'general': return 'bg-[#057DBC]';
      default: return 'bg-black';
    }
  };

  const confirmDelete = async () => {
    if (deleteModalId !== null) {
      try {
        await api.delete(`/clubs/${clubId}/announcements/${deleteModalId}`, {
          headers: { "X-Club-ID": String(clubId) }
        });
        setAnnouncements(announcements.filter(a => a.id !== deleteModalId));
      } catch(e: any) {
        alert("Failed to delete.");
      } finally {
        setDeleteModalId(null);
      }
    }
  };

  const confirmUpdate = async () => {
    if (updateData) {
      try {
        await api.put(`/clubs/${clubId}/announcements/${updateData.id}`, {
          type: updateData.type,
          title: updateData.title,
          body: updateData.body
        }, { headers: { "X-Club-ID": String(clubId) } });
        setUpdateData(null);
        fetchAnnouncements();
      } catch(e: any) {
        alert("Failed to update.");
      }
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  };

  if (loading) return null;

  return (
    <div className="w-full">
      {/* Hero Header */}
      <div className="mb-4 border-b-1 border-black pb-3">
        <h1 className="font-display text-5xl font-bold tracking-tightest">CLUB OVERVIEW</h1>
        <div className="font-body text-lg text-[#4c4546] mt-1">State of the union for the current academic term.</div>
      </div>

      {/* Metrics Grid */}
      {!isMember && !['lead', 'associate'].includes(currentRole) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="border-2 border-black p-3 relative group cursor-pointer hover:bg-black hover:text-white transition-0">
            <div className="font-mono text-sm uppercase text-caption-gray mb-0.5 group-hover:text-[#dadada] transition-0">Total Members</div>
            <div className="font-display text-5xl font-bold group-hover:text-white">--</div>
            <span className="material-symbols-outlined absolute top-3 right-3 text-[32px] opacity-20 group-hover:opacity-100">group</span>
          </div>
          <div className="border-2 border-black p-3 relative group cursor-pointer hover:bg-black hover:text-white transition-0">
            <div className="font-mono text-sm uppercase text-caption-gray mb-0.5 group-hover:text-[#dadada] transition-0">Active Tasks</div>
            <div className="font-display text-5xl font-bold group-hover:text-white">--</div>
            <span className="material-symbols-outlined absolute top-3 right-3 text-[32px] opacity-20 group-hover:opacity-100">format_list_bulleted</span>
          </div>
          <div className="border-2 border-black p-3 relative group cursor-pointer hover:bg-black hover:text-white transition-0">
            <div className="font-mono text-sm uppercase text-caption-gray mb-0.5 group-hover:text-[#dadada] transition-0">Upcoming Events</div>
            <div className="font-display text-5xl font-bold group-hover:text-white">--</div>
            <span className="material-symbols-outlined absolute top-3 right-3 text-[32px] opacity-20 group-hover:opacity-100">calendar_today</span>
          </div>
        </div>
      )}

      {/* Content Area Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column: Announcements */}
        <div className={isMember ? "lg:col-span-8" : "lg:col-span-8"}>
          <div className="bg-black text-white px-2 py-1 mb-3 font-mono text-sm uppercase">
            Recent Announcements
          </div>
          <div className="space-y-3">
            {announcements.length === 0 ? (
               <div className="border-2 border-black p-6 text-center font-mono text-sm uppercase text-[#757575]">
                 No announcements yet.
               </div>
            ) : null}
            <AnimatePresence>
              {announcements.map((announcement) => (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, height: 0 }}
                  key={announcement.id} 
                  className="border-2 border-black p-3 group bg-white relative"
                >
                  {/* Three dot menu (If creator or President/VP) */}
                  {(isVPPlus || announcement.author_id === userId) && (
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-1 rounded z-10">
                      <button onClick={() => setUpdateData(announcement)} className="text-[#757575] hover:text-[#057DBC]" title="Update">
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button onClick={() => setDeleteModalId(announcement.id)} className="text-[#757575] hover:text-red-600" title="Delete">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  )}

                  <div className="flex justify-between items-center mb-2 border-b border-hairline-tint pb-2">
                    <div className="flex items-center gap-3">
                      <span className={`inline-block font-mono text-[11px] uppercase text-white px-2 py-0.5 rounded-[1920px] ${getPillColor(announcement.type)}`}>
                        {announcement.type}
                      </span>
                      {announcement.scope === 'domain' && (
                        <span className="inline-block font-mono text-[10px] uppercase bg-[#f3f3f3] text-black px-2 py-0.5 border border-black">
                          Domain Only
                        </span>
                      )}
                      <span className="font-mono text-[12px] text-caption-gray">{formatDate(announcement.created_at)} • by {announcement.author_name}</span>
                    </div>
                  </div>
                  <h3 className="font-display text-[26px] leading-[1.08] mb-1 group-hover:text-link-blue hover:underline decoration-2 cursor-pointer transition-0 pr-12">
                    {announcement.title}
                  </h3>
                  <p className="font-body text-base text-[#4c4546] whitespace-pre-wrap">{announcement.body}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column: Quick Actions & Editorial Aside */}
        <div className="lg:col-span-4 lg:border-l-1 border-black lg:pl-3 mt-4 lg:mt-0 pt-4 lg:pt-0 border-t-1 lg:border-t-0">
          {!isMember && (
            <>
              <div className="bg-black text-white px-2 py-1 mb-3 font-mono text-sm uppercase">
                Executive Actions
              </div>
              <div className="mb-4">
                {canDraft && (
                  <div className="flex flex-col mb-1.5">
                    <button 
                      onClick={() => setIsDrafting(!isDrafting)} 
                      className={`w-full border-2 border-black font-ui text-base font-bold py-1.5 px-2 hover:bg-black hover:text-white transition-0 text-left flex justify-between items-center group ${isDrafting ? 'bg-black text-white' : 'bg-white'}`}
                    >
                      <span>Draft New Announcement</span>
                      <span className={`material-symbols-outlined transition-transform ${isDrafting ? 'rotate-90' : 'group-hover:translate-x-1'}`}>arrow_forward</span>
                    </button>
                    
                    <AnimatePresence>
                      {isDrafting && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }} 
                          animate={{ height: 'auto', opacity: 1 }} 
                          exit={{ height: 0, opacity: 0 }} 
                          className="overflow-hidden"
                        >
                          <div className="border-2 border-black border-t-0 p-4 bg-[#f3f3f3] flex flex-col gap-4">
                            
                            <div className="flex gap-2">
                              <button onClick={() => setDraftData({...draftData, type: 'urgent'})} className={`font-mono text-[10px] uppercase text-white px-3 py-1 rounded-[1920px] transition-colors ${draftData.type === 'urgent' ? 'bg-red-600 ring-2 ring-black ring-offset-1' : 'bg-red-600/50 hover:bg-red-600'}`}>URGENT</button>
                              <button onClick={() => setDraftData({...draftData, type: 'general'})} className={`font-mono text-[10px] uppercase text-white px-3 py-1 rounded-[1920px] transition-colors ${draftData.type === 'general' ? 'bg-[#057DBC] ring-2 ring-black ring-offset-1' : 'bg-[#057DBC]/50 hover:bg-[#057DBC]'}`}>GENERAL</button>
                            </div>
                            
                            {isSecPlus && (
                              <select 
                                value={draftData.scope} 
                                onChange={e => setDraftData({...draftData, scope: e.target.value as AnnouncementScope})}
                                className="border-2 border-black p-2 font-mono text-12 uppercase outline-none focus:border-[#057DBC]"
                              >
                                <option value="global">Global (All Members)</option>
                                {domainId && <option value="domain">Domain Specific</option>}
                              </select>
                            )}
                            {!isSecPlus && ['lead', 'associate'].includes(currentRole) && (
                               <div className="font-mono text-10 uppercase text-[#757575]">Posting to your domain</div>
                            )}

                            <input 
                              type="text" 
                              value={draftData.title} 
                              onChange={e => setDraftData({...draftData, title: e.target.value})}
                              placeholder="Announcement Title"
                              className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                            />
                            
                            <textarea 
                              value={draftData.body} 
                              onChange={e => setDraftData({...draftData, body: e.target.value})}
                              placeholder="Type your message here..."
                              className="border-2 border-black p-2 font-ui text-14 resize-none h-24 outline-none focus:border-[#057DBC]"
                            />

                            <button 
                              onClick={handlePublish}
                              disabled={!draftData.title.trim() || !draftData.body.trim()}
                              className="font-ui text-12 font-bold border-2 border-black bg-black text-white px-6 py-2 uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-50"
                            >
                              Publish Announcement
                            </button>

                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {isSecPlus && (
                  <>
                    <button 
                      onClick={() => window.location.href = '/dashboard/join-requests'}
                      className="w-full bg-white border-2 border-black font-ui text-base font-bold py-1.5 px-2 hover:bg-black hover:text-white transition-0 text-left flex justify-between items-center group mb-1.5"
                    >
                      <span className="flex items-center gap-2">
                        Review Join Requests
                        {pendingJoinRequestsCount > 0 && (
                          <span className="flex items-center justify-center w-5 h-5 bg-red-600 text-white text-[10px] rounded-full font-mono">
                            {pendingJoinRequestsCount}
                          </span>
                        )}
                      </span>
                      <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </button>
                    <button 
                      onClick={() => window.location.href = '/dashboard/action-requests'}
                      className="w-full bg-white border-2 border-black font-ui text-base font-bold py-1.5 px-2 hover:bg-black hover:text-white transition-0 text-left flex justify-between items-center group mb-1.5"
                    >
                      <span className="flex items-center gap-2">Action Requests</span>
                      <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </button>
                  </>
                )}
                
                {isVPPlus && (
                  <button className="w-full bg-white border-2 border-black font-ui text-base font-bold py-1.5 px-2 hover:bg-black hover:text-white transition-0 text-left flex justify-between items-center group">
                    <span>Update Club Details</span>
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </button>
                )}
              </div>
            </>
          )}

          {/* Editorial Image Block (Carousel) */}
          <FeaturedProfilesCarousel />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModalId !== null && (
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
                <p className="font-body text-16 text-[#4c4546]">Are you sure you want to delete this announcement? This action cannot be undone.</p>
                <div className="flex justify-center gap-3 mt-2">
                  <button onClick={() => setDeleteModalId(null)} className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors">
                    Cancel
                  </button>
                  <button onClick={confirmDelete} className="font-ui text-12 font-bold border-2 border-red-600 bg-red-600 text-white px-6 py-2 uppercase hover:bg-white hover:text-red-600 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Update Announcement Modal */}
      <AnimatePresence>
        {updateData !== null && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white border-2 border-black w-full max-w-md flex flex-col"
            >
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">Update Announcement</h2>
                <button onClick={() => setUpdateData(null)} className="text-white hover:text-red-500 transition-colors">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div className="flex gap-2 mb-2">
                  <button onClick={() => setUpdateData({...updateData, type: 'urgent'})} className={`font-mono text-[10px] uppercase text-white px-3 py-1 rounded-[1920px] transition-colors ${updateData.type === 'urgent' ? 'bg-red-600 ring-2 ring-black ring-offset-1' : 'bg-red-600/50 hover:bg-red-600'}`}>URGENT</button>
                  <button onClick={() => setUpdateData({...updateData, type: 'general'})} className={`font-mono text-[10px] uppercase text-white px-3 py-1 rounded-[1920px] transition-colors ${updateData.type === 'general' ? 'bg-[#057DBC] ring-2 ring-black ring-offset-1' : 'bg-[#057DBC]/50 hover:bg-[#057DBC]'}`}>GENERAL</button>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Title</label>
                  <input 
                    type="text" 
                    value={updateData.title} 
                    onChange={e => setUpdateData({...updateData, title: e.target.value})}
                    className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                  />
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Body</label>
                  <textarea 
                    value={updateData.body} 
                    onChange={e => setUpdateData({...updateData, body: e.target.value})}
                    className="border-2 border-black p-2 font-ui text-14 resize-none h-32 outline-none focus:border-[#057DBC]"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button onClick={() => setUpdateData(null)} className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors">
                    Cancel
                  </button>
                  <button 
                    onClick={confirmUpdate}
                    disabled={!updateData.title.trim() || !updateData.body.trim()}
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
