"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useClubOptional } from "@/features/club/ClubProvider";
import { updateProfile } from "@/lib/api/users";
import { Avatar } from "@/components/ui/Avatar";
import AvatarUpload from "@/features/auth/AvatarUpload";
import CollegeSelect from "@/features/auth/CollegeSelect";
import CountryStateSelect from "@/features/auth/CountryStateSelect";
import { normalizeSocialUrl, type SocialPlatform } from "@/lib/socialLinks";

type FormState = {
  name: string;
  institution: string;
  country: string;
  state: string;
  github_url: string;
  linkedin_url: string;
  instagram_url: string;
};

type LinkField = "github_url" | "linkedin_url" | "instagram_url";

/** "" -> null so the backend clears the column; HttpUrl rejects empty strings. */
const orNull = (v: string): string | null => (v.trim() === "" ? null : v.trim());

export default function ProfileMenu() {
  const { user, setUser, signOut } = useAuth();
  const club = useClubOptional();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [touchedLinks, setTouchedLinks] = useState<Record<LinkField, boolean>>({
    github_url: false,
    linkedin_url: false,
    instagram_url: false,
  });

  const [form, setForm] = useState<FormState>(() => ({
    name: user.name,
    institution: user.institution ?? "",
    country: user.country ?? "",
    state: user.state ?? "",
    github_url: user.github_url ?? "",
    linkedin_url: user.linkedin_url ?? "",
    instagram_url: user.instagram_url ?? "",
  }));

  const openModal = () => {
    setForm({
      name: user.name,
      institution: user.institution ?? "",
      country: user.country ?? "",
      state: user.state ?? "",
      github_url: user.github_url ?? "",
      linkedin_url: user.linkedin_url ?? "",
      instagram_url: user.instagram_url ?? "",
    });
    setError("");
    setTouchedLinks({ github_url: false, linkedin_url: false, instagram_url: false });
    setIsOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const gh = normalizeSocialUrl("github", form.github_url);
    const li = normalizeSocialUrl("linkedin", form.linkedin_url);
    const ig = normalizeSocialUrl("instagram", form.instagram_url);
    if (gh.error || li.error || ig.error) {
      // Reveal per-field errors even for a link the user never blurred (e.g. left
      // as-is from a previous save) — the inline message on each box carries the
      // detail now, so there's nothing more to put in the generic banner.
      setTouchedLinks({ github_url: true, linkedin_url: true, instagram_url: true });
      return;
    }
    setSaving(true);
    try {
      // avatar_url is deliberately omitted — the portrait is managed by AvatarUpload,
      // which stores the image server-side the moment it's dropped.
      const updated = await updateProfile({
        name: form.name.trim(),
        institution: orNull(form.institution),
        country: orNull(form.country),
        state: orNull(form.state),
        github_url: gh.url ?? null,
        linkedin_url: li.url ?? null,
        instagram_url: ig.url ?? null,
      });
      setUser(updated);
      setIsOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  // type="text" (not "url") deliberately — a native "Please enter a URL" tooltip
  // can't be styled or scoped to just this field, so validation is entirely custom
  // here: normalizeSocialUrl runs live, but the red/blue border only shows once the
  // field's been touched (blurred, or a submit attempt), so it isn't red before the
  // user has even started typing.
  const urlField = (name: LinkField, platform: SocialPlatform, label: string, placeholder: string) => {
    const { url, error: linkError } = normalizeSocialUrl(platform, form[name]);
    const touched = touchedLinks[name];
    const isInvalid = touched && !!linkError;
    const isValid = touched && !!url;
    const borderClass = isInvalid
      ? "border-red-600 focus:border-red-600"
      : isValid
        ? "border-[#057DBC] focus:border-[#057DBC]"
        : "border-black focus:border-black";
    return (
      <div className="flex flex-col gap-2">
        <label className="font-ui text-16 font-bold text-black uppercase" htmlFor={name}>
          {label}
        </label>
        <input
          className={`border-2 ${borderClass} bg-paper text-black p-3 font-ui text-16 focus:outline-none focus:ring-0 rounded-none`}
          id={name}
          name={name}
          value={form[name]}
          onChange={handleChange}
          onBlur={() => setTouchedLinks((prev) => ({ ...prev, [name]: true }))}
          placeholder={placeholder}
          type="text"
          aria-invalid={isInvalid}
        />
        {isInvalid && (
          <p className="font-mono text-[11px] text-red-600">{linkError}</p>
        )}
      </div>
    );
  };

  return (
    <>
      <div
        className="flex items-center gap-3 font-ui text-16 cursor-pointer hover:text-link-blue transition-150"
        onClick={openModal}
      >
        <span className="font-bold uppercase tracking-wide">
          {user.name.split(" ")[0]}
          {club ? ` (${club.currentRole.replace(/_/g, " ")})` : ""}
        </span>
        <div className="w-10 h-10 rounded-full border-2 border-black overflow-hidden bg-hairline-tint hover:border-link-blue transition-150">
          <Avatar name={user.name} avatarUrl={user.avatar_url} className="text-sm" />
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink bg-opacity-50 p-4">
          <div className="bg-paper border-2 border-black w-full max-w-form p-6 md:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
              <div>
                <div className="font-mono text-12 font-bold tracking-widest text-black mb-2 uppercase">
                  User Settings
                </div>
                <h2 className="font-display text-36 font-normal uppercase text-black m-0 leading-none">
                  Edit Profile
                </h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 border-2 border-black flex items-center justify-center hover:bg-black hover:text-paper transition-150 rounded-none bg-paper text-black"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            {error && (
              <div className="border-2 border-red-600 bg-red-50 px-4 py-3 mb-6">
                <p className="font-mono text-[11px] text-red-600 uppercase tracking-widest">
                  {error}
                </p>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              <div className="pb-6 border-b-2 border-black">
                <AvatarUpload
                  initials={(form.name || "?")
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0]!.toUpperCase())
                    .join("")}
                  avatarUrl={user.avatar_url}
                  onUploaded={(url) => setUser({ ...user, avatar_url: url })}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-ui text-16 font-bold text-black uppercase" htmlFor="name">
                  Full Name
                </label>
                <input
                  className="border-2 border-black bg-paper text-black p-3 font-ui text-16 focus:outline-none focus:ring-0 focus:border-black rounded-none"
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  type="text"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-ui text-16 font-bold text-black uppercase">Email</label>
                <input
                  className="border-2 border-[#757575] bg-[#eee0cb] text-[#757575] p-3 font-ui text-16 rounded-none cursor-not-allowed"
                  value={user.email}
                  type="email"
                  disabled
                />
              </div>

              <CountryStateSelect
                country={form.country}
                state={form.state}
                onChange={({ country, state }) =>
                  setForm((prev) => ({ ...prev, country, state }))
                }
              />

              <CollegeSelect
                id="institution"
                country={form.country}
                state={form.state}
                value={form.institution}
                onChange={(institution) => setForm((prev) => ({ ...prev, institution }))}
                label="Institution"
                labelClassName="font-ui text-16 font-bold text-black uppercase"
                inputClassName="border-2 border-black bg-paper text-black p-3 font-ui text-16 focus:outline-none focus:ring-0 focus:border-black rounded-none"
              />

              {urlField("github_url", "github", "GitHub URL", "https://github.com/you")}
              {urlField("linkedin_url", "linkedin", "LinkedIn URL", "https://linkedin.com/in/you")}
              {urlField("instagram_url", "instagram", "Instagram URL", "https://instagram.com/you")}

              <div className="pt-6 border-t-2 border-black mt-8 flex gap-4">
                <button
                  type="submit"
                  disabled={saving || !form.name.trim()}
                  className="flex-1 bg-paper border-2 border-black text-black font-ui text-16 font-bold p-4 uppercase hover:bg-black hover:text-paper transition-150 rounded-none text-center disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 bg-paper border-2 border-black text-black font-ui text-16 font-bold p-4 uppercase hover:bg-hairline-tint transition-150 rounded-none text-center"
                >
                  Cancel
                </button>
              </div>

              <button
                type="button"
                onClick={signOut}
                className="w-full bg-paper border-2 border-red-600 text-red-600 font-ui text-14 font-bold p-3 uppercase hover:bg-red-600 hover:text-paper transition-150 rounded-none text-center"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
