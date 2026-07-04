"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClub } from "@/features/club/ClubProvider";
import {
  createEvent,
  deleteEvent,
  listEvents,
  rsvpEvent,
  unrsvpEvent,
  updateEvent,
} from "@/lib/api/events";
import { isSecPlus } from "@/lib/roles";
import type { ClubEvent, EventStatus, EventType } from "@/types/api";

const TYPE_LABELS: Record<EventType, string> = {
  hackathon: "HACKATHON",
  tech_talk: "TECH TALK",
  workshop: "WORKSHOP",
  social: "SOCIAL",
};

const getPillColor = (type: EventType) => {
  switch (type) {
    case "hackathon": return "bg-red-600";
    case "tech_talk": return "bg-[#057DBC]";
    case "workshop": return "bg-green-600";
    case "social": return "bg-black";
    default: return "bg-black";
  }
};

const formatDate = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Date TBA";

const formatTime = (t: string | null) => {
  if (!t) return "Time TBA";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
};

type EventForm = {
  title: string;
  type: EventType;
  date: string;
  time: string;
  location: string;
  description: string;
  status: EventStatus;
};

const EMPTY_FORM: EventForm = {
  title: "", type: "tech_talk", date: "", time: "", location: "", description: "",
  status: "upcoming",
};

export default function EventsPage() {
  const { clubId, currentRole } = useClub();
  const queryClient = useQueryClient();
  const canManage = isSecPlus(currentRole); // Joint-Secretary+ creates/edits/deletes

  const { data: events = [], isPending } = useQuery({
    queryKey: ["club", clubId, "events"],
    queryFn: () => listEvents(clubId),
  });

  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [newEventData, setNewEventData] = useState<EventForm>(EMPTY_FORM);
  const [deleteEventModalId, setDeleteEventModalId] = useState<number | null>(null);
  const [updateEventId, setUpdateEventId] = useState<number | null>(null);
  const [updateEventData, setUpdateEventData] = useState<EventForm>(EMPTY_FORM);
  const [rsvpBusyId, setRsvpBusyId] = useState<number | null>(null);

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["club", clubId, "events"] });

  const handleCreateEvent = async () => {
    try {
      await createEvent(clubId, {
        title: newEventData.title,
        type: newEventData.type,
        description: newEventData.description || null,
        event_date: newEventData.date || null,
        event_time: newEventData.time || null,
        location: newEventData.location || null,
      });
      setIsNewEventModalOpen(false);
      setNewEventData(EMPTY_FORM);
      refetch();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to create event.");
    }
  };

  const openUpdateModal = (ev: ClubEvent) => {
    setUpdateEventId(ev.id);
    setUpdateEventData({
      title: ev.title,
      type: ev.type,
      date: ev.event_date ?? "",
      time: ev.event_time ? ev.event_time.slice(0, 5) : "",
      location: ev.location ?? "",
      description: ev.description ?? "",
      status: ev.status,
    });
  };

  const confirmUpdateEvent = async () => {
    if (updateEventId === null) return;
    try {
      await updateEvent(clubId, updateEventId, {
        title: updateEventData.title,
        type: updateEventData.type,
        description: updateEventData.description || null,
        event_date: updateEventData.date || null,
        event_time: updateEventData.time || null,
        location: updateEventData.location || null,
        status: updateEventData.status,
      });
      setUpdateEventId(null);
      refetch();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to update event.");
    }
  };

  const confirmDeleteEvent = async () => {
    if (deleteEventModalId === null) return;
    try {
      await deleteEvent(clubId, deleteEventModalId);
      setDeleteEventModalId(null);
      refetch();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to delete event.");
    }
  };

  const toggleRsvp = async (ev: ClubEvent) => {
    setRsvpBusyId(ev.id);
    try {
      if (ev.my_rsvp) await unrsvpEvent(clubId, ev.id);
      else await rsvpEvent(clubId, ev.id);
      refetch();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "RSVP failed.");
    } finally {
      setRsvpBusyId(null);
    }
  };

  const upcoming = events.filter((e) => e.status === "upcoming");
  const past = events.filter((e) => e.status !== "upcoming");

  const renderCard = (ev: ClubEvent, isPast: boolean) => (
    <motion.article
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      key={ev.id}
      className={`${isPast ? "bg-[#f3f3f3] opacity-80" : "bg-white"} border-2 border-black flex flex-col group/event relative`}
    >
      {canManage && (
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/event:opacity-100 transition-opacity z-10 bg-white/90 rounded px-1">
          <button onClick={() => openUpdateModal(ev)} className="text-black hover:text-[#057DBC]" title="Update">
            <span className="material-symbols-outlined text-[20px]">edit</span>
          </button>
          <button onClick={() => setDeleteEventModalId(ev.id)} className="text-black hover:text-red-600" title="Delete">
            <span className="material-symbols-outlined text-[20px]">delete</span>
          </button>
        </div>
      )}

      <div className="p-6 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-6">
          <span className={`inline-block font-mono text-[10px] uppercase text-white px-2 py-0.5 rounded-[1920px] ${getPillColor(ev.type)}`}>
            {TYPE_LABELS[ev.type]}
          </span>
          {ev.status === "past" && <span className="font-mono text-10 text-caption-gray uppercase">Concluded</span>}
          {ev.status === "cancelled" && <span className="font-mono text-10 text-red-600 uppercase">Cancelled</span>}
        </div>
        <h3 className={`font-display text-[48px] leading-[0.93] tracking-[-0.5px] font-bold mb-4 uppercase break-words ${!isPast ? "group-hover/event:text-[#057DBC] transition-colors" : ""}`}>
          {ev.title}
        </h3>
        {ev.description && (
          <p className="font-display text-[26px] leading-[1.08] text-[#757575] mb-6">{ev.description}</p>
        )}

        <div className="mt-auto space-y-1 border-t border-hairline-tint pt-3">
          <div className="flex items-center gap-2 text-[#4c4546]">
            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
            <span className="font-mono text-11 uppercase">{formatDate(ev.event_date)} • {formatTime(ev.event_time)}</span>
          </div>
          <div className="flex items-center gap-2 text-[#4c4546]">
            <span className="material-symbols-outlined text-[16px]">location_on</span>
            <span className="font-mono text-11 uppercase">{ev.location ?? "Location TBA"}</span>
          </div>
          <div className="flex items-center gap-2 text-[#4c4546]">
            <span className="material-symbols-outlined text-[16px]">person</span>
            <span className="font-mono text-11 uppercase">Hosted by {ev.creator_name}</span>
          </div>
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t-2 border-black">
          <span className="font-mono text-12 font-bold">
            {ev.attendees} {isPast ? "Attended" : "Attending"}
          </span>
          {!isPast && (
            <button
              onClick={() => toggleRsvp(ev)}
              disabled={rsvpBusyId === ev.id}
              className={`font-ui text-12 font-bold border-2 px-4 py-1.5 uppercase transition-colors disabled:opacity-50 ${
                ev.my_rsvp
                  ? "border-black bg-black text-white hover:bg-white hover:text-black"
                  : "border-[#057DBC] bg-[#057DBC] text-white hover:bg-white hover:text-[#057DBC]"
              }`}
            >
              {rsvpBusyId === ev.id ? "..." : ev.my_rsvp ? "✓ Attending" : "RSVP"}
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );

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
        {canManage && (
          <button
            onClick={() => setIsNewEventModalOpen(true)}
            className="bg-[#057DBC] text-white font-ui text-12 font-bold px-4 py-1.5 border-2 border-[#057DBC] hover:bg-white hover:text-[#057DBC] transition-colors uppercase shrink-0"
          >
            New Event
          </button>
        )}
      </div>

      {isPending ? (
        <p className="font-mono text-12 uppercase tracking-widest text-[#757575] animate-pulse">Loading events...</p>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Upcoming Events Section */}
          <div>
            <h2 className="font-display text-24 text-black border-b-2 border-black pb-1 mb-4 uppercase tracking-tight font-bold">Upcoming</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {upcoming.map((ev) => renderCard(ev, false))}
              </AnimatePresence>
              {upcoming.length === 0 && (
                <p className="font-mono text-14 text-[#757575] col-span-full">No upcoming events found.</p>
              )}
            </div>
          </div>

          {/* Past Events Section */}
          <div>
            <h2 className="font-display text-24 text-black border-b-2 border-black pb-1 mb-4 uppercase tracking-tight font-bold">Past Events</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnimatePresence>
                {past.map((ev) => renderCard(ev, true))}
              </AnimatePresence>
              {past.length === 0 && (
                <p className="font-mono text-14 text-[#757575] col-span-full">No past events found.</p>
              )}
            </div>
          </div>
        </div>
      )}

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
                      {(Object.keys(TYPE_LABELS) as EventType[]).map((t) => (
                        <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                      ))}
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
                      type="date"
                      value={newEventData.date}
                      onChange={e => setNewEventData({...newEventData, date: e.target.value})}
                      className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Time</label>
                    <input
                      type="time"
                      value={newEventData.time}
                      onChange={e => setNewEventData({...newEventData, time: e.target.value})}
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
        {updateEventId !== null && (
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
                <button onClick={() => setUpdateEventId(null)} className="text-white hover:text-red-500 transition-colors">
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
                      {(Object.keys(TYPE_LABELS) as EventType[]).map((t) => (
                        <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Status</label>
                    <select
                      value={updateEventData.status}
                      onChange={e => setUpdateEventData({...updateEventData, status: e.target.value as EventStatus})}
                      className="border-2 border-black p-2 font-ui text-14 bg-white outline-none focus:border-[#057DBC]"
                    >
                      <option value="upcoming">UPCOMING</option>
                      <option value="past">PAST</option>
                      <option value="cancelled">CANCELLED</option>
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
                      type="date"
                      value={updateEventData.date}
                      onChange={e => setUpdateEventData({...updateEventData, date: e.target.value})}
                      className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Time</label>
                    <input
                      type="time"
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
                    onClick={() => setUpdateEventId(null)}
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
