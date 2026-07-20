import api from "@/lib/api/client";

export type CollegeRequestIn = {
  name: string;
  country: string;
  state?: string | null;
};

export type CollegeRequestOut = {
  id: number;
  status: string;
};

/** Log a college that's missing from the curated CollegeSelect picker. */
export async function requestCollege(body: CollegeRequestIn): Promise<CollegeRequestOut> {
  const res = await api.post<CollegeRequestOut>("/college-requests", body);
  return res.data;
}
