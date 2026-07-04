import api, { clubHeaders } from "@/lib/api/client";
import type { DomainBrief } from "@/types/api";

export async function listDomains(clubId: number): Promise<DomainBrief[]> {
  const res = await api.get<DomainBrief[]>(`/clubs/${clubId}/domains`, {
    headers: clubHeaders(clubId),
  });
  return res.data;
}

export async function createDomain(
  clubId: number,
  name: string,
  description?: string | null
): Promise<DomainBrief> {
  const res = await api.post<DomainBrief>(
    `/clubs/${clubId}/domains`,
    { name, description },
    { headers: clubHeaders(clubId) }
  );
  return res.data;
}

export async function updateDomain(
  clubId: number,
  domainId: number,
  changes: { name?: string; description?: string | null }
): Promise<DomainBrief> {
  const res = await api.put<DomainBrief>(`/clubs/${clubId}/domains/${domainId}`, changes, {
    headers: clubHeaders(clubId),
  });
  return res.data;
}

export async function deleteDomain(clubId: number, domainId: number): Promise<void> {
  await api.delete(`/clubs/${clubId}/domains/${domainId}`, { headers: clubHeaders(clubId) });
}
