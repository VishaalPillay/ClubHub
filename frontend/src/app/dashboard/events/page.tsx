"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type EventType = 'HACKATHON' | 'TECH TALK' | 'WORKSHOP' | 'SOCIAL';

type ClubEvent = {
  id: string;
  title: string;
  type: EventType;
  date: string;
  time: string;
  location: string;
  description: string;
  attendees: number;
  status: 'upcoming' | 'past';
  image: string;
};

const INITIAL_EVENTS: ClubEvent[] = [
  {
    id: "e1",
    title: "Winter Buildthon 2024",
    type: "HACKATHON",
    date: "Dec 15, 2023",
    time: "09:00 AM - 09:00 PM",
    location: "Main Campus Auditorium",
    description: "A 12-hour intense hackathon focused on building open-source community tools. Food and energy drinks provided.",
    attendees: 124,
    status: "upcoming",
    image: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80&w=1500"
  },
  {
    id: "e2",
    title: "AI & The Future of Web",
    type: "TECH TALK",
    date: "Nov 05, 2023",
    time: "04:00 PM - 06:00 PM",
    location: "Room 402, Tech Building",
    description: "Guest speaker Dr. Alan Turing discusses the impact of generative AI on modern web frameworks and development lifecycles.",
    attendees: 56,
    status: "upcoming",
    image: "https://images.unsplash.com/photo-1475669698648-2f144f0ca2bc?auto=format&fit=crop&q=80&w=1500"
  },
  {
    id: "e3",
    title: "React Fundamentals BootCamp",
    type: "WORKSHOP",
    date: "Oct 28, 2023",
    time: "10:00 AM - 01:00 PM",
    location: "Lab 3A",
    description: "Hands-on workshop covering React hooks, state management, and component lifecycles. Bring your laptops.",
    attendees: 32,
    status: "past",
    image: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=1500"
  }
];

