import api from "@/lib/api/client";
import type { Profile, UpdateProfileIn } from "@/types/api";

export async function getProfile(): Promise<Profile> {
  const res = await api.get<Profile>("/users/me");
  return res.data;
}

export async function updateProfile(changes: UpdateProfileIn): Promise<Profile> {
  const res = await api.put<Profile>("/users/me", changes);
  return res.data;
}
