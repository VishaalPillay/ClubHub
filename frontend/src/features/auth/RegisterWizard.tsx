"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { GithubLogo, InstagramLogo, LinkedinLogo } from "@phosphor-icons/react";
import { register } from "@/lib/api/auth";
import { getProfile, updateProfile } from "@/lib/api/users";
import { refreshAccessToken } from "@/lib/api/client";
import { tokenStore } from "@/lib/auth/tokenStore";
import type { Profile, UpdateProfileIn } from "@/types/api";
import AvatarUpload from "@/features/auth/AvatarUpload";
import CountryStateSelect, { countryHasStates } from "@/features/auth/CountryStateSelect";
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

const STEP_LABELS = ["Account", "Location", "Portrait", "Socials"] as const;

/**
 * Four-step registration wizard. Steps 1–2 are required; 3–4 are skippable.
 *
 * 1. Account — email/password sign-up or Google. Once a session exists the step
 *    becomes "confirm mode": the name (Google's claim included) is shown for the
 *    user to check/edit, and the email is locked.
 * 2. Location & college — required; saving these flips the server-side
 *    `profile_completed` latch that the (app) shell gates on.
 * 3. Portrait — optional, with a pan/zoom crop dialog.
 * 4. Socials — optional GitHub/LinkedIn/Instagram links.
 *
 * On mount it restores any half-finished registration: silent refresh FIRST
 * (never a cold getProfile — the axios interceptor would hard-redirect signed-out
 * visitors to /login), then resume with prefills, or bounce completed users to
 * /portal.
 */
