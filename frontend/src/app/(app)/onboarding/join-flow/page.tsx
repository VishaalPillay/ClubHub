"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { joinClub, lookupClub } from "@/lib/api/clubs";

type Domain = { id: number; name: string; description: string | null };

const ROLES = [
  { value: "vice_president",  label: "Vice President",   needsDomain: false },
  { value: "secretary",       label: "Secretary",         needsDomain: false },
  { value: "joint_secretary", label: "Joint Secretary",   needsDomain: false },
  { value: "lead",            label: "Lead",              needsDomain: true  },
  { value: "associate",       label: "Associate",         needsDomain: true  },
  { value: "member",          label: "Member",            needsDomain: true  },
];

export default function JoinFlowPage() {
  const router = useRouter();

  // Multi-step state
  const [step, setStep] = useState(1); // 1 = code, 2 = role/domain, 3 = confirm
  const [progress, setProgress] = useState(33);

  // Form state
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [clubName, setClubName] = useState("");
  const [clubId, setClubId] = useState<number | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [enabledRoles, setEnabledRoles] = useState<string[] | null>(null);

  const [selectedRole, setSelectedRole] = useState("");
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const goTo = (s: number) => {
    setStep(s);
    setProgress(s === 1 ? 33 : s === 2 ? 66 : 99);
  };

  // Step 1: Validate the club code
  const validateCode = async () => {
    if (code.trim().length < 4) {
      setCodeError("Please enter a valid club code.");
      return;
    }
    setLoading(true);
    setCodeError("");
    try {
      // Resolve the code -> club name + domains + enabled roles (preview before joining).
      const club = await lookupClub(code.trim().toUpperCase());
      setClubName(club.name);
      setClubId(club.id);
      setDomains(club.domains ?? []);
      setEnabledRoles(club.enabled_roles ?? null);
      goTo(2);
    } catch (e: unknown) {
      setCodeError(e instanceof Error ? e.message : "Club code not found.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Submit the join request
  const submitRequest = async () => {
    setLoading(true);
    try {
      await joinClub({
        club_code: code.trim().toUpperCase(),
        requested_role: selectedRole,
        requested_domain_id: selectedDomainId,
        message: message || null,
      });
      setSubmitted(true);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to submit request.");
    } finally {
      setLoading(false);
    }
  };

  const roleConfig = ROLES.find(r => r.value === selectedRole);

  if (submitted) {
    return (
      <div className="bg-white text-black min-h-screen flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full text-center"
        >
          <div className="w-16 h-16 bg-black flex items-center justify-center mx-auto mb-8">
            <span className="material-symbols-outlined text-white text-[32px]">
              check
            </span>
          </div>
          <p className="font-mono text-[12px] uppercase tracking-widest text-[#757575] mb-4">
            Request Submitted
          </p>
          <h1 className="font-display text-[48px] leading-[0.93] tracking-[-0.5px] font-bold text-black mb-6">
            You&apos;re in the queue.
          </h1>
          <p className="font-ui text-[16px] text-[#757575] mb-10 leading-relaxed">
            Your request to join <strong>{clubName}</strong> as{" "}
            <strong>{roleConfig?.label}</strong> has been sent. The club&apos;s
            leadership will review it shortly.
          </p>
          <button
            onClick={() => router.push("/portal")}
            className="font-ui text-[14px] font-bold border-2 border-black bg-black text-white px-8 py-3 uppercase hover:bg-white hover:text-black transition-colors w-full"
          >
            Go to My Clubs Portal
            <span className="material-symbols-outlined text-[16px] align-middle ml-2">
              arrow_forward
            </span>
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-white text-black min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center w-full px-6 py-4 bg-white border-b-2 border-black">
        <div className="font-display text-[28px] font-black uppercase tracking-tighter">
          CLUB-HUB
        </div>
        <Link
          href="/portal"
          className="font-mono text-[11px] uppercase tracking-widest text-[#757575] hover:text-[#057DBC] transition-colors flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[14px]">arrow_back</span>
          Back to Portal
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">

          {/* Progress */}
          <div className="mb-10">
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[12px] uppercase tracking-widest text-[#757575]">
                Step {step} of 3 — Join a Club
              </span>
              <span className="font-mono text-[12px] text-[#757575]">{progress}%</span>
            </div>
            <div className="w-full h-[2px] bg-[#e2e8f0] relative overflow-hidden">
              <motion.div
                className="absolute top-0 left-0 h-full bg-black"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>

          <AnimatePresence mode="wait">

            {/* ─── STEP 1: Enter Club Code ─── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.2 }}
              >
                <p className="font-mono text-[12px] uppercase tracking-widest text-[#757575] mb-4">
                  Club Code
                </p>
                <h2 className="font-display text-[48px] leading-[0.93] tracking-[-0.5px] font-bold mb-8 border-b-2 border-black pb-6">
                  Enter your club&apos;s invite code.
                </h2>

                <div className="flex flex-col gap-4">
                  <label className="font-mono text-[11px] uppercase tracking-widest text-[#757575]">
                    Club Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && validateCode()}
                    placeholder="e.g. CS-7X3K"
                    maxLength={10}
                    className="border-2 border-black p-4 font-mono text-[20px] uppercase tracking-widest outline-none focus:border-[#057DBC] placeholder:text-[#ccc] w-full"
                  />
                  {codeError && (
                    <p className="font-mono text-[11px] text-red-600 uppercase tracking-widest">
                      {codeError}
                    </p>
                  )}
                </div>

                <div className="mt-10 pt-6 border-t border-black flex justify-between">
                  <button
                    onClick={() => router.push("/portal")}
                    className="font-ui text-[14px] font-bold border-2 border-black px-6 py-3 uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    Back
                  </button>
                  <button
                    onClick={validateCode}
                    disabled={loading || code.length < 4}
                    className="font-ui text-[14px] font-bold border-2 border-black bg-black text-white px-8 py-3 uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-40 flex items-center gap-2"
                  >
                    {loading ? "Checking..." : "Continue"}
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── STEP 2: Select Role & Domain ─── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.2 }}
              >
                <p className="font-mono text-[12px] uppercase tracking-widest text-[#757575] mb-4">
                  Role Selection
                </p>
                <h2 className="font-display text-[48px] leading-[0.93] tracking-[-0.5px] font-bold mb-2 border-b-2 border-black pb-6">
                  How do you fit into{" "}
                  <span className="text-[#057DBC]">{clubName}</span>?
                </h2>

                <div className="mt-8 flex flex-col gap-3">
                  {ROLES.filter(r => !enabledRoles || enabledRoles.includes(r.value)).map((role) => (
                    <button
                      key={role.value}
                      onClick={() => {
                        setSelectedRole(role.value);
                        if (!role.needsDomain) setSelectedDomainId(null);
                      }}
                      className={`text-left p-5 border-2 transition-all ${
                        selectedRole === role.value
                          ? "border-[#057DBC] bg-[#f0f8ff]"
                          : "border-black hover:bg-[#f3f3f3]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[13px] uppercase tracking-widest font-bold">
                          {role.label}
                        </span>
                        {selectedRole === role.value && (
                          <span
                            className="material-symbols-outlined text-[#057DBC]"
                            style={{ fontVariationSettings: '"FILL" 1' }}
                          >
                            check_circle
                          </span>
                        )}
                      </div>
                      {role.needsDomain && (
                        <p className="font-ui text-[12px] text-[#757575] mt-1">
                          Domain assignment required
                        </p>
                      )}
                    </button>
                  ))}
                </div>

                {/* Domain selector — shown only when role needs it */}
                {roleConfig?.needsDomain && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-6"
                  >
                    <label className="font-mono text-[11px] uppercase tracking-widest text-[#757575] block mb-2">
                      Select Domain
                    </label>
                    {domains.length === 0 ? (
                      <p className="font-mono text-[11px] text-[#757575] uppercase">
                        This club has no domains yet. The president will assign you one on approval.
                      </p>
                    ) : (
                      <select
                        value={selectedDomainId ?? ""}
                        onChange={(e) =>
                          setSelectedDomainId(e.target.value ? Number(e.target.value) : null)
                        }
                        className="border-2 border-black p-3 font-mono text-[13px] uppercase tracking-wider outline-none focus:border-[#057DBC] w-full bg-white"
                      >
                        <option value="">-- Select a domain --</option>
                        {domains.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </motion.div>
                )}

                <div className="mt-10 pt-6 border-t border-black flex justify-between">
                  <button
                    onClick={() => goTo(1)}
                    className="font-ui text-[14px] font-bold border-2 border-black px-6 py-3 uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    Back
                  </button>
                  <button
                    onClick={() => goTo(3)}
                    disabled={
                      !selectedRole ||
                      (roleConfig?.needsDomain && domains.length > 0 && !selectedDomainId)
                    }
                    className="font-ui text-[14px] font-bold border-2 border-black bg-black text-white px-8 py-3 uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-40 flex items-center gap-2"
                  >
                    Continue
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── STEP 3: Message & Confirm ─── */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.2 }}
              >
                <p className="font-mono text-[12px] uppercase tracking-widest text-[#757575] mb-4">
                  Confirm Request
                </p>
                <h2 className="font-display text-[48px] leading-[0.93] tracking-[-0.5px] font-bold mb-8 border-b-2 border-black pb-6">
                  Review &amp; send your request.
                </h2>

                {/* Summary Card */}
                <div className="border-2 border-black p-6 mb-6 bg-[#f9f9f9]">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[#757575] mb-1">Club</p>
                      <p className="font-ui text-[16px] font-bold">{clubName}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[#757575] mb-1">Code</p>
                      <p className="font-mono text-[14px] uppercase">{code}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[#757575] mb-1">Requesting Role</p>
                      <span className="inline-block font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 bg-black text-white">
                        {roleConfig?.label}
                      </span>
                    </div>
                    {selectedDomainId && (
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-[#757575] mb-1">Domain</p>
                        <p className="font-ui text-[14px]">
                          {domains.find((d) => d.id === selectedDomainId)?.name ?? "—"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Optional message */}
                <div className="flex flex-col gap-2 mb-8">
                  <label className="font-mono text-[11px] uppercase tracking-widest text-[#757575]">
                    Message to leadership{" "}
                    <span className="normal-case text-[#757575]">(optional)</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Introduce yourself or explain why you'd like to join..."
                    rows={3}
                    className="border-2 border-black p-3 font-ui text-[14px] outline-none focus:border-[#057DBC] resize-none placeholder:text-[#ccc]"
                  />
                </div>

                <div className="mt-4 pt-6 border-t border-black flex justify-between">
                  <button
                    onClick={() => goTo(2)}
                    className="font-ui text-[14px] font-bold border-2 border-black px-6 py-3 uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    Back
                  </button>
                  <button
                    onClick={submitRequest}
                    disabled={loading}
                    className="font-ui text-[14px] font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-8 py-3 uppercase hover:bg-black hover:border-black transition-colors disabled:opacity-40 flex items-center gap-2"
                  >
                    {loading ? "Sending..." : "Send Request"}
                    <span className="material-symbols-outlined text-[16px]">send</span>
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#1a1a1a] text-white py-8 px-8 flex justify-between items-center mt-auto">
        <div className="font-display text-[20px] font-black uppercase tracking-tighter text-white">
          CLUB-HUB
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#757575]">
          © 2024 CLUB-HUB EDITORIAL.
        </div>
      </footer>
    </div>
  );
}
