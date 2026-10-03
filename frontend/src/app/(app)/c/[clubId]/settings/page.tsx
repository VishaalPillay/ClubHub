"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClub } from "@/features/club/ClubProvider";
import {
  getClub,
  updateClub,
  regenerateClubCode,
  transferPresidency,
  deleteClub,
} from "@/lib/api/clubs";
import { listMembers } from "@/lib/api/members";
import { isVPPlus, JOINABLE_ROLES, roleRank } from "@/lib/roles";
import type { ClubDetail, ClubVisibility } from "@/types/api";

/** The six ranks a club can toggle on/off — everything JOINABLE_ROLES lists (which
 *  already excludes 'president', per its own doc comment), reordered low-to-high so
 *  the checkboxes read the same direction as the hierarchy itself. */
const HIERARCHY_ROLES = [...JOINABLE_ROLES].sort((a, b) => roleRank(a.value) - roleRank(b.value));

/** The three directory-visibility tiers, in descending reach. Mirrors the backend's
 *  `visibility` VARCHAR values (app/modules/clubs/schemas.py::_VISIBILITY_VALUES). */
const VISIBILITY_OPTIONS: {
  value: ClubVisibility;
  label: string;
  hint: string;
}[] = [
  {
    value: "public",
    label: "Public Directory",
    hint: "Any student on ClubHub can find this club in the directory.",
  },
  {
    value: "institution",
    label: "My College Only",
    hint: "Only students whose profile college matches this club's appear-in-directory scope.",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    hint: "Hidden from the directory entirely — reachable only with the invite code.",
  },
];

