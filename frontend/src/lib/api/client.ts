import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { tokenStore } from "@/lib/auth/tokenStore";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Typed axios client.
 * - Attaches the in-memory Bearer token on every request.
 * - `withCredentials` so the httpOnly refresh cookie rides on /auth/* calls.
 * - On a 401 (outside the auth endpoints) it silently refreshes once and retries;
 *   if the refresh fails the session is dead and we bounce to /login.
 * - Club-scoped endpoints set X-Club-ID explicitly in lib/api/* from the URL segment.
 */
const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10_000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Single-flight refresh: concurrent 401s share one /auth/refresh round-trip.
let refreshPromise: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ access_token: string }>(`${BASE_URL}/auth/refresh`, undefined, {
        withCredentials: true,
        timeout: 10_000,
      })
      .then((res) => {
        tokenStore.set(res.data.access_token);
        return res.data.access_token;
      })
      .catch(() => {
        tokenStore.clear();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Endpoints whose 401s must NOT trigger a silent refresh (they ARE the auth flow).
const AUTH_FLOW_PATHS = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const url = original?.url ?? "";

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !AUTH_FLOW_PATHS.some((p) => url.startsWith(p))
    ) {
      original._retry = true;
      const token = await refreshAccessToken();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      // Refresh failed — the session is gone.
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }

    // Normalize to a readable message but keep `response` for callers that inspect it.
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    let message: string;
    if (Array.isArray(detail)) {
      // FastAPI validation error — array of {loc, msg, type}
      message = detail
        .map((e: { loc?: string[]; msg?: string }) => `${e.loc?.join(".")} — ${e.msg}`)
        .join("; ");
    } else if (typeof detail === "string") {
      message = detail;
    } else {
      message = error.message ?? "An error occurred";
    }
    const normalized = new Error(message) as Error & { response?: unknown; code?: string };
    normalized.response = error.response;
    normalized.code = (error.response?.data as { code?: string } | undefined)?.code;
    return Promise.reject(normalized);
  }
);

/** Header helper for club-scoped endpoints — the club id always comes from the URL segment. */
export function clubHeaders(clubId: number): { "X-Club-ID": string } {
  return { "X-Club-ID": String(clubId) };
}

export default api;
