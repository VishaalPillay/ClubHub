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

export type CollegeOut = {
  id: number;
  name: string;
};

/**
 * Community-promoted colleges for a country/state — auto-promoted from `requestCollege` logs
 * once enough distinct users have asked for the same one (see
 * backend/app/scripts/promote_college_requests.py). CollegeSelect merges this with the static
 * curated list, so the dropdown grows without a frontend redeploy.
 */
export async function getColleges(country: string, state: string | null): Promise<CollegeOut[]> {
  const res = await api.get<CollegeOut[]>("/colleges", { params: { country, state } });
  return res.data;
}
