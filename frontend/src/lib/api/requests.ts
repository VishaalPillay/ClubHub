import api, { clubHeaders } from "@/lib/api/client";
import type { ActionRequest, JoinRequest, Member } from "@/types/api";

// ── Join requests (Sec+) ──────────────────────────────────────────────────────

export async function listJoinRequests(clubId: number): Promise<JoinRequest[]> {
  const res = await api.get<JoinRequest[]>(`/clubs/${clubId}/requests`, {
    headers: clubHeaders(clubId),
  });
  return res.data;
}

export async function approveJoinRequest(clubId: number, requestId: number): Promise<Member> {
  const res = await api.put<Member>(
    `/clubs/${clubId}/requests/${requestId}/approve`,
    {},
    { headers: clubHeaders(clubId) }
  );
  return res.data;
}

export async function rejectJoinRequest(clubId: number, requestId: number): Promise<void> {
  await api.put(`/clubs/${clubId}/requests/${requestId}/reject`, {}, {
    headers: clubHeaders(clubId),
  });
}

// ── Action requests (Lead-raised promote/kick governance) ─────────────────────

export async function listActionRequests(clubId: number): Promise<ActionRequest[]> {
  const res = await api.get<ActionRequest[]>(`/clubs/${clubId}/action-requests`, {
    headers: clubHeaders(clubId),
  });
  return res.data;
}

export async function createActionRequest(
  clubId: number,
  body: {
    target_id: number;
    action_type: "promote" | "kick";
    new_role: string | null;
    reason: string;
  }
): Promise<ActionRequest> {
  const res = await api.post<ActionRequest>(`/clubs/${clubId}/action-requests`, body, {
    headers: clubHeaders(clubId),
  });
  return res.data;
}

export async function approveActionRequest(clubId: number, requestId: number): Promise<void> {
  await api.put(`/clubs/${clubId}/action-requests/${requestId}/approve`, {}, {
    headers: clubHeaders(clubId),
  });
}

export async function rejectActionRequest(clubId: number, requestId: number): Promise<void> {
  await api.put(`/clubs/${clubId}/action-requests/${requestId}/reject`, {}, {
    headers: clubHeaders(clubId),
  });
}
