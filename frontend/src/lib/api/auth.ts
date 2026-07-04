import api from "@/lib/api/client";
import { tokenStore } from "@/lib/auth/tokenStore";
import type { TokenOut } from "@/types/api";

/** Register; stores the access token in memory (refresh cookie is set by the server). */
export async function register(name: string, email: string, password: string): Promise<void> {
  const res = await api.post<TokenOut>("/auth/register", { name, email, password });
  tokenStore.set(res.data.access_token);
}

/** Login; stores the access token in memory (refresh cookie is set by the server). */
export async function login(email: string, password: string): Promise<void> {
  const res = await api.post<TokenOut>("/auth/login", { email, password });
  tokenStore.set(res.data.access_token);
}

/** Revoke the refresh token server-side and drop the in-memory access token. */
export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } finally {
    tokenStore.clear();
  }
}
