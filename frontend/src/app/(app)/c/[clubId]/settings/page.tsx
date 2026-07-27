"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClub } from "@/features/club/ClubProvider";
import { getClub, updateClub } from "@/lib/api/clubs";
import { isVPPlus } from "@/lib/roles";
import type { ClubDetail, ClubVisibility } from "@/types/api";

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

  const [form, setForm] = useState({
    name: club.name,
    description: club.description ?? "",
    institution: club.institution ?? "",
    visibility: club.visibility,
    accepting_requests: club.accepting_requests,
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
      });
      queryClient.invalidateQueries({ queryKey: ["club", clubId, "detail"] });
      queryClient.invalidateQueries({ queryKey: ["my-clubs"] });
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
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
      <div className="border-2 border-black p-6 mb-8 flex items-center justify-between bg-[#f9f9f9]">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-[#757575] mb-1">
            Invite Code
          </div>
          <div className="font-display text-4xl font-bold tracking-tight">{club.code}</div>
        </div>
        <button
          onClick={copyCode}
          className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors"
        >
          {copied ? "Copied!" : "Copy Code"}
        </button>
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
            className="border-2 border-black bg-white text-black p-3 font-ui text-[15px] focus:outline-none focus:border-[#057DBC]"
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
            className="border-2 border-black bg-white text-black p-3 font-ui text-[15px] resize-none h-28 focus:outline-none focus:border-[#057DBC]"
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
            className="border-2 border-black bg-white text-black p-3 font-ui text-[15px] focus:outline-none focus:border-[#057DBC]"
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
                      ? "border-[#e2e8f0] opacity-50 cursor-not-allowed"
                      : selected
                        ? "border-[#057DBC] bg-[#f0f8ff] cursor-pointer"
                        : "border-black cursor-pointer hover:bg-[#f9f9f9]"
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
              ? "border-black hover:bg-[#f9f9f9]"
              : "border-[#757575] bg-[#f9f9f9]"
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

        <div className="flex gap-4 pt-4 border-t-2 border-black">
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="flex-1 bg-black text-white border-2 border-black font-ui text-[15px] font-bold p-4 uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-40"
          >
            {saving ? "Saving..." : justSaved ? "Saved!" : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/c/${clubId}/dashboard`)}
            className="flex-1 bg-white border-2 border-black text-black font-ui text-[15px] font-bold p-4 uppercase hover:bg-hairline-tint transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </form>
    </div>
  );
}
