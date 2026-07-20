"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useClub } from "@/features/club/ClubProvider";
import { updateProfile } from "@/lib/api/users";
import AvatarUpload from "@/features/auth/AvatarUpload";
import CollegeSelect from "@/features/auth/CollegeSelect";
import CountryStateSelect from "@/features/auth/CountryStateSelect";

type FormState = {
  name: string;
  institution: string;
  country: string;
  state: string;
  age: string;
  github_url: string;
  linkedin_url: string;
  instagram_url: string;
};

/** "" -> null so the backend clears the column; HttpUrl rejects empty strings. */
const orNull = (v: string): string | null => (v.trim() === "" ? null : v.trim());

export default function ProfileMenu() {
  const { user, setUser, signOut } = useAuth();
  const { currentRole } = useClub();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<FormState>(() => ({
    name: user.name,
    institution: user.institution ?? "",
    country: user.country ?? "",
    state: user.state ?? "",
    age: user.age != null ? String(user.age) : "",
    github_url: user.github_url ?? "",
    linkedin_url: user.linkedin_url ?? "",
    instagram_url: user.instagram_url ?? "",
  }));

  const profilePic =
    user.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=000&color=fff&size=150`;

  const openModal = () => {
    setForm({
      name: user.name,
      institution: user.institution ?? "",
      country: user.country ?? "",
      state: user.state ?? "",
      age: user.age != null ? String(user.age) : "",
      github_url: user.github_url ?? "",
      linkedin_url: user.linkedin_url ?? "",
      instagram_url: user.instagram_url ?? "",
    });
    setError("");
    setIsOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      // avatar_url is deliberately omitted — the portrait is managed by AvatarUpload,
      // which stores the image server-side the moment it's dropped.
      const updated = await updateProfile({
        name: form.name.trim(),
        institution: orNull(form.institution),
        country: orNull(form.country),
        state: orNull(form.state),
        age: form.age.trim() === "" ? null : Number(form.age),
        github_url: orNull(form.github_url),
        linkedin_url: orNull(form.linkedin_url),
        instagram_url: orNull(form.instagram_url),
      });
      setUser(updated);
      setIsOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const urlField = (name: keyof FormState, label: string, placeholder: string) => (
    <div className="flex flex-col gap-2">
      <label className="font-ui text-16 font-bold text-black uppercase" htmlFor={name}>
        {label}
      </label>
      <input
        className="border-2 border-black bg-white text-black p-3 font-ui text-16 focus:outline-none focus:ring-0 focus:border-black rounded-none"
        id={name}
        name={name}
        value={form[name]}
        onChange={handleChange}
        placeholder={placeholder}
        type="url"
      />
    </div>
  );

  return (
    <>
      <div
        className="flex items-center gap-3 font-ui text-16 cursor-pointer hover:text-link-blue transition-150"
        onClick={openModal}
      >
        <span className="font-bold uppercase tracking-wide">
          {user.name.split(" ")[0]} ({currentRole.replace(/_/g, " ")})
        </span>
        <div className="w-10 h-10 border-2 border-black overflow-hidden bg-hairline-tint hover:border-link-blue transition-150">
          <img alt={user.name} className="w-full h-full object-cover grayscale" src={profilePic} />
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink bg-opacity-50 p-4">
          <div className="bg-white border-2 border-black w-full max-w-form p-6 md:p-8 max-h-[90vh] overflow-y-auto">
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
                className="w-10 h-10 border-2 border-black flex items-center justify-center hover:bg-black hover:text-white transition-150 rounded-none bg-white text-black"
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

              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 flex flex-col gap-2">
                  <label className="font-ui text-16 font-bold text-black uppercase" htmlFor="name">
                    Full Name
                  </label>
                  <input
                    className="border-2 border-black bg-white text-black p-3 font-ui text-16 focus:outline-none focus:ring-0 focus:border-black rounded-none"
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Enter full name"
                    type="text"
                    required
                  />
                </div>
                <div className="w-full md:w-32 flex flex-col gap-2">
                  <label className="font-ui text-16 font-bold text-black uppercase" htmlFor="age">
                    Age
                  </label>
                  <input
                    className="border-2 border-black bg-white text-black p-3 font-ui text-16 focus:outline-none focus:ring-0 focus:border-black rounded-none"
                    id="age"
                    name="age"
                    value={form.age}
                    onChange={handleChange}
                    placeholder="18"
                    type="number"
                    min={13}
                    max={120}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-ui text-16 font-bold text-black uppercase">Email</label>
                <input
                  className="border-2 border-[#757575] bg-[#f3f3f3] text-[#757575] p-3 font-ui text-16 rounded-none cursor-not-allowed"
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
                inputClassName="border-2 border-black bg-white text-black p-3 font-ui text-16 focus:outline-none focus:ring-0 focus:border-black rounded-none"
              />

              {urlField("github_url", "GitHub URL", "https://github.com/you")}
              {urlField("linkedin_url", "LinkedIn URL", "https://linkedin.com/in/you")}
              {urlField("instagram_url", "Instagram URL", "https://instagram.com/you")}

              <div className="pt-6 border-t-2 border-black mt-8 flex gap-4">
                <button
                  type="submit"
                  disabled={saving || !form.name.trim()}
                  className="flex-1 bg-white border-2 border-black text-black font-ui text-16 font-bold p-4 uppercase hover:bg-black hover:text-white transition-150 rounded-none text-center disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 bg-white border-2 border-black text-black font-ui text-16 font-bold p-4 uppercase hover:bg-hairline-tint transition-150 rounded-none text-center"
                >
                  Cancel
                </button>
              </div>

              <button
                type="button"
                onClick={signOut}
                className="w-full bg-white border-2 border-red-600 text-red-600 font-ui text-14 font-bold p-3 uppercase hover:bg-red-600 hover:text-white transition-150 rounded-none text-center"
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
