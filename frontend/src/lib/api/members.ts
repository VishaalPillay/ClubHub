import api, { clubHeaders } from "@/lib/api/client";
import type { Member } from "@/types/api";

export async function listMembers(clubId: number): Promise<Member[]> {
  const res = await api.get<Member[]>(`/clubs/${clubId}/members`, {
    headers: clubHeaders(clubId),
  });
  return res.data;
}

export async function updateMemberRole(
  clubId: number,
  userId: number,
  newRole: string,
  newDomainId: number | null
): Promise<Member> {
  const res = await api.put<Member>(
    `/clubs/${clubId}/members/${userId}/role`,
    { new_role: newRole, new_domain_id: newDomainId },
    { headers: clubHeaders(clubId) }
  );
  return res.data;
}

export async function removeMember(clubId: number, userId: number): Promise<void> {
  await api.delete(`/clubs/${clubId}/members/${userId}`, { headers: clubHeaders(clubId) });
}
