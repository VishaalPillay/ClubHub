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
import FlowSheet from "@/features/flow/FlowSheet";
import FlowShell from "@/features/flow/FlowShell";
import FlowSpread, { FlowIndex } from "@/features/flow/FlowSpread";
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
 *
 * ── The flow does not scroll ────────────────────────────────────────────────
 * Every step is laid out inside one sheet of a fixed size — `FlowShell fill` →
 * `.flow-stage` → `FlowSheet fill` → `FlowSpread` — so the paper holds still and
 * only what is written on it changes. Before this, the page was as tall as its
 * tallest step: "Continue" sat below the fold on a laptop, and the sheet jumped
 * size between steps because each one summed to a different height.
 *
 * The cost is a real constraint on this file: a step has to FIT. Type and rhythm
 * are `vh`-relative clamps in `collage.css` and shrink with the window, but a
 * step that adds another block of controls has to give one up.
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
  "font-ui text-[14px] font-bold text-black bg-paper border-2 border-black py-2.5 px-6 uppercase " +
  "tracking-[0.5px] hover:bg-black hover:text-paper transition-colors flex items-center gap-1.5";
const btnSolid =
  "font-ui text-[14px] font-bold text-paper bg-black border-2 border-black py-2.5 px-6 uppercase " +
  "tracking-[0.5px] hover:bg-paper hover:text-black transition-colors flex items-center gap-1.5 " +
  "disabled:opacity-40 disabled:cursor-not-allowed";
