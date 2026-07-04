import api, { clubHeaders } from "@/lib/api/client";
import type { ClubEvent, EventStatus, EventType } from "@/types/api";

export async function listEvents(clubId: number, status?: EventStatus): Promise<ClubEvent[]> {
  const res = await api.get<ClubEvent[]>(`/clubs/${clubId}/events`, {
    headers: clubHeaders(clubId),
    params: status ? { status } : undefined,
  });
  return res.data;
}

export async function createEvent(
  clubId: number,
  body: {
    title: string;
    type: EventType;
    description?: string | null;
    event_date?: string | null;
    event_time?: string | null;
    location?: string | null;
  }
): Promise<ClubEvent> {
  const res = await api.post<ClubEvent>(`/clubs/${clubId}/events`, body, {
    headers: clubHeaders(clubId),
  });
  return res.data;
}

export async function updateEvent(
  clubId: number,
  eventId: number,
  changes: Partial<{
    title: string;
    type: EventType;
    description: string | null;
    event_date: string | null;
    event_time: string | null;
    location: string | null;
    status: EventStatus;
  }>
): Promise<ClubEvent> {
  const res = await api.put<ClubEvent>(`/clubs/${clubId}/events/${eventId}`, changes, {
    headers: clubHeaders(clubId),
  });
  return res.data;
}

export async function deleteEvent(clubId: number, eventId: number): Promise<void> {
  await api.delete(`/clubs/${clubId}/events/${eventId}`, { headers: clubHeaders(clubId) });
}

export async function rsvpEvent(clubId: number, eventId: number): Promise<ClubEvent> {
  const res = await api.post<ClubEvent>(
    `/clubs/${clubId}/events/${eventId}/rsvp`,
    {},
    { headers: clubHeaders(clubId) }
  );
  return res.data;
}

export async function unrsvpEvent(clubId: number, eventId: number): Promise<ClubEvent> {
  const res = await api.delete<ClubEvent>(`/clubs/${clubId}/events/${eventId}/rsvp`, {
    headers: clubHeaders(clubId),
  });
  return res.data;
}
