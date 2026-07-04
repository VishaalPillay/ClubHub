import api, { clubHeaders } from "@/lib/api/client";
import type { Announcement, AnnouncementScope, AnnouncementType } from "@/types/api";

export async function listAnnouncements(clubId: number): Promise<Announcement[]> {
  const res = await api.get<Announcement[]>(`/clubs/${clubId}/announcements`, {
    headers: clubHeaders(clubId),
  });
  return res.data;
}

export async function createAnnouncement(
  clubId: number,
  body: {
    title: string;
    body: string;
    type: AnnouncementType;
    scope: AnnouncementScope;
    domain_id: number | null;
  }
): Promise<Announcement> {
  const res = await api.post<Announcement>(`/clubs/${clubId}/announcements`, body, {
    headers: clubHeaders(clubId),
  });
  return res.data;
}

export async function updateAnnouncement(
  clubId: number,
  announcementId: number,
  changes: Partial<{ title: string; body: string; type: AnnouncementType }>
): Promise<Announcement> {
  const res = await api.put<Announcement>(
    `/clubs/${clubId}/announcements/${announcementId}`,
    changes,
    { headers: clubHeaders(clubId) }
  );
  return res.data;
}

export async function deleteAnnouncement(clubId: number, announcementId: number): Promise<void> {
  await api.delete(`/clubs/${clubId}/announcements/${announcementId}`, {
    headers: clubHeaders(clubId),
  });
}
