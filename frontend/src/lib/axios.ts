import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
  timeout: 10_000,
});

// Attach Bearer token + X-Club-ID on every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("clubhub_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;

    const clubId = localStorage.getItem("clubhub_active_club_id");
    if (clubId) config.headers["X-Club-ID"] = clubId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error?.response?.data?.detail;
    let message: string;
    if (Array.isArray(detail)) {
      // FastAPI validation error — array of {loc, msg, type}
      message = detail.map((e: any) => `${e.loc?.join(".")} — ${e.msg}`).join("; ");
    } else if (typeof detail === "string") {
      message = detail;
    } else {
      message = error?.message ?? "An error occurred";
    }
    return Promise.reject(new Error(message));
  }
);

export default api;
