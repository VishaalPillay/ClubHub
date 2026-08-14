"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { createClub, myClubs } from "@/lib/api/clubs";
import { createDomain } from "@/lib/api/domains";
import { useAuth } from "@/lib/auth/AuthProvider";
import CollegeSelect from "@/features/auth/CollegeSelect";
import UserAvatarBadge from "@/features/auth/UserAvatarBadge";
import FlowShell from "@/features/flow/FlowShell";
import Folio from "@/features/flow/Folio";
import StepDeck, { useFlowStep } from "@/features/flow/StepDeck";

/**
 * Club creation, as one route.
 *
 * This used to be five separate routes (`/onboarding/step-1` … `step-5`) that
 * each rebuilt the masthead and footer by hand, carried their own faked progress
 * bar, and handed state to the next step through localStorage. Because a route
 * change tears the outgoing page down immediately, there was no way to animate
 * between them — every "Continue" read as a page load. Collapsing them into one
 * client wizard is what makes the transition in `StepDeck` possible, and it
 * matches the register wizard, which was already built this way.
 *
 * localStorage survives, but its job changed: it is no longer how steps talk to
 * each other (that's React state now) — it is only how a *refresh* is survived,
 * and how a created club is remembered.
 *
 * That second part is load-bearing. `onboarding_club_id` is the guard against
 * POSTing /clubs twice with the same payload: once a club exists, the wizard
 * resumes at Launch instead of offering FINISH again. It is cleared only by
 * "Enter Dashboard" on the last step, so that a later "Create New Club" starts
 * clean and this club's id can't trip the guard for that next, unrelated club.
 */

const STEP_LABELS = ["Intent", "Club Details", "Domains", "Roles", "Launch"] as const;
type Step = 1 | 2 | 3 | 4 | 5;

const K = {
  name: "onboarding_club_name",
  institution: "onboarding_club_institution",
  domains: "onboarding_club_domains",
  code: "onboarding_club_code",
  id: "onboarding_club_id",
} as const;

const btnGhost =
  "font-ui text-[15px] font-bold text-black bg-paper border-2 border-black py-2 px-6 uppercase " +
  "hover:bg-black hover:text-paper transition-colors flex items-center gap-1";
const btnSolid =
  "font-ui text-[15px] font-bold text-paper bg-black border-2 border-black py-2 px-6 uppercase " +
  "hover:bg-paper hover:text-black transition-colors flex items-center gap-1 " +
  "disabled:opacity-40 disabled:cursor-not-allowed";
const h1Class =
  "font-display text-[40px] md:text-[64px] leading-[1.05] tracking-[-0.5px] text-black";
const leadClass = "font-body text-[19px] leading-[1.47] text-caption-gray";