/** Club settings — PUT /clubs/{id} (identity, directory visibility, intake). VP+ only. */
export default function ClubSettingsPage() {
  const { clubId, currentRole } = useClub();
  const router = useRouter();

  const canEdit = isVPPlus(currentRole);

  useEffect(() => {
    if (!canEdit) router.push(`/c/${clubId}/dashboard`);
  }, [canEdit, clubId, router]);

  const { data: club } = useQuery({
    queryKey: ["club", clubId, "detail"],
    queryFn: () => getClub(clubId),
    enabled: canEdit,
  });

  // Lives here, not in SettingsForm — a successful save changes club.visibility /
  // accepting_requests, which remounts SettingsForm below (see its key), and a state
  // held there would be wiped out before the user ever saw the confirmation.
  const [justSaved, setJustSaved] = useState(false);
  const flashSaved = () => {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  if (!canEdit || !club) return null;

  // Keyed by fetch identity so the form state re-initializes if the club record changes.
  return (
    <SettingsForm
      key={`${club.id}-${club.name}-${club.visibility}-${club.accepting_requests}`}
      club={club}
      clubId={clubId}
      justSaved={justSaved}
      onSaved={flashSaved}
    />
  );
}

function SettingsForm({
  club,
  clubId,
  justSaved,
  onSaved,
}: {
  club: ClubDetail;
  clubId: number;
  justSaved: boolean;
  onSaved: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentRole, userId } = useClub();
  const isPresident = currentRole === "president";

  const [form, setForm] = useState({
    name: club.name,
    description: club.description ?? "",
    institution: club.institution ?? "",
    visibility: club.visibility,
    accepting_requests: club.accepting_requests,
    enabled_roles: club.enabled_roles ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await updateClub(clubId, {
        name: form.name.trim(),
        description: form.description.trim() === "" ? null : form.description.trim(),
        institution: form.institution.trim() === "" ? null : form.institution.trim(),
        visibility: form.visibility,
        accepting_requests: form.accepting_requests,
        enabled_roles: form.enabled_roles,
      });
      queryClient.invalidateQueries({ queryKey: ["club", clubId, "detail"] });
      queryClient.invalidateQueries({ queryKey: ["club", clubId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["my-clubs"] });
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const toggleHierarchyRole = (role: string) => {
    setForm((prev) => ({
      ...prev,
      enabled_roles: prev.enabled_roles.includes(role)
        ? prev.enabled_roles.filter((r) => r !== role)
        : [...prev.enabled_roles, role],
    }));
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(club.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  // ── Regenerate invite code ──────────────────────────────────────────────
  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState("");

  const handleRegenerateCode = async () => {
    setRegenerateError("");
    setRegenerating(true);
    try {
      await regenerateClubCode(clubId);
      queryClient.invalidateQueries({ queryKey: ["club", clubId, "detail"] });
      queryClient.invalidateQueries({ queryKey: ["my-clubs"] });
      setRegenerateModalOpen(false);
    } catch (err: unknown) {
      setRegenerateError(err instanceof Error ? err.message : "Failed to regenerate code.");
    } finally {
      setRegenerating(false);
    }
  };

  // ── Transfer presidency (President only) ────────────────────────────────
  const { data: membersData = [] } = useQuery({
    queryKey: ["club", clubId, "members"],
    queryFn: () => listMembers(clubId),
    enabled: isPresident,
  });
  const transferCandidates = membersData
    .filter((m) => m.user_id !== userId)
    .sort((a, b) => roleRank(b.role) - roleRank(a.role));

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<number | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");

  const handleTransfer = async () => {
    if (!transferTargetId) return;
    setTransferError("");
    setTransferring(true);
    try {
      await transferPresidency(clubId, transferTargetId);
      queryClient.invalidateQueries({ queryKey: ["club", clubId, "detail"] });
      queryClient.invalidateQueries({ queryKey: ["club", clubId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["my-clubs"] });
      setTransferModalOpen(false);
      setTransferTargetId(null);
    } catch (err: unknown) {
      setTransferError(err instanceof Error ? err.message : "Failed to transfer presidency.");
    } finally {
      setTransferring(false);
    }
  };

  // ── Delete club (President only) ────────────────────────────────────────
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleDelete = async () => {
    setDeleteError("");
    setDeleting(true);
    try {
      await deleteClub(clubId);
      queryClient.invalidateQueries({ queryKey: ["my-clubs"] });
      router.push("/portal");
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete club.");
      setDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="mb-8 border-b-2 border-black pb-4">
        <p className="font-mono text-[12px] uppercase tracking-widest text-[#757575] mb-2">
          Club Settings
        </p>
        <h1 className="font-display text-5xl font-black tracking-tighter uppercase">
          {club.name}
        </h1>
      </div>

      {/* Invite code */}
      <div className="border-2 border-black p-6 mb-8 flex items-center justify-between bg-[#f3e8d6]">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-[#757575] mb-1">
            Invite Code
          </div>
          <div className="font-display text-4xl font-bold tracking-tight">{club.code}</div>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={copyCode}
            className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-paper transition-colors"
          >
            {copied ? "Copied!" : "Copy Code"}
          </button>
          <button
            onClick={() => setRegenerateModalOpen(true)}
            className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-paper transition-colors"
            title="Invalidate this code and issue a new one"
          >
            Regenerate
          </button>
        </div>
      </div>

      {error && (
        <div className="border-2 border-red-600 bg-red-50 px-4 py-3 mb-6">
          <p className="font-mono text-[11px] text-red-600 uppercase tracking-widest">{error}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="font-mono text-[11px] uppercase tracking-widest text-[#757575]">
            Club Name
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="border-2 border-black bg-paper text-black p-3 font-ui text-[15px] focus:outline-none focus:border-[#057DBC]"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-mono text-[11px] uppercase tracking-widest text-[#757575]">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What is this club about?"
            className="border-2 border-black bg-paper text-black p-3 font-ui text-[15px] resize-none h-28 focus:outline-none focus:border-[#057DBC]"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-mono text-[11px] uppercase tracking-widest text-[#757575]">
            College / Institution
          </label>
          <input
            type="text"
            value={form.institution}
            onChange={(e) => setForm({ ...form, institution: e.target.value })}
            placeholder="e.g. SRM Institute of Science and Technology"
            className="border-2 border-black bg-paper text-black p-3 font-ui text-[15px] focus:outline-none focus:border-[#057DBC]"
          />
          <p className="font-ui text-13 text-[#757575]">
            Shown on directory cards, and it defines who &quot;My College Only&quot; means below.
          </p>
        </div>

        {/* Directory visibility — three tiers, one choice. The divider lives on this
            wrapper, not the fieldset: a border on a fieldset that has a legend child
            gets visually cut by the browser's native legend/border layout (a stray
            partial line beside the label), so the fieldset itself stays borderless. */}
        <div className="pt-2 border-t-2 border-black">
          <fieldset className="flex flex-col gap-3">
            <legend className="font-mono text-[11px] uppercase tracking-widest text-[#757575] mb-3">
              Directory Visibility
            </legend>
            {VISIBILITY_OPTIONS.map((opt) => {
              const selected = form.visibility === opt.value;
              // "My College Only" is meaningless without a college on the club record.
              const disabled = opt.value === "institution" && form.institution.trim() === "";
              return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-4 border-2 p-4 transition-colors ${
                    disabled
                      ? "border-[#e0d0b6] opacity-50 cursor-not-allowed"
                      : selected
                        ? "border-[#057DBC] bg-[#f0f8ff] cursor-pointer"
                        : "border-black cursor-pointer hover:bg-[#f3e8d6]"
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={opt.value}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => setForm({ ...form, visibility: opt.value })}
                    className="w-5 h-5 mt-0.5 accent-[#057DBC] shrink-0"
                  />
                  <div>
                    <div className="font-ui text-16 font-bold uppercase">{opt.label}</div>
                    <div className="font-ui text-13 text-[#757575]">
                      {disabled
                        ? "Set a college above to use this option."
                        : opt.hint}
                    </div>
                  </div>
                </label>
              );
            })}
          </fieldset>
        </div>

        {/* Intake — independent of visibility */}
        <label
          className={`flex items-start gap-4 border-2 p-4 cursor-pointer transition-colors ${
            form.accepting_requests
              ? "border-black hover:bg-[#f3e8d6]"
              : "border-[#757575] bg-[#f3e8d6]"
          }`}
        >
          <input
            type="checkbox"
            checked={form.accepting_requests}
            onChange={(e) => setForm({ ...form, accepting_requests: e.target.checked })}
            className="w-5 h-5 mt-0.5 accent-black shrink-0"
          />
          <div>
            <div className="font-ui text-16 font-bold uppercase">
              Accept Join Requests
            </div>
            <div className="font-ui text-13 text-[#757575]">
              {form.accepting_requests
                ? "Students can send a request to join — by invite code or from the directory."
                : "Intake is paused. The club still appears in the directory (per the setting above) but shows “Not Recruiting”, and every join request is refused — recruit by invite only."}
            </div>
          </div>
        </label>

        {/* Hierarchy — which ranks this club actually uses. Unchecking a rank that
            current members still hold auto-demotes them to the next enabled rank
            below (floored at Member) the moment this form saves — not deferred, not
            blocked. 'President' isn't listed: it's never a toggle, always exactly
            one, assigned by creation or Transfer Presidency below. */}
        <div className="pt-2 border-t-2 border-black">
          <fieldset className="flex flex-col gap-3">
            <legend className="font-mono text-[11px] uppercase tracking-widest text-[#757575] mb-3">
              Hierarchy
            </legend>
            <p className="font-ui text-13 text-[#757575] -mt-2 mb-1">
              Which ranks this club uses, beyond President. Unchecking a rank that
              members currently hold demotes them to the next rank still enabled.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {HIERARCHY_ROLES.map((opt) => {
                const checked = form.enabled_roles.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 border-2 p-3 cursor-pointer transition-colors ${
                      checked
                        ? "border-[#057DBC] bg-[#f0f8ff]"
                        : "border-black hover:bg-[#f3e8d6]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleHierarchyRole(opt.value)}
                      className="w-5 h-5 accent-[#057DBC] shrink-0"
                    />
                    <span className="font-ui text-15 font-bold uppercase">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="flex gap-4 pt-4 border-t-2 border-black">
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="flex-1 bg-black text-paper border-2 border-black font-ui text-[15px] font-bold p-4 uppercase hover:bg-paper hover:text-black transition-colors disabled:opacity-40"
          >
            {saving ? "Saving..." : justSaved ? "Saved!" : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/c/${clubId}/dashboard`)}
            className="flex-1 bg-paper border-2 border-black text-black font-ui text-[15px] font-bold p-4 uppercase hover:bg-hairline-tint transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </form>

      {isPresident && (
        <div className="mt-10 pt-6 border-t-2 border-black">
          <p className="font-mono text-[11px] uppercase tracking-widest text-[#757575] mb-4">
            Presidency
          </p>
          <div className="border-2 border-black p-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="font-ui text-16 font-bold uppercase">Transfer Presidency</div>
              <div className="font-ui text-13 text-[#757575]">
                Hand the President rank to another current member — e.g. for a
                graduating president. You step down to Vice President.
              </div>
            </div>
            <button
              onClick={() => setTransferModalOpen(true)}
              className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-paper transition-colors shrink-0"
            >
              Transfer
            </button>
          </div>
        </div>
      )}

      {isPresident && (
        <div className="mt-10 pt-6 border-t-2 border-red-600">
          <p className="font-mono text-[11px] uppercase tracking-widest text-red-600 mb-4">
            Danger Zone
          </p>
          <div className="border-2 border-red-600 bg-red-50 p-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="font-ui text-16 font-bold uppercase text-red-600">
                Delete This Club
              </div>
              <div className="font-ui text-13 text-[#757575]">
                Permanently deletes the club and everything in it — members, domains,
                tasks, announcements, events. This cannot be undone.
              </div>
            </div>
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="font-ui text-12 font-bold border-2 border-red-600 bg-red-600 text-paper px-6 py-2 uppercase hover:bg-paper hover:text-red-600 transition-colors shrink-0"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Regenerate invite code confirm */}
      <AnimatePresence>
        {regenerateModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-paper border-2 border-black w-full max-w-sm flex flex-col">
              <div className="bg-black px-4 py-3">
                <h2 className="text-paper font-mono text-12 uppercase tracking-widest">Regenerate Invite Code</h2>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <p className="font-body text-15 text-[#4c4546]">
                  The current code <strong>{club.code}</strong> will stop working immediately.
                  Anyone holding it — including in an old message or link — will need the new one.
                </p>
                {regenerateError && (
                  <p className="font-mono text-[11px] text-red-600 uppercase tracking-widest">{regenerateError}</p>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => { setRegenerateModalOpen(false); setRegenerateError(""); }}
                    className="font-ui text-12 font-bold border-2 border-black px-4 py-2 uppercase hover:bg-black hover:text-paper transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRegenerateCode}
                    disabled={regenerating}
                    className="font-ui text-12 font-bold border-2 border-black bg-black text-paper px-4 py-2 uppercase hover:bg-paper hover:text-black transition-colors disabled:opacity-40"
                  >
                    {regenerating ? "Regenerating..." : "Regenerate"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer presidency */}
      <AnimatePresence>
        {transferModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-paper border-2 border-black w-full max-w-sm flex flex-col">
              <div className="bg-black px-4 py-3">
                <h2 className="text-paper font-mono text-12 uppercase tracking-widest">Transfer Presidency</h2>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <p className="font-body text-15 text-[#4c4546]">
                  Pick who becomes President. You&apos;ll step down to Vice President immediately.
                </p>
                {transferCandidates.length > 0 ? (
                  <select
                    value={transferTargetId ?? ""}
                    onChange={(e) => setTransferTargetId(e.target.value ? Number(e.target.value) : null)}
                    className="border-2 border-black p-3 font-ui text-15 bg-paper outline-none focus:border-[#057DBC]"
                  >
                    <option value="">Select a member…</option>
                    {transferCandidates.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.name} — {m.role.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="font-mono text-12 text-[#757575] uppercase">No other members to transfer to.</p>
                )}
                {transferError && (
                  <p className="font-mono text-[11px] text-red-600 uppercase tracking-widest">{transferError}</p>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => { setTransferModalOpen(false); setTransferError(""); setTransferTargetId(null); }}
                    className="font-ui text-12 font-bold border-2 border-black px-4 py-2 uppercase hover:bg-black hover:text-paper transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTransfer}
                    disabled={transferring || !transferTargetId}
                    className="font-ui text-12 font-bold border-2 border-black bg-black text-paper px-4 py-2 uppercase hover:bg-paper hover:text-black transition-colors disabled:opacity-40"
                  >
                    {transferring ? "Transferring..." : "Transfer"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete club — type-to-confirm */}
      <AnimatePresence>
        {deleteModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-paper border-2 border-red-600 w-full max-w-sm flex flex-col">
              <div className="bg-red-600 px-4 py-3">
                <h2 className="text-paper font-mono text-12 uppercase tracking-widest">Delete Club</h2>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <p className="font-body text-15 text-[#4c4546]">
                  This permanently deletes <strong>{club.name}</strong> and everything in
                  it. There is no undo. Type the club name to confirm.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={club.name}
                  className="border-2 border-black bg-paper text-black p-3 font-ui text-[15px] focus:outline-none focus:border-red-600"
                />
                {deleteError && (
                  <p className="font-mono text-[11px] text-red-600 uppercase tracking-widest">{deleteError}</p>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => { setDeleteModalOpen(false); setDeleteError(""); setDeleteConfirmText(""); }}
                    className="font-ui text-12 font-bold border-2 border-black px-4 py-2 uppercase hover:bg-black hover:text-paper transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting || deleteConfirmText.trim() !== club.name}
                    className="font-ui text-12 font-bold border-2 border-red-600 bg-red-600 text-paper px-4 py-2 uppercase hover:bg-paper hover:text-red-600 transition-colors disabled:opacity-40"
                  >
                    {deleting ? "Deleting..." : "Delete Forever"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