const labelClass = "font-mono text-[11px] font-bold uppercase tracking-[2px] text-black";
const fieldClass =
  "w-full border-2 border-black bg-paper rounded-none px-4 py-3 font-ui text-[15px] text-black " +
  "placeholder:text-disabled-gray focus:outline-none focus:border-link-blue transition-colors";

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
      <FlowShell fill logoHref="/portal" right={<UserAvatarBadge />}>
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

  const continueTo = (onClick: () => void, disabled = false) => (
    <button type="button" disabled={disabled} onClick={onClick} className={btnSolid}>
      Continue
      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
    </button>
  );

  const index = <FlowIndex labels={STEP_LABELS} current={step} />;

  return (
    <FlowShell fill logoHref="/portal" right={<UserAvatarBadge />}>
      <div className="flow-stage">
        <StepDeck stepKey={step} direction={direction} className="h-full">
          <FlowSheet fill>
            <Folio step={step} total={5} label={STEP_LABELS[step - 1]} className="flow-folio" />

            {/* ─── STEP 1: Intent ─── */}
            {step === 1 && (
              <FlowSpread
                eyebrow="Organization Configuration"
                title={
                  clubs.length === 0 ? (
                    <>
                      Your First Club!
                      <br />
                      Let&apos;s get started.
                    </>
                  ) : (
                    <>
                      New Club,
                      <br />
                      Let&apos;s get started.
                    </>
                  )
                }
                rail={index}
                error={error}
                footer={
                  <>
                    <button type="button" onClick={() => router.back()} className={btnGhost}>
                      <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                      Back
                    </button>
                    {continueTo(() => {
                      if (intent === "join") router.push("/onboarding/join-flow");
                      else if (intent === "create") go(2);
                    }, !intent)}
                  </>
                }
              >
                <div className="grid grid-cols-2 gap-4">
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
                        className={`flex h-full flex-col items-start p-5 border-2 bg-paper text-left transition-colors hover:bg-paper-hover group relative ${
                          on ? "border-link-blue" : "border-black"
                        }`}
                      >
                        {on && (
                          <span
                            className="material-symbols-outlined text-link-blue absolute top-3.5 right-3.5 text-[18px]"
                            style={{ fontVariationSettings: '"FILL" 1' }}
                          >
                            check_circle
                          </span>
                        )}
                        <span
                          className={`material-symbols-outlined text-[28px] mb-3 ${
                            on ? "text-link-blue" : "text-black"
                          }`}
                        >
                          {card.icon}
                        </span>
                        <h2
                          className={`font-ui text-[16px] font-bold leading-[1.20] tracking-[-0.28px] mb-1 group-hover:underline ${
                            on ? "text-link-blue" : "text-black"
                          }`}
                        >
                          {card.title}
                        </h2>
                        <p className="font-body text-[13.5px] leading-[1.4] text-caption-gray">
                          {card.body}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </FlowSpread>
            )}

            {/* ─── STEP 2: Club details ─── */}
            {step === 2 && (
              <FlowSpread
                title="Name your Club-Space."
                lead="Establish the typographic identity of your organization."
                rail={index}
                error={error}
                footer={
                  <>
                    {backTo(1)}
                    {/* `form=` rather than nesting the footer inside the <form>:
                        the footer belongs to the spread's pane, not to the step's
                        controls, and this keeps Enter-to-submit working from the
                        field without the two fighting over the layout. */}
                    <button
                      type="submit"
                      form="club-details"
                      disabled={!form.name || !form.institution}
                      className={btnSolid}
                    >
                      Continue
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  </>
                }
              >
                <form
                  id="club-details"
                  className="flex flex-col gap-[clamp(16px,2.6vh,28px)] max-w-[560px]"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!form.name || !form.institution) return;
                    localStorage.setItem(K.name, form.name);
                    localStorage.setItem(K.institution, form.institution);
                    go(3);
                  }}
                >
                  <div className="flex flex-col gap-2">
                    <label className={labelClass} htmlFor="club-name">
                      Full Club Name
                    </label>
                    <input
                      id="club-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. The Architecture League"
                      className={fieldClass}
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
                      labelClassName={labelClass}
                      inputClassName="w-full border-2 border-caption-gray bg-paper-hover rounded-none px-4 py-3 font-ui text-[15px] text-caption-gray cursor-not-allowed"
                    />
                    <p className="font-ui text-[13px] text-caption-gray">
                      Matches your profile — update it from your profile menu, not here.
                    </p>
                  </div>
                </form>
              </FlowSpread>
            )}

            {/* ─── STEP 3: Domains ─── */}
            {step === 3 && (
              <FlowSpread
                title="Define your Domains"
                lead="What departments make up your club?"
                rail={index}
                error={error}
                footer={
                  <>
                    {backTo(2)}
                    {continueTo(() => {
                      localStorage.setItem(K.domains, JSON.stringify(domains));
                      go(4);
                    })}
                  </>
                }
              >
                <div className="flex flex-col gap-[clamp(16px,2.4vh,26px)]">
                  <form onSubmit={addDomain} className="flex gap-3 w-full max-w-[620px]">
                    <input
                      type="text"
                      value={domainDraft}
                      onChange={(e) => setDomainDraft(e.target.value)}
                      placeholder="e.g. Marketing, Finance, Logistics"
                      aria-label="New domain"
                      className={`${fieldClass} flex-1`}
                    />
                    <button
                      type="submit"
                      className="bg-paper border-2 border-black text-black font-ui text-[14px] font-bold px-6 uppercase tracking-[0.5px] hover:bg-black hover:text-paper transition-colors whitespace-nowrap"
                    >
                      Add Domain
                    </button>
                  </form>

                  <div className="border-t border-hairline-tint pt-[clamp(14px,2vh,22px)]">
                    <h3 className="font-mono text-[11px] text-caption-gray uppercase tracking-[2px] mb-3">
                      Active Domains
                    </h3>
                    <div className="flex flex-wrap gap-2.5">
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
                </div>
              </FlowSpread>
            )}

            {/* ─── STEP 4: Roles ─── */}
            {step === 4 && (
              <FlowSpread
                title="Establish your Hierarchy"
                lead="Select the structural roles necessary for your organization's operational density."
                rail={index}
                error={error}
                footer={
                  <>
                    {backTo(3)}
                    <button
                      type="button"
                      onClick={handleFinish}
                      disabled={creating}
                      className={btnSolid}
                    >
                      {creating ? "Creating..." : "Finish"}
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  </>
                }
              >
                {/* One flat grid filled column-major, rather than two hand-split
                    columns: the old pair held four rows and three, so the second
                    column ended in a hole that made the block look unfinished. */}
                <div className="grid grid-cols-2 grid-rows-4 grid-flow-col gap-2.5">
                  {(
                    [
                      { key: "president" as const, label: "President" },
                      { key: "secretary" as const, label: "Secretary" },
                      { key: "lead" as const, label: "Lead" },
                      { key: "member" as const, label: "Member" },
                      { key: "vicePresident" as const, label: "Vice President" },
                      { key: "jointSecretary" as const, label: "Joint Secretary" },
                      { key: "associateLead" as const, label: "Associate Lead" },
                    ] as const
                  ).map((r) => {
                    const locked = LOCKED_ROLES.includes(r.key);
                    const on = roles[r.key];
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => toggleRole(r.key)}
                        disabled={locked}
                        aria-pressed={on}
                        title={
                          locked ? `${r.label} is always included and cannot be removed.` : undefined
                        }
                        className={`w-full text-left px-4 py-3 flex items-center justify-between group transition-colors ${
                          on
                            ? "bg-black text-paper border-2 border-link-blue"
                            : "bg-paper text-black border-2 border-black hover:bg-black hover:text-paper"
                        } ${locked ? "cursor-default" : ""}`}
                      >
                        <span className="font-ui text-[15px] font-bold">{r.label}</span>
                        <span
                          className={`material-symbols-outlined text-[20px] ${
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
              </FlowSpread>
            )}

            {/* ─── STEP 5: Launch ─── */}
            {step === 5 && (
              <FlowSpread
                title="Your Club-Space is Ready!"
                lead="The foundation is set. It's time to populate your new editorial environment. Invite your first members or step directly into the command center."
                rail={index}
                footer={
                  <>
                    {/* Holds the left half of the footer open so "Enter Dashboard"
                        lands exactly where every other step's Continue did. */}
                    <span aria-hidden />
                    <button
                      type="button"
                      onClick={enterDashboard}
                      className="bg-link-blue border-2 border-link-blue text-paper font-ui text-[14px] font-bold uppercase tracking-[0.5px] px-8 py-2.5 hover:bg-paper hover:text-link-blue transition-colors flex items-center gap-2"
                    >
                      Enter Dashboard
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  </>
                }
              >
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12, duration: 0.4, ease: [0.16, 0.84, 0.32, 1] }}
                  className="border-2 border-black bg-paper p-[clamp(20px,3vh,32px)] max-w-[620px]"
                >
                  <h2 className="font-ui text-[18px] font-bold leading-[1.20] tracking-[-0.28px] text-black mb-1.5 uppercase">
                    Invite Code
                  </h2>
                  <p className="font-body text-[15px] leading-[1.45] text-caption-gray mb-5">
                    Share this code with your members — they can join from the portal using
                    &quot;Join a Club&quot;.
                  </p>
                  <div className="flex items-stretch border-2 border-black">
                    <input
                      aria-label="Invite Code"
                      readOnly
                      type="text"
                      value={created?.code ?? ""}
                      className="w-full border-0 font-mono text-[13px] tracking-[1.1px] text-black font-bold bg-paper-hover px-4 py-3 focus:outline-none"
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
              </FlowSpread>
            )}
          </FlowSheet>
        </StepDeck>
      </div>
    </FlowShell>
  );
}
