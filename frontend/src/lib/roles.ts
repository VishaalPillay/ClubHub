/**
 * Client-side mirror of backend app/core/permissions.py — display gating only.
 * The backend is the source of truth; these checks just hide UI the API would reject.
 */

export const ROLE_HIERARCHY = [
  "member",
  "associate",
  "lead",
  "joint_secretary",
  "secretary",
  "vice_president",
  "president",
] as const;

export type Role = (typeof ROLE_HIERARCHY)[number];

const rank = (role: string): number => ROLE_HIERARCHY.indexOf(role as Role);

/** True when `role` is at or above `min` in the hierarchy. Unknown roles rank lowest. */
export function roleAtLeast(role: string, min: Role): boolean {
  return rank(role) >= rank(min);
}

export const isLeadPlus = (role: string): boolean => roleAtLeast(role, "lead");
export const isSecPlus = (role: string): boolean => roleAtLeast(role, "joint_secretary");
export const isVPPlus = (role: string): boolean => roleAtLeast(role, "vice_president");

export const ROLE_LABELS: Record<string, string> = {
  president: "PRESIDENT",
  vice_president: "VICE PRESIDENT",
  secretary: "SECRETARY",
  joint_secretary: "JOINT SECRETARY",
  lead: "LEAD",
  associate: "ASSOCIATE",
  member: "MEMBER",
};

/** "vice_president" -> "Vice President" */
export function humanizeRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/** Roles requestable via the join flow (president is auto-assigned, never requestable).
 *  Mirrors backend `_DOMAIN_SCOPED_ROLES` in app/modules/clubs/service.py. */
export const JOINABLE_ROLES: { value: Role; label: string; needsDomain: boolean }[] = [
  { value: "vice_president", label: "Vice President", needsDomain: false },
  { value: "secretary", label: "Secretary", needsDomain: false },
  { value: "joint_secretary", label: "Joint Secretary", needsDomain: false },
  { value: "lead", label: "Lead", needsDomain: true },
  { value: "associate", label: "Associate", needsDomain: true },
  { value: "member", label: "Member", needsDomain: true },
];
