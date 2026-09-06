import api from "@/lib/api/client";
import type { PromotionNotice } from "@/types/api";

export async function listNotices(): Promise<PromotionNotice[]> {
  const res = await api.get<PromotionNotice[]>("/users/me/notices");
  return res.data;
}

export async function ackNotice(id: number): Promise<void> {
  await api.delete(`/users/me/notices/${id}`);
}
