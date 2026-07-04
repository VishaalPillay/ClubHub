import api, { clubHeaders } from "@/lib/api/client";
import type {
  ClubDetail,
  ClubLookup,
  ClubOut,
  DirectoryClub,
  MyClub,
  PendingRequest,
} from "@/types/api";

export async function createClub(
  name: string,
  description: string | null,
  enabledRoles: string[]
): Promise<ClubOut> {
  const res = await api.post<ClubOut>("/clubs", {
    name,
    description,
    enabled_roles: enabledRoles,
  });
  return res.data;
}

export async function myClubs(): Promise<MyClub[]> {
  const res = await api.get<MyClub[]>("/clubs/my");
  return res.data;
}

export async function directory(): Promise<DirectoryClub[]> {
  const res = await api.get<DirectoryClub[]>("/clubs/directory");
  return res.data;
}

export async function lookupClub(code: string): Promise<ClubLookup> {
  const res = await api.get<ClubLookup>("/clubs/lookup", { params: { code } });
  return res.data;
}

export async function joinClub(body: {
  club_code: string;
  requested_role: string;
  requested_domain_id: number | null;
  message?: string | null;
}): Promise<{ id: number; club_id: number; status: string }> {
  const res = await api.post("/clubs/join", body);
  return res.data;
}

export async function pendingRequests(): Promise<PendingRequest[]> {
  const res = await api.get<PendingRequest[]>("/clubs/pending");
  return res.data;
}

export async function withdrawJoin(requestId: number): Promise<void> {
  await api.delete(`/clubs/join/${requestId}`);
}

export async function getClub(clubId: number): Promise<ClubDetail> {
  const res = await api.get<ClubDetail>(`/clubs/${clubId}`, { headers: clubHeaders(clubId) });
  return res.data;
}

export async function updateClub(
  clubId: number,
  changes: Partial<{
    name: string;
    description: string | null;
    is_public: boolean;
    enabled_roles: string[];
  }>
): Promise<ClubDetail> {
  const res = await api.put<ClubDetail>(`/clubs/${clubId}`, changes, {
    headers: clubHeaders(clubId),
  });
  return res.data;
}
