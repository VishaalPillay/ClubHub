/** TypeScript mirrors of the backend Pydantic response schemas (see /docs). */

// ── Auth & profile ────────────────────────────────────────────────────────────

export type TokenOut = {
  access_token: string;
  token_type: string;
};

export type Profile = {
  id: number;
  name: string;
  email: string;
  institution: string | null;
  age: number | null;
  github_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type UpdateProfileIn = Partial<{
  name: string;
  institution: string | null;
  age: number | null;
  github_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  avatar_url: string | null;
}>;

// ── Clubs & joining ───────────────────────────────────────────────────────────

export type ClubOut = {
  id: number;
  name: string;
  description: string | null;
  code: string;
  is_public: boolean;
  enabled_roles: string[] | null;
};

export type MyClub = {
  id: number;
  name: string;
  description: string | null;
  code: string;
  role: string;
  domain_id: number | null;
};

export type ClubDetail = {
  id: number;
  name: string;
  description: string | null;
  code: string;
  is_public: boolean;
  enabled_roles: string[] | null;
  institution: string | null;
};

export type DirectoryClub = {
  id: number;
  name: string;
  description: string | null;
  institution: string | null;
};

export type ClubLookup = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  enabled_roles: string[] | null;
  domains: DomainBrief[];
};

export type PendingRequest = {
  id: number;
  club_id: number;
  club_name: string;
  code: string;
  requested_role: string;
  status: string;
  created_at: string;
};

// ── Domains & members ─────────────────────────────────────────────────────────

export type DomainBrief = {
  id: number;
  name: string;
  description: string | null;
};

export type Member = {
  user_id: number;
  name: string;
  email: string;
  role: string;
  domain_id: number | null;
  domain_name: string | null;
  points: number;
  joined_at: string;
};

// ── Requests (join + governance) ──────────────────────────────────────────────

export type JoinRequest = {
  id: number;
  user_id: number;
  user_name: string;
  club_id: number;
  requested_role: string;
  requested_domain_id: number | null;
  requested_domain_name: string | null;
  status: string;
  message: string | null;
  created_at: string;
};

export type ActionRequest = {
  id: number;
  club_id: number;
  requester_id: number;
  requester_name: string;
  target_id: number;
  target_name: string;
  action_type: "promote" | "kick";
  new_role: string | null;
  reason: string;
  status: string;
  created_at: string;
};

// ── Tasks & leaderboard ───────────────────────────────────────────────────────

export type TaskStatus = "todo" | "in_progress" | "completed";

export type Task = {
  id: number;
  domain_id: number;
  domain_name: string;
  title: string;
  description: string;
  status: TaskStatus;
  due_date: string | null;
  created_at: string;
  assignees: { id: number; name: string }[];
};

export type LeaderboardEntry = {
  rank: number;
  user_id: number;
  name: string;
  role: string;
  domain_id: number | null;
  domain_name: string | null;
  points: number;
};

// ── Announcements ─────────────────────────────────────────────────────────────

export type AnnouncementType = "urgent" | "general";
export type AnnouncementScope = "global" | "domain";

export type Announcement = {
  id: number;
  club_id: number;
  author_id: number;
  author_name: string;
  type: AnnouncementType;
  title: string;
  body: string;
  scope: AnnouncementScope;
  domain_id: number | null;
  domain_name: string | null;
  created_at: string;
};

// ── Events ────────────────────────────────────────────────────────────────────

export type EventType = "hackathon" | "tech_talk" | "workshop" | "social";
export type EventStatus = "upcoming" | "past" | "cancelled";

export type ClubEvent = {
  id: number;
  club_id: number;
  creator_id: number;
  creator_name: string;
  title: string;
  type: EventType;
  description: string | null;
  event_date: string | null; // ISO date (YYYY-MM-DD)
  event_time: string | null; // HH:MM:SS
  location: string | null;
  status: EventStatus;
  attendees: number;
  my_rsvp: boolean;
  created_at: string;
};