export default function RegisterWizard() {
  const router = useRouter();

  const [phase, setPhase] = useState<"checking" | "ready">("checking");
  // "fresh" = no account yet (show Google + password form); "confirm" = a session
  // exists, step 1 shows the editable name + locked email.
  const [mode, setMode] = useState<"fresh" | "confirm">("fresh");
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 — account
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState(""); // server-persisted name, to detect edits
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Steps 2–4 — profile
  const [location, setLocation] = useState({ country: "", state: "" });
  const [institution, setInstitution] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const applyProfile = useCallback((p: Profile) => {
    setSavedName(p.name);
    setName(p.name);
    setEmail(p.email);
    setLocation({ country: p.country ?? "", state: p.state ?? "" });
    setInstitution(p.institution ?? "");
    setAvatarUrl(p.avatar_url);
    setGithub(p.github_url ?? "");
    setLinkedin(p.linkedin_url ?? "");
    setInstagram(p.instagram_url ?? "");
    setMode("confirm");
  }, []);

  // Session restore: resume a half-finished registration, or send completed
  // accounts to the portal. Signed-out visitors just get the fresh wizard.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = tokenStore.get() ?? (await refreshAccessToken());
      if (!token) {
        if (!cancelled) setPhase("ready");
        return;
      }
      try {
        const profile = await getProfile();
        if (cancelled) return;
        if (profile.profile_completed) {
          router.replace("/portal");
          return;
        }
        applyProfile(profile);
      } catch {
        // Token turned out to be dead — fall through to the fresh wizard.
      }
      if (!cancelled) setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [router, applyProfile]);

  const goTo = (s: 1 | 2 | 3 | 4) => {
    setError("");
    setStep(s);
  };

  // Step 1 (fresh): create the account, then continue in confirm mode.
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const trimmed = name.trim();
      await register(trimmed, email, password);
      setSavedName(trimmed);
      setMode("confirm");
      setStep(2);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  // Step 1 (confirm): persist the (possibly edited) name, then continue.
  const handleConfirmName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter your name.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (trimmed !== savedName) {
        await updateProfile({ name: trimmed });
        setSavedName(trimmed);
      }
      setStep(2);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save your name.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: required details — saving these completes registration server-side.
  const needsState = countryHasStates(location.country);
  const detailsValid =
    !!location.country && !!institution.trim() && (!needsState || !!location.state);

  const handleDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailsValid) return;
    setError("");
    setLoading(true);
    try {
      const changes: UpdateProfileIn = {
        country: location.country,
        institution: institution.trim(),
      };
      if (location.state) changes.state = location.state;
      await updateProfile(changes);
      setStep(3);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save your details.");
    } finally {
      setLoading(false);
    }
  };

  // Step 4: optional socials, then into the app.
  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const changes: UpdateProfileIn = {};
      const gh = normalizeUrl(github);
      const li = normalizeUrl(linkedin);
      const ig = normalizeUrl(instagram);
      if (gh) changes.github_url = gh;
      if (li) changes.linkedin_url = li;
      if (ig) changes.instagram_url = ig;
      if (Object.keys(changes).length > 0) await updateProfile(changes);
      router.push("/portal?welcome=1"); // first-ever arrival — portal greets differently
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save your links.");
      setLoading(false);
    }
  };

  if (phase === "checking") {
    return (
      <div className="w-full max-w-xl border-2 border-black p-8 md:p-10 bg-white">
        <div className="font-mono text-[12px] uppercase tracking-widest text-[#757575] animate-pulse text-center py-16">
          Loading...
        </div>
      </div>
    );
  }

  const stepHeader = (eyebrow: string, title: string, sub?: string) => (
    <div className="mb-8 pb-6 border-b-2 border-black">
      <p className="font-mono text-[11px] uppercase tracking-widest text-[#757575] mb-3">
        {eyebrow}
      </p>
      <h1 className="font-display text-[42px] md:text-[48px] leading-[0.93] tracking-[-0.5px] font-bold uppercase">
        {title}
      </h1>
      {sub && <p className="font-body text-[15px] text-[#4c4546] mt-3 mb-0">{sub}</p>}
    </div>
  );

  const backButton = (to: 1 | 2 | 3) => (
    <button
      type="button"
      onClick={() => goTo(to)}
      className="font-ui text-[13px] font-bold border-2 border-black px-5 py-3 uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-1"
    >
      <span className="material-symbols-outlined text-[16px]">arrow_back</span>
      Back
    </button>
  );

  return (
    <div className="w-full max-w-xl border-2 border-black p-8 md:p-10 bg-white">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#757575]">
            Step {step} of 4 — {STEP_LABELS[step - 1]}
          </span>
          <span className="font-mono text-[10px] text-[#757575]">{step * 25}%</span>
        </div>
        <div className="w-full h-[2px] bg-[#e2e8f0] relative overflow-hidden">
          <motion.div
            className="absolute top-0 left-0 h-full bg-black"
            animate={{ width: `${step * 25}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {error && (
        <div className="border-2 border-red-600 bg-red-50 px-4 py-3 mb-6">
          <p className="font-mono text-[11px] text-red-600 uppercase tracking-widest">{error}</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={`${mode}-${step}`}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.2 }}
        >
          {/* ─── STEP 1: Account ─── */}
          {step === 1 && mode === "fresh" && (
            <>
              {stepHeader("Create Account", "Join the Network.")}
              <GoogleButton
                text="signup_with"
                onSuccess={async ({ profileCompleted }) => {
                  if (profileCompleted) {
                    router.push("/portal");
                    return;
                  }
                  try {
                    // New (or half-registered) Google account: show the claimed
                    // name for the user to check — never adopt it silently.
                    applyProfile(await getProfile());
                  } catch {
                    setError("Signed in, but your profile could not be loaded. Refresh to continue.");
                  }
                }}
                onError={setError}
              />
              <form onSubmit={handleCreateAccount} className="flex flex-col gap-5">
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
          )}

          {step === 1 && mode === "confirm" && (
            <>
              {stepHeader(
                "Confirm Account",
                "This is you.",
                "Check your name — it's how clubmates will see you."
              )}
              <form onSubmit={handleConfirmName} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label htmlFor="reg-name" className={labelClass}>Full Name</label>
                  <input
                    id="reg-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="reg-email" className={labelClass}>
                    Email Address <span className="text-[#b3b0ab] tracking-wider">— locked</span>
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    disabled
                    className={`${inputClass} disabled:opacity-60 disabled:bg-[#f3f3f3]`}
                  />
                </div>
                <div className="pt-4 border-t border-[#e2e8f0] mt-1">
                  <button
                    type="submit"
                    disabled={loading || !name.trim()}
                    className="w-full bg-black text-white border-2 border-black font-ui text-[15px] font-bold p-4 uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-40 flex justify-center items-center gap-2"
                  >
                    {loading ? "Please wait..." : "Continue"}
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ─── STEP 2: Location & College (required) ─── */}
          {step === 2 && (
            <>
              {stepHeader(
                "About You",
                "On the Record.",
                "Where you study, where you're from — this is how clubs find their people."
              )}
              <form onSubmit={handleDetails} className="flex flex-col gap-5">
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
                    required
                    placeholder="National Institute of Technology, Trichy"
                    className={inputClass}
                  />
                </div>
                <div className="pt-4 border-t border-[#e2e8f0] mt-1 flex justify-between items-center">
                  {backButton(1)}
                  <button
                    type="submit"
                    disabled={loading || !detailsValid}
                    className="bg-black text-white border-2 border-black font-ui text-[14px] font-bold px-8 py-3 uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-40 flex items-center gap-2"
                  >
                    {loading ? "Saving..." : "Continue"}
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ─── STEP 3: Portrait (skippable) ─── */}
          {step === 3 && (
            <>
              {stepHeader(
                "Portrait",
                "Put a face to it.",
                "Pick a photo and frame it however you like — or come back to this later."
              )}
              <AvatarUpload
                initials={initialsOf(name) || "?"}
                avatarUrl={avatarUrl}
                onUploaded={setAvatarUrl}
              />
              <div className="pt-6 border-t border-[#e2e8f0] mt-6 flex justify-between items-center">
                {backButton(2)}
                <div className="flex items-center gap-4">
                  {!avatarUrl && (
                    <button
                      type="button"
                      onClick={() => goTo(4)}
                      className="font-mono text-[10.5px] uppercase tracking-widest text-[#757575] underline hover:text-black bg-transparent border-0 cursor-pointer"
                    >
                      Skip
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => goTo(4)}
                    className="bg-black text-white border-2 border-black font-ui text-[14px] font-bold px-8 py-3 uppercase hover:bg-white hover:text-black transition-colors flex items-center gap-2"
                  >
                    Continue
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ─── STEP 4: Socials (skippable) ─── */}
          {step === 4 && (
            <>
              {stepHeader(
                "Social Links",
                "Stay Connected.",
                "Link your profiles so clubmates can find your work — optional."
              )}
              <form onSubmit={handleFinish} className="flex flex-col gap-5">
                <div className="flex flex-col gap-4">
                  {(
                    [
                      [GithubLogo, "GitHub", github, setGithub, "github.com/you"],
                      [LinkedinLogo, "LinkedIn", linkedin, setLinkedin, "linkedin.com/in/you"],
                      [InstagramLogo, "Instagram", instagram, setInstagram, "instagram.com/you"],
                    ] as const
                  ).map(([Icon, label, value, set, ph]) => (
                    <div key={label} className="flex items-center gap-3">
                      <span
                        className="w-9 h-9 border-2 border-black flex items-center justify-center flex-none"
                        title={label}
                      >
                        <Icon size={18} weight="fill" aria-hidden />
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
                <div className="pt-4 border-t border-[#e2e8f0] mt-1 flex justify-between items-center">
                  {backButton(3)}
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-black text-white border-2 border-black font-ui text-[14px] font-bold px-8 py-3 uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-40 flex items-center gap-2"
                  >
                    {loading ? "Please wait..." : "Enter Club-Hub"}
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