export default function EventsPage() {
  const [events, setEvents] = useState<ClubEvent[]>(INITIAL_EVENTS);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  
  const [newEventData, setNewEventData] = useState({
    title: "", type: "TECH TALK" as EventType, date: "", time: "", location: "", description: "", image: ""
  });

  const [deleteEventModalId, setDeleteEventModalId] = useState<string | null>(null);
  const [updateEventData, setUpdateEventData] = useState<ClubEvent | null>(null);

  const getPillColor = (type: EventType) => {
    switch (type) {
      case 'HACKATHON': return 'bg-red-600';
      case 'TECH TALK': return 'bg-[#057DBC]';
      case 'WORKSHOP': return 'bg-green-600';
      case 'SOCIAL': return 'bg-black';
      default: return 'bg-black';
    }
  };

  const confirmDeleteEvent = () => {
    if (deleteEventModalId) {
      setEvents(events.filter(e => e.id !== deleteEventModalId));
      setDeleteEventModalId(null);
    }
  };

  const confirmUpdateEvent = () => {
    if (updateEventData) {
      setEvents(events.map(e => e.id === updateEventData.id ? updateEventData : e));
      setUpdateEventData(null);
    }
  };

  const handleCreateEvent = () => {
    const newEvent: ClubEvent = {
      id: `ev-${Date.now()}`,
      title: newEventData.title,
      type: newEventData.type,
      date: newEventData.date,
      time: newEventData.time,
      location: newEventData.location,
      description: newEventData.description,
      attendees: 0,
      status: 'upcoming',
      image: newEventData.image || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=1500"
    };
    setEvents([newEvent, ...events]);
    setIsNewEventModalOpen(false);
    setNewEventData({ title: "", type: "TECH TALK", date: "", time: "", location: "", description: "", image: "" });
  };

  return (
    <div className="w-full relative">
      {/* Editorial Ribbon Header */}
      <div className="flex justify-between items-end mb-6 w-full gap-4">
        <div className="flex flex-col flex-1">
          <div className="w-full h-[2px] bg-black"></div>
          <h1 className="bg-black text-white px-3 py-1 font-mono text-12 uppercase tracking-widest w-max inline-block">
            Events Registry
          </h1>
        </div>
        <button 
          onClick={() => setIsNewEventModalOpen(true)} 
          className="bg-[#057DBC] text-white font-ui text-12 font-bold px-4 py-1.5 border-2 border-[#057DBC] hover:bg-white hover:text-[#057DBC] transition-colors uppercase shrink-0"
        >
          New Event
        </button>
      </div>

      <div className="flex flex-col gap-8">
        {/* Upcoming Events Section */}
        <div>
          <h2 className="font-display text-24 text-black border-b-2 border-black pb-1 mb-4 uppercase tracking-tight font-bold">Upcoming</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {events.filter(e => e.status === 'upcoming').map((ev) => (
                <motion.article 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={ev.id} 
                  className="bg-white border-2 border-black flex flex-col group/event relative"
                >
                  {/* Three dot menu */}
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/event:opacity-100 transition-opacity z-10 bg-white/90 rounded px-1">
                    <button onClick={() => setUpdateEventData(ev)} className="text-black hover:text-[#057DBC]" title="Update">
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button onClick={() => setDeleteEventModalId(ev.id)} className="text-black hover:text-red-600" title="Delete">
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>

                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-6">
                      <span className={`inline-block font-mono text-[10px] uppercase text-white px-2 py-0.5 rounded-[1920px] ${getPillColor(ev.type)}`}>
                        {ev.type}
                      </span>
                    </div>
                    <h3 className="font-display text-[64px] leading-[0.93] tracking-[-0.5px] font-bold mb-4 uppercase group-hover/event:text-[#057DBC] transition-colors break-words">{ev.title}</h3>
                    <p className="font-display text-[26px] leading-[1.08] text-[#757575] mb-6">{ev.description}</p>
                    
                    <div className="mt-auto space-y-1 border-t border-hairline-tint pt-3">
                      <div className="flex items-center gap-2 text-[#4c4546]">
                        <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                        <span className="font-mono text-11 uppercase">{ev.date} • {ev.time}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[#4c4546]">
                        <span className="material-symbols-outlined text-[16px]">location_on</span>
                        <span className="font-mono text-11 uppercase">{ev.location}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-4 border-t-2 border-black">
                      <span className="font-mono text-12 font-bold">{ev.attendees} Attending</span>
                      <button className="font-ui text-12 font-bold border-2 border-black px-4 py-1.5 uppercase hover:bg-black hover:text-white transition-colors">
                        Manage
                      </button>
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
            {events.filter(e => e.status === 'upcoming').length === 0 && (
              <p className="font-mono text-14 text-[#757575] col-span-full">No upcoming events found.</p>
            )}
          </div>
        </div>

        {/* Past Events Section */}
        <div>
          <h2 className="font-display text-24 text-black border-b-2 border-black pb-1 mb-4 uppercase tracking-tight font-bold">Past Events</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence>
              {events.filter(e => e.status === 'past').map((ev) => (
                <motion.article 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={ev.id} 
                  className="bg-[#f3f3f3] border-2 border-black flex flex-col group/event relative opacity-80"
                >
                  {/* Three dot menu */}
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/event:opacity-100 transition-opacity z-10 bg-white/90 rounded px-1">
                    <button onClick={() => setUpdateEventData(ev)} className="text-black hover:text-[#057DBC]" title="Update">
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button onClick={() => setDeleteEventModalId(ev.id)} className="text-black hover:text-red-600" title="Delete">
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>

                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-6">
                      <span className={`inline-block font-mono text-[10px] uppercase text-white px-2 py-0.5 rounded-[1920px] ${getPillColor(ev.type)}`}>
                        {ev.type}
                      </span>
                      <span className="font-mono text-10 text-caption-gray uppercase">Concluded</span>
                    </div>
                    <h3 className="font-display text-[64px] leading-[0.93] tracking-[-0.5px] font-bold mb-4 uppercase break-words">{ev.title}</h3>
                    <p className="font-display text-[26px] leading-[1.08] text-[#757575] mb-6">{ev.description}</p>
                    
                    <div className="mt-auto space-y-1 border-t border-hairline-tint pt-3">
                      <div className="flex items-center gap-2 text-[#4c4546]">
                        <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                        <span className="font-mono text-11 uppercase">{ev.date} • {ev.time}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[#4c4546]">
                        <span className="material-symbols-outlined text-[16px]">location_on</span>
                        <span className="font-mono text-11 uppercase">{ev.location}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-4 pt-4 border-t-2 border-black">
                      <span className="font-mono text-12 font-bold">{ev.attendees} Attended</span>
                      <button className="font-ui text-12 font-bold border-2 border-black px-4 py-1.5 uppercase hover:bg-black hover:text-white transition-colors">
                        View Details
                      </button>
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
            {events.filter(e => e.status === 'past').length === 0 && (
              <p className="font-mono text-14 text-[#757575] col-span-full">No past events found.</p>
            )}
          </div>
        </div>
      </div>

      {/* New Event Modal */}
      <AnimatePresence>
        {isNewEventModalOpen && (
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
              className="bg-white border-2 border-black w-full max-w-lg flex flex-col my-8"
            >
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">Create New Event</h2>
                <button onClick={() => setIsNewEventModalOpen(false)} className="text-white hover:text-red-500 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Event Title</label>
                    <input 
                      type="text" 
                      value={newEventData.title} 
                      onChange={e => setNewEventData({...newEventData, title: e.target.value})}
                      placeholder="e.g. Winter Hackathon"
                      className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Event Type</label>
                    <select 
                      value={newEventData.type} 
                      onChange={e => setNewEventData({...newEventData, type: e.target.value as EventType})}
                      className="border-2 border-black p-2 font-ui text-14 bg-white outline-none focus:border-[#057DBC]"
                    >
                      <option value="HACKATHON">HACKATHON</option>
                      <option value="TECH TALK">TECH TALK</option>
                      <option value="WORKSHOP">WORKSHOP</option>
                      <option value="SOCIAL">SOCIAL</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Location</label>
                    <input 
                      type="text" 
                      value={newEventData.location} 
                      onChange={e => setNewEventData({...newEventData, location: e.target.value})}
                      placeholder="e.g. Auditorium"
                      className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Date</label>
                    <input 
                      type="text" 
                      value={newEventData.date} 
                      onChange={e => setNewEventData({...newEventData, date: e.target.value})}
                      placeholder="e.g. Nov 15, 2023"
                      className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Time</label>
                    <input 
                      type="text" 
                      value={newEventData.time} 
                      onChange={e => setNewEventData({...newEventData, time: e.target.value})}
                      placeholder="e.g. 09:00 AM"
                      className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Description</label>
                  <textarea 
                    value={newEventData.description} 
                    onChange={e => setNewEventData({...newEventData, description: e.target.value})}
                    placeholder="Details about the event..."
                    className="border-2 border-black p-2 font-ui text-14 resize-none h-20 outline-none focus:border-[#057DBC]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Cover Image URL (Optional)</label>
                  <input 
                    type="text" 
                    value={newEventData.image} 
                    onChange={e => setNewEventData({...newEventData, image: e.target.value})}
                    placeholder="https://..."
                    className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button 
                    onClick={() => setIsNewEventModalOpen(false)}
                    className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleCreateEvent}
                    disabled={!newEventData.title.trim()}
                    className="font-ui text-12 font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-6 py-2 uppercase hover:bg-white hover:text-[#057DBC] transition-colors disabled:opacity-50 disabled:hover:bg-[#057DBC] disabled:hover:text-white"
                  >
                    Publish Event
                  </button>
                </div>
                
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteEventModalId && (
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
                <p className="font-body text-16 text-[#4c4546]">Are you sure you want to delete this event?</p>
                <div className="flex justify-center gap-3 mt-2">
                  <button onClick={() => setDeleteEventModalId(null)} className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors">
                    Cancel
                  </button>
                  <button onClick={confirmDeleteEvent} className="font-ui text-12 font-bold border-2 border-red-600 bg-red-600 text-white px-6 py-2 uppercase hover:bg-white hover:text-red-600 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Update Event Modal */}
      <AnimatePresence>
        {updateEventData && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white border-2 border-black w-full max-w-lg flex flex-col my-8"
            >
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">Update Event</h2>
                <button onClick={() => setUpdateEventData(null)} className="text-white hover:text-red-500 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Event Title</label>
                    <input 
                      type="text" 
                      value={updateEventData.title} 
                      onChange={e => setUpdateEventData({...updateEventData, title: e.target.value})}
                      className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Event Type</label>
                    <select 
                      value={updateEventData.type} 
                      onChange={e => setUpdateEventData({...updateEventData, type: e.target.value as EventType})}
                      className="border-2 border-black p-2 font-ui text-14 bg-white outline-none focus:border-[#057DBC]"
                    >
                      <option value="HACKATHON">HACKATHON</option>
                      <option value="TECH TALK">TECH TALK</option>
                      <option value="WORKSHOP">WORKSHOP</option>
                      <option value="SOCIAL">SOCIAL</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Location</label>
                    <input 
                      type="text" 
                      value={updateEventData.location} 
                      onChange={e => setUpdateEventData({...updateEventData, location: e.target.value})}
                      className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Date</label>
                    <input 
                      type="text" 
                      value={updateEventData.date} 
                      onChange={e => setUpdateEventData({...updateEventData, date: e.target.value})}
                      className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Time</label>
                    <input 
                      type="text" 
                      value={updateEventData.time} 
                      onChange={e => setUpdateEventData({...updateEventData, time: e.target.value})}
                      className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Description</label>
                  <textarea 
                    value={updateEventData.description} 
                    onChange={e => setUpdateEventData({...updateEventData, description: e.target.value})}
                    className="border-2 border-black p-2 font-ui text-14 resize-none h-20 outline-none focus:border-[#057DBC]"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button 
                    onClick={() => setUpdateEventData(null)}
                    className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmUpdateEvent}
                    disabled={!updateEventData.title.trim()}
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
