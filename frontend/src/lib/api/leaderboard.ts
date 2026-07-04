import api, { clubHeaders } from "@/lib/api/client";
import type { LeaderboardEntry } from "@/types/api";

export async function getLeaderboard(
  clubId: number,
  domainId?: number | null
): Promise<LeaderboardEntry[]> {
  const res = await api.get<LeaderboardEntry[]>(`/clubs/${clubId}/leaderboard`, {
    headers: clubHeaders(clubId),
    params: domainId != null ? { domain_id: domainId } : undefined,
  });
  return res.data;
}
