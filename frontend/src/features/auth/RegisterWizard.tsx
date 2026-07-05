"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { register } from "@/lib/api/auth";
import { updateProfile } from "@/lib/api/users";
import type { UpdateProfileIn } from "@/types/api";
import AvatarUpload from "@/features/auth/AvatarUpload";
import CountryStateSelect from "@/features/auth/CountryStateSelect";
import GoogleButton from "@/features/auth/GoogleButton";

const inputClass =
  "border-2 border-black bg-white text-black p-3 font-ui text-[15px] w-full rounded-none " +
  "focus:outline-none focus:border-[#057DBC]";
const labelClass = "font-mono text-[11px] uppercase tracking-widest text-[#757575]";

/** Prepend https:// to bare domains so pasted handles pass the API's URL validation. */
function normalizeUrl(value: string): string | undefined {
  const v = value.trim();
  if (!v) return undefined;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function StepLine({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      <span className="w-3.5 h-3.5 border-2 border-black bg-black flex-none" />
      <span className={`h-0.5 w-12 ${step === 2 ? "bg-black" : "bg-[#e2e8f0]"}`} />
      <span
        className={`w-3.5 h-3.5 border-2 border-black flex-none ${step === 2 ? "bg-black" : "bg-white"}`}
      />
      <span className="font-mono text-[10px] uppercase tracking-widest text-[#757575] ml-3.5">
        Step {step} of 2 — {step === 1 ? "Account" : "Profile"}
      </span>
    </div>
  );
}

/**
 * Two-step registration. Step 1 creates the account (Google or email/password) and
 * signs the user in; step 2 collects the optional profile (country/state, college,
 * portrait, socials) via PUT /users/me. Both finishing and skipping land on /portal —
 * the club-creation wizard is a portal choice now, never a forced march.
 */
export default function RegisterWizard({ initialStep = 1 }: { initialStep?: 1 | 2 }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(initialStep);

  // Step 1 — account
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2 — profile
  const [location, setLocation] = useState({ country: "", state: "" });
  const [institution, setInstitution] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, email, password);
      setStep(2);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const changes: UpdateProfileIn = {};
      if (location.country) changes.country = location.country;
      if (location.state) changes.state = location.state;
      if (institution.trim()) changes.institution = institution.trim();
      const gh = normalizeUrl(github);
      const li = normalizeUrl(linkedin);
      const ig = normalizeUrl(instagram);
      if (gh) changes.github_url = gh;
      if (li) changes.linkedin_url = li;
      if (ig) changes.instagram_url = ig;
      if (Object.keys(changes).length > 0) await updateProfile(changes);
      router.push("/portal");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save your profile.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl border-2 border-black p-8 md:p-10 bg-white">
      <StepLine step={step} />

      <div className="mb-8 pb-6 border-b-2 border-black">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[#757575] mb-3">
          {step === 1 ? "Create Account" : "About You"}
        </p>
        <h1 className="font-display text-[42px] md:text-[48px] leading-[0.93] tracking-[-0.5px] font-bold uppercase">
          {step === 1 ? "Join the Network." : "On the Record."}
        </h1>
        {step === 2 && (
          <p className="font-body text-[15px] text-[#4c4546] mt-3 mb-0">
            Where you study, where you&rsquo;re from. Everything here can wait — skip and
            fill it in later from your profile.
          </p>
        )}
      </div>

      {error && (
        <div className="border-2 border-red-600 bg-red-50 px-4 py-3 mb-6">
          <p className="font-mono text-[11px] text-red-600 uppercase tracking-widest">{error}</p>
        </div>
      )}

      {step === 1 ? (
        <>
          <GoogleButton
            text="signup_with"
            onSuccess={({ isNew }) => (isNew ? setStep(2) : router.push("/portal"))}
            onError={setError}
          />
          <form onSubmit={handleAccount} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="reg-name" className={labelClass}>Full Name</label>
              <input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Aarav Sharma"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="reg-email" className={labelClass}>Email Address</label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@university.edu"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="reg-password" className={labelClass}>Password</label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="••••••••"
                className={inputClass}
              />
              <span className="font-mono text-[10px] tracking-widest text-[#757575]">
                8+ CHARACTERS
              </span>
            </div>
            <div className="pt-4 border-t border-[#e2e8f0] mt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white border-2 border-black font-ui text-[15px] font-bold p-4 uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-40 flex justify-center items-center gap-2"
              >
                {loading ? "Please wait..." : "Create Account"}
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </form>
          <p className="font-mono text-[11px] text-[#757575] uppercase tracking-wider text-center mt-6">
            Already on Club-Hub?{" "}
            <Link href="/login" className="text-[#057DBC] underline">Sign in</Link>
          </p>
        </>
      ) : (
        <form onSubmit={handleProfile} className="flex flex-col gap-5">
          <CountryStateSelect
            country={location.country}
            state={location.state}
            onChange={setLocation}
          />
          <div className="flex flex-col gap-2">
            <label htmlFor="reg-college" className={labelClass}>Current College</label>
            <input
              id="reg-college"
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="National Institute of Technology, Trichy"
              className={inputClass}
            />
          </div>

          <AvatarUpload
            initials={initialsOf(name) || "?"}
            avatarUrl={avatarUrl}
            onUploaded={setAvatarUrl}
          />

          <div className="flex flex-col gap-3">
            <span className={labelClass}>
              Social Links <span className="text-[#b3b0ab] tracking-wider">— optional</span>
            </span>
            {(
              [
                ["GitHub", github, setGithub, "github.com/you"],
                ["LinkedIn", linkedin, setLinkedin, "linkedin.com/in/you"],
                ["Instagram", instagram, setInstagram, "instagram.com/you"],
              ] as const
            ).map(([label, value, set, ph]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider w-20 flex-none">
                  {label}
                </span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={ph}
                  aria-label={`${label} URL`}
                  className="flex-1 border-0 border-b-2 border-[#e2e8f0] bg-transparent p-2 font-ui text-[14px] focus:outline-none focus:border-[#057DBC] rounded-none"
                />
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-[#e2e8f0] mt-1 flex flex-col gap-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white border-2 border-black font-ui text-[15px] font-bold p-4 uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-40 flex justify-center items-center gap-2"
            >
              {loading ? "Please wait..." : "Enter Club-Hub"}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/portal")}
              className="font-mono text-[10.5px] uppercase tracking-widest text-[#757575] underline hover:text-black text-center bg-transparent border-0 cursor-pointer"
            >
              Skip for now — straight to the portal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
