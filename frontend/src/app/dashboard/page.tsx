"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FeaturedProfilesCarousel from "./FeaturedProfilesCarousel";

type AnnouncementType = 'URGENT' | 'GENERAL';

type Announcement = {
  id: number;
  type: AnnouncementType;
  date: string;
  title: string;
  body: string;
};

const initialAnnouncements: Announcement[] = [
  {
    id: 1,
    type: 'URGENT',
    date: 'OCT 24, 2023',
    title: 'Budget Proposals Due for Q4',
    body: 'All committee heads must submit their finalized budget requests by Friday 5PM. No exceptions will be made for late submissions as we prepare the end-of-year financial report.'
  },
  {
    id: 3,
    type: 'GENERAL',
    date: 'OCT 18, 2023',
    title: 'Gala Ticket Sales Open',
    body: 'Early bird pricing for the Annual Winter Gala is now available through the student portal. Committees are encouraged to purchase tables in advance.'
  }
];

export default function OverviewPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftData, setDraftData] = useState<{ type: AnnouncementType, title: string, body: string }>({
    type: 'GENERAL',
    title: '',
    body: ''
  });
  const [deleteModalId, setDeleteModalId] = useState<number | null>(null);
  const [updateData, setUpdateData] = useState<Announcement | null>(null);

  const handlePublish = () => {
    if (!draftData.title.trim() || !draftData.body.trim()) return;
    
    const newAnnouncement: Announcement = {
      id: Date.now(),
      type: draftData.type,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
      title: draftData.title,
      body: draftData.body
    };
    
    setAnnouncements([newAnnouncement, ...announcements]);
    setIsDrafting(false);
    setDraftData({ type: 'GENERAL', title: '', body: '' });
  };

  const getPillColor = (type: AnnouncementType) => {
    switch (type) {
      case 'URGENT': return 'bg-red-600';
      case 'GENERAL': return 'bg-[#057DBC]';
      default: return 'bg-black';
    }
  };

  const confirmDelete = () => {
    if (deleteModalId !== null) {
      setAnnouncements(announcements.filter(a => a.id !== deleteModalId));
      setDeleteModalId(null);
    }
  };

  const confirmUpdate = () => {
    if (updateData) {
      setAnnouncements(announcements.map(a => a.id === updateData.id ? updateData : a));
      setUpdateData(null);
    }
  };

  return (
    <div className="w-full">
      {/* Hero Header */}
      <div className="mb-4 border-b-1 border-black pb-3">
        <h1 className="font-display text-5xl font-bold tracking-tightest">CLUB OVERVIEW</h1>
        <div className="font-body text-lg text-[#4c4546] mt-1">State of the union for the current academic term.</div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {/* Metric 1 */}
        <div className="border-2 border-black p-3 relative group cursor-pointer hover:bg-black hover:text-white transition-0">
          <div className="font-mono text-sm uppercase text-caption-gray mb-0.5 group-hover:text-[#dadada] transition-0">Total Members</div>
          <div className="font-display text-5xl font-bold group-hover:text-white">142</div>
          <div className="font-mono text-[12px] mt-1 text-[#4c4546] group-hover:text-[#dadada]">+12 this semester</div>
          <span className="material-symbols-outlined absolute top-3 right-3 text-[32px] opacity-20 group-hover:opacity-100">group</span>
        </div>
        {/* Metric 2 */}
        <div className="border-2 border-black p-3 relative group cursor-pointer hover:bg-black hover:text-white transition-0">
          <div className="font-mono text-sm uppercase text-caption-gray mb-0.5 group-hover:text-[#dadada] transition-0">Active Tasks</div>
          <div className="font-display text-5xl font-bold group-hover:text-white">28</div>
          <div className="font-mono text-[12px] mt-1 text-[#4c4546] group-hover:text-[#dadada]">5 critical priority</div>
          <span className="material-symbols-outlined absolute top-3 right-3 text-[32px] opacity-20 group-hover:opacity-100">format_list_bulleted</span>
        </div>
        {/* Metric 3 */}
        <div className="border-2 border-black p-3 relative group cursor-pointer hover:bg-black hover:text-white transition-0">
          <div className="font-mono text-sm uppercase text-caption-gray mb-0.5 group-hover:text-[#dadada] transition-0">Upcoming Events</div>
          <div className="font-display text-5xl font-bold group-hover:text-white">04</div>
          <div className="font-mono text-[12px] mt-1 text-[#4c4546] group-hover:text-[#dadada]">Next: Annual Gala (Nov 12)</div>
          <span className="material-symbols-outlined absolute top-3 right-3 text-[32px] opacity-20 group-hover:opacity-100">calendar_today</span>
        </div>
      </div>

      {/* Content Area Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column: Announcements */}
        <div className="lg:col-span-8">
          {/* Black Ribbon Header */}
          <div className="bg-black text-white px-2 py-1 mb-3 font-mono text-sm uppercase">
            Recent Announcements
          </div>
          <div className="space-y-3">
            <AnimatePresence>
              {announcements.map((announcement) => (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, height: 0 }}
                  key={announcement.id} 
                  className="border-2 border-black p-3 group bg-white relative"
                >
                  {/* Three dot menu */}
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-1 rounded z-10">
                    <button onClick={() => setUpdateData(announcement)} className="text-[#757575] hover:text-[#057DBC]" title="Update">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onClick={() => setDeleteModalId(announcement.id)} className="text-[#757575] hover:text-red-600" title="Delete">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>

                  <div className="flex justify-between items-center mb-2 border-b border-hairline-tint pb-2">
                    <div className="flex items-center gap-3">
                      <span className={`inline-block font-mono text-[11px] uppercase text-white px-2 py-0.5 rounded-[1920px] ${getPillColor(announcement.type)}`}>
                        {announcement.type}
                      </span>
                      <span className="font-mono text-[12px] text-caption-gray">{announcement.date}</span>
                    </div>
                  </div>
                  <h3 className="font-display text-[26px] leading-[1.08] mb-1 group-hover:text-link-blue hover:underline decoration-2 cursor-pointer transition-0 pr-12">
                    {announcement.title}
                  </h3>
                  <p className="font-body text-base text-[#4c4546]">{announcement.body}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column: Quick Actions & Editorial Aside */}
        <div className="lg:col-span-4 lg:border-l-1 border-black lg:pl-3 mt-4 lg:mt-0 pt-4 lg:pt-0 border-t-1 lg:border-t-0">
          {/* Black Ribbon Header */}
          <div className="bg-black text-white px-2 py-1 mb-3 font-mono text-sm uppercase">
            Executive Actions
          </div>
          <div className="mb-4">
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
                      
                      {/* Pill Selection */}
                      <div className="flex gap-2">
                        <button onClick={() => setDraftData({...draftData, type: 'URGENT'})} className={`font-mono text-[10px] uppercase text-white px-3 py-1 rounded-[1920px] transition-colors ${draftData.type === 'URGENT' ? 'bg-red-600 ring-2 ring-black ring-offset-1' : 'bg-red-600/50 hover:bg-red-600'}`}>URGENT</button>
                        <button onClick={() => setDraftData({...draftData, type: 'GENERAL'})} className={`font-mono text-[10px] uppercase text-white px-3 py-1 rounded-[1920px] transition-colors ${draftData.type === 'GENERAL' ? 'bg-[#057DBC] ring-2 ring-black ring-offset-1' : 'bg-[#057DBC]/50 hover:bg-[#057DBC]'}`}>GENERAL</button>
                      </div>

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
                        className="font-ui text-12 font-bold border-2 border-black bg-black text-white px-6 py-2 uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-50 disabled:hover:bg-black disabled:hover:text-white"
                      >
                        Publish Announcement
                      </button>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button className="w-full bg-white border-2 border-black font-ui text-base font-bold py-1.5 px-2 hover:bg-black hover:text-white transition-0 text-left flex justify-between items-center group mb-1.5">
              <span>Review Pending Members</span>
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
            <button className="w-full bg-white border-2 border-black font-ui text-base font-bold py-1.5 px-2 hover:bg-black hover:text-white transition-0 text-left flex justify-between items-center group">
              <span>Update Club Details</span>
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
          </div>

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
                  <button onClick={() => setUpdateData({...updateData, type: 'URGENT'})} className={`font-mono text-[10px] uppercase text-white px-3 py-1 rounded-[1920px] transition-colors ${updateData.type === 'URGENT' ? 'bg-red-600 ring-2 ring-black ring-offset-1' : 'bg-red-600/50 hover:bg-red-600'}`}>URGENT</button>
                  <button onClick={() => setUpdateData({...updateData, type: 'GENERAL'})} className={`font-mono text-[10px] uppercase text-white px-3 py-1 rounded-[1920px] transition-colors ${updateData.type === 'GENERAL' ? 'bg-[#057DBC] ring-2 ring-black ring-offset-1' : 'bg-[#057DBC]/50 hover:bg-[#057DBC]'}`}>GENERAL</button>
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