export default function CreateClubWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { step, direction, go, jump } = useFlowStep<Step>(1);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [intent, setIntent] = useState<"" | "join" | "create">("");
  const { data: clubs = [], isPending: clubsLoading } = useQuery({
    queryKey: ["my-clubs"],
    queryFn: myClubs,
  });

  // Step 2 — the club's institution is always the creator's own: it's what
  // "My College Only" visibility matches against later (see the settings page),
  // so it can't be a freely-typed value that drifts from the profile it represents.
  const [form, setForm] = useState({ name: "", institution: "" });

  // Step 3
  const [domainDraft, setDomainDraft] = useState("");
  const [domains, setDomains] = useState<string[]>(["Technical", "Management", "Creative"]);

  // Step 4
  const [roles, setRoles] = useState({
    president: true,
    secretary: false,
    lead: false,
    member: true,
    vicePresident: false,
    jointSecretary: false,
    associateLead: false,
  });
  const [creating, setCreating] = useState(false);

  // Step 5
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Resume a half-finished (or already-completed) run. Read in a callback rather
  // than in the effect body — the same idiom the old step pages used — so the
  // server markup and the first client render agree, and so the restore doesn't
  // cascade a second render pass out of the effect.
  useEffect(() => {
    const t = setTimeout(() => {
      const createdId = localStorage.getItem(K.id);
      if (createdId) {
        setCreated({ id: createdId, code: localStorage.getItem(K.code) ?? "" });
        jump(5);
      } else {
        setForm({
          name: localStorage.getItem(K.name) ?? "",
          institution: localStorage.getItem(K.institution) ?? user.institution ?? "",
        });
        const storedDomains = localStorage.getItem(K.domains);
        if (storedDomains) {
          try {
            const parsed: unknown = JSON.parse(storedDomains);
            if (Array.isArray(parsed)) {
              setDomains(parsed.filter((d): d is string => typeof d === "string"));
            }
          } catch {
            // Corrupt hand-off from an older session — keep the defaults.
          }
        }
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, [jump, user.institution]);

  const addDomain = (e: React.FormEvent) => {
    e.preventDefault();
    const d = domainDraft.trim();
    if (d && !domains.includes(d)) {
      setDomains([...domains, d]);
      setDomainDraft("");
    }
  };

  const LOCKED_ROLES: (keyof typeof roles)[] = ["president", "member"];
  const toggleRole = (role: keyof typeof roles) => {
    if (LOCKED_ROLES.includes(role)) return;
    setRoles((prev) => ({ ...prev, [role]: !prev[role] }));
  };

  const handleFinish = async () => {
    setCreating(true);
    setError("");
    try {
      const enabled_roles: string[] = [];
      if (roles.vicePresident) enabled_roles.push("vice_president");
      if (roles.secretary) enabled_roles.push("secretary");
      if (roles.jointSecretary) enabled_roles.push("joint_secretary");
      if (roles.lead) enabled_roles.push("lead");
      if (roles.associateLead) enabled_roles.push("associate");
      if (roles.member) enabled_roles.push("member");

      // Create the club (the caller becomes president), then its domains.
      const club = await createClub(
        form.name || "Untitled Club",
        null,
        enabled_roles,
        form.institution || null,
      );
      for (const d of domains) {
        await createDomain(club.id, d, "");
      }

      localStorage.setItem(K.code, club.code);
      localStorage.setItem(K.id, String(club.id));
      setCreated({ id: String(club.id), code: club.code });

      // The portal/club shell read memberships from this cache — step 1 already
      // populated it with the pre-creation (clubless) list, and the app's 60s
      // default staleTime means neither invalidateQueries (only refetches *active*
      // observers; nothing observes this key during onboarding) nor fetchQuery
      // (staleTime-gated — it'd just hand back that same stale cache entry) would
      // actually hit the network here. ClubProvider would then mount on the fresh
      // club's dashboard, see the still-clubless list, and bounce to /portal.
      // refetchQueries always performs a real fetch regardless of staleTime;
      // `type: "all"` includes this presently-unobserved query in that refetch.
      await queryClient.refetchQueries({ queryKey: ["my-clubs"], type: "all" });

      go(5);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create club.");
      setCreating(false);
    }
  };

  const enterDashboard = () => {
    // The wizard is genuinely done — clear the hand-off keys so a later "Create
    // New Club" starts clean and this club's id can't trip the already-created
    // guard for that next, unrelated club.
    Object.values(K).forEach((k) => localStorage.removeItem(k));
    router.push(created?.id ? `/c/${created.id}/dashboard` : "/portal");
  };

  if (!ready || clubsLoading) {
    return (
      <FlowShell right={<UserAvatarBadge />}>
        <div className="font-mono text-[13px] uppercase tracking-widest text-caption-gray animate-pulse">
          Loading...
        </div>
      </FlowShell>
    );
  }

  const backTo = (to: Step) => (
    <button type="button" onClick={() => go(to)} className={btnGhost}>
      <span className="material-symbols-outlined text-[18px]">arrow_back</span>
      Back
    </button>
  );

  return (
    <FlowShell right={<UserAvatarBadge />}>
      <div className="w-full max-w-5xl">
        <Folio step={step} total={5} label={STEP_LABELS[step - 1]} />

        {error && (
          <div className="border-2 border-error bg-[#fdf0f0] px-4 py-3 mb-6">
            <p className="font-mono text-[11px] text-error uppercase tracking-widest">{error}</p>
          </div>
        )}

        <StepDeck stepKey={step} direction={direction}>
          {/* ─── STEP 1: Intent ─── */}
          {step === 1 && (
            <div className="w-full">
              <header className="border-b border-black pb-8 mb-12">
                <p className="font-mono text-[13px] tracking-[1px] text-caption-gray mb-4 uppercase">
                  Organization Configuration
                </p>
                <h1 className={h1Class}>
                  {clubs.length === 0 ? (
                    <>Your First Club!<br />Let&apos;s get started.</>
                  ) : (
                    <>New Club,<br />Let&apos;s get started.</>
                  )}
                </h1>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                {(
                  [
                    {
                      id: "join" as const,
                      icon: "group_add",
                      title: "Join an Existing Club",
                      body: "Search the global directory to request access to an established organization within the network.",
                    },
                    {
                      id: "create" as const,
                      icon: "add_box",
                      title: "Create a Club Space",
                      body: "Initialize a brand new secure space for your organization, setting up rules, rosters, and identity.",
                    },
                  ]
                ).map((card) => {
                  const on = intent === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setIntent(card.id)}
                      aria-pressed={on}
                      className={`flex flex-col items-start p-8 border-2 bg-paper text-left transition-colors hover:bg-paper-hover group relative ${
                        on
                          ? "border-link-blue outline outline-2 outline-link-blue outline-offset-2"
                          : "border-black"
                      }`}
                    >
                      {on && (
                        <span
                          className="material-symbols-outlined text-link-blue absolute top-6 right-6"
                          style={{ fontVariationSettings: '"FILL" 1' }}
                        >
                          check_circle
                        </span>
                      )}
                      <span
                        className={`material-symbols-outlined text-[48px] mb-6 ${
                          on ? "text-link-blue" : "text-black"
                        }`}
                      >
                        {card.icon}
                      </span>
                      <h2
                        className={`font-ui text-[20px] font-bold leading-[1.20] tracking-[-0.28px] mb-2 group-hover:underline ${
                          on ? "text-link-blue" : "text-black"
                        }`}
                      >
                        {card.title}
                      </h2>
                      <p className="font-body text-[16px] leading-[1.50] text-caption-gray">
                        {card.body}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="w-full pt-6 border-t border-black flex justify-between items-center">
                <button type="button" onClick={() => router.back()} className={btnGhost}>
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  Back
                </button>
                <button
                  type="button"
                  disabled={!intent}
                  onClick={() => {
                    if (intent === "join") router.push("/onboarding/join-flow");
                    else if (intent === "create") go(2);
                  }}
                  className={btnSolid}
                >
                  Continue
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 2: Club details ─── */}
          {step === 2 && (
            <div className="w-full max-w-[720px] mx-auto">
              <section className="mb-8 border-b-2 border-black pb-4">
                <h1 className={`${h1Class} mb-2`}>Name your Club-Space.</h1>
                <p className={`${leadClass} max-w-[500px]`}>
                  Establish the typographic identity of your organization.
                </p>
              </section>

              <form
                className="flex flex-col gap-8"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!form.name || !form.institution) return;
                  localStorage.setItem(K.name, form.name);
                  localStorage.setItem(K.institution, form.institution);
                  go(3);
                }}
              >
                <div className="flex flex-col gap-2">
                  <label className="font-ui text-[16px] font-bold uppercase text-black" htmlFor="club-name">
                    Full Club Name
                  </label>
                  <input
                    id="club-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. The Architecture League"
                    className="w-full border-2 border-black bg-transparent rounded-none px-4 py-2 font-body text-[16px] text-black placeholder:text-disabled-gray focus:outline-none focus:border-link-blue transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <CollegeSelect
                    id="club-institution"
                    country={user.country ?? ""}
                    state={user.state ?? ""}
                    value={form.institution}
                    onChange={(institution) => setForm((prev) => ({ ...prev, institution }))}
                    disabled
                    label="College / Institution"
                    labelClassName="font-ui text-[16px] font-bold uppercase text-black"
                    inputClassName="w-full border-2 border-caption-gray bg-paper-hover rounded-none px-4 py-2 font-body text-[16px] text-caption-gray cursor-not-allowed"
                  />
                  <p className="font-ui text-[13px] text-caption-gray">
                    Matches your profile — update it from your profile menu, not here.
                  </p>
                </div>

                <div className="w-full mt-8 pt-6 border-t border-black flex justify-between items-center">
                  {backTo(1)}
                  <button type="submit" disabled={!form.name || !form.institution} className={btnSolid}>
                    Continue
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ─── STEP 3: Domains ─── */}
          {step === 3 && (
            <div className="w-full max-w-[600px] mx-auto">
              <div className="mb-8">
                <h1 className={`${h1Class} mb-2`}>Define your Domains</h1>
                <p className={`${leadClass} max-w-md`}>What departments make up your club?</p>
              </div>

              <form onSubmit={addDomain} className="flex flex-col sm:flex-row gap-4 mb-8 w-full">
                <input
                  type="text"
                  value={domainDraft}
                  onChange={(e) => setDomainDraft(e.target.value)}
                  placeholder="e.g. Marketing, Finance, Logistics"
                  aria-label="New domain"
                  className="flex-1 bg-paper border-2 border-black rounded-none px-4 py-3 font-ui text-[16px] font-bold text-black placeholder:text-caption-gray focus:outline-none focus:border-link-blue transition-colors"
                />
                <button
                  type="submit"
                  className="bg-paper border-2 border-black text-black font-ui text-[16px] font-bold px-8 py-3 uppercase hover:bg-black hover:text-paper transition-colors whitespace-nowrap"
                >
                  Add Domain
                </button>
              </form>

              <div className="border-t border-black pt-6">
                <h3 className="font-mono text-[13px] text-black uppercase mb-4">Active Domains</h3>
                <div className="flex flex-wrap gap-3">
                  {domains.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-2 border-2 border-black bg-paper px-3 py-1.5 hover:bg-paper-hover transition-colors"
                    >
                      <span className="font-mono text-[12px] text-black uppercase">{d}</span>
                      <button
                        type="button"
                        onClick={() => setDomains(domains.filter((x) => x !== d))}
                        aria-label={`Remove ${d}`}
                        className="text-caption-gray hover:text-black transition-colors flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="w-full mt-8 pt-6 border-t border-black flex justify-between items-center">
                {backTo(2)}
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem(K.domains, JSON.stringify(domains));
                    go(4);
                  }}
                  className={btnSolid}
                >
                  Continue
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 4: Roles ─── */}
          {step === 4 && (
            <div className="w-full max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h1 className={`${h1Class} mb-2`}>Establish your Hierarchy</h1>
                <p className={`${leadClass} max-w-2xl mx-auto`}>
                  Select the structural roles necessary for your organization&apos;s operational density.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 border-t border-black pt-6">
                {(
                  [
                    [
                      { key: "president" as const, label: "President" },
                      { key: "secretary" as const, label: "Secretary" },
                      { key: "lead" as const, label: "Lead" },
                      { key: "member" as const, label: "Member" },
                    ],
                    [
                      { key: "vicePresident" as const, label: "Vice President" },
                      { key: "jointSecretary" as const, label: "Joint Secretary" },
                      { key: "associateLead" as const, label: "Associate Lead" },
                    ],
                  ] as const
                ).map((column, ci) => (
                  <div key={ci} className="flex flex-col">
                    {column.map((r) => {
                      const locked = LOCKED_ROLES.includes(r.key);
                      const on = roles[r.key];
                      return (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => toggleRole(r.key)}
                          disabled={locked}
                          aria-pressed={on}
                          title={locked ? `${r.label} is always included and cannot be removed.` : undefined}
                          className={`w-full text-left p-4 flex items-center justify-between group transition-colors mb-2 ${
                            on
                              ? "bg-black text-paper border-2 border-link-blue"
                              : "bg-paper text-black border-2 border-black hover:bg-black hover:text-paper"
                          } ${locked ? "cursor-default" : ""}`}
                        >
                          <span className="font-ui text-[16px] font-bold">{r.label}</span>
                          <span
                            className={`material-symbols-outlined ${
                              on ? "text-link-blue" : "text-transparent group-hover:text-paper"
                            }`}
                            style={on ? { fontVariationSettings: "'FILL' 1" } : undefined}
                          >
                            {locked ? "lock" : on ? "check_circle" : "add"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="w-full mt-8 pt-6 border-t border-black flex justify-between items-center">
                {backTo(3)}
                <button type="button" onClick={handleFinish} disabled={creating} className={btnSolid}>
                  {creating ? "Creating..." : "Finish"}
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 5: Launch ─── */}
          {step === 5 && (
            <div className="w-full max-w-2xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.4, ease: [0.16, 0.84, 0.32, 1] }}
                className="mb-12 text-center"
              >
                <h1 className={`${h1Class} mb-6`}>Your Club-Space is Ready!</h1>
                <p className={`${leadClass} max-w-lg mx-auto`}>
                  The foundation is set. It&apos;s time to populate your new editorial environment.
                  Invite your first members or step directly into the command center.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.4, ease: [0.16, 0.84, 0.32, 1] }}
                className="border-2 border-black mb-12 bg-paper p-8"
              >
                <h2 className="font-ui text-[20px] font-bold leading-[1.20] tracking-[-0.28px] text-black mb-2 uppercase">
                  Invite Code
                </h2>
                <p className="font-body text-[16px] text-caption-gray mb-6">
                  Share this code with your members — they can join from the portal using
                  &quot;Join a Club&quot;.
                </p>
                <div className="flex items-stretch border-2 border-black">
                  <input
                    aria-label="Invite Code"
                    readOnly
                    type="text"
                    value={created?.code ?? ""}
                    className="w-full border-0 font-mono text-[12px] tracking-[1.1px] text-black font-bold bg-paper-hover px-4 py-3 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Copy invite code"
                    onClick={async () => {
                      if (!created?.code) return;
                      await navigator.clipboard.writeText(created.code);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="bg-paper border-l-2 border-black px-4 flex items-center justify-center hover:bg-black transition-colors group"
                  >
                    <span className="material-symbols-outlined text-black group-hover:text-paper">
                      {copied ? "check" : "content_copy"}
                    </span>
                  </button>
                </div>
              </motion.div>

              <div className="flex justify-center border-t border-hairline-tint pt-12">
                <button
                  type="button"
                  onClick={enterDashboard}
                  className="bg-link-blue border-2 border-link-blue text-paper font-ui text-[16px] font-bold uppercase px-12 py-4 hover:bg-paper hover:text-link-blue transition-colors flex items-center gap-2"
                >
                  Enter Dashboard
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </div>
          )}
        </StepDeck>
      </div>
    </FlowShell>
  );
}
