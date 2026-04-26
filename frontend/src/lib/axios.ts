import axios from "axios";

/**
 * Axios instance pre-configured to talk to the ClubHub FastAPI backend.
 * Base URL defaults to localhost:8000 for local development.
 * In production, set NEXT_PUBLIC_API_URL in your environment.
 */
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10_000,
});

// ─── Request Interceptor: attach Bearer token if present ─────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("clubhub_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Response Interceptor: surface clean error messages ──────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error?.response?.data?.detail ?? error?.message ?? "An error occurred";
    return Promise.reject(new Error(message));
  }
);

export default api;
