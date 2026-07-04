"use client";

import { motion, AnimatePresence, type Transition } from "framer-motion";
import { useRouter } from "next/navigation";
import { HouseSimple, ArrowLeft } from "@phosphor-icons/react";
import { HairlineRule } from "@/components/ui/HairlineRule";

const STEPS = [
  { step: 1, label: "INTENT", path: "/onboarding/step-1" },
  { step: 2, label: "CLUB DETAILS", path: "/onboarding/step-2" },
  { step: 3, label: "DOMAINS", path: "/onboarding/step-3" },
  { step: 4, label: "ROLES", path: "/onboarding/step-4" },
  { step: 5, label: "LAUNCH", path: "/onboarding/step-5" },
];

interface OnboardingShellProps {
  currentStep: number;          // 1–5
  children: React.ReactNode;
  direction?: "forward" | "back";
}

/**
 * WIRED Editorial Onboarding Shell
 *
 * Provides the step progress tracker and Framer Motion page transitions.
 *
 * ANIMATION RULES (strict):
 * - ease: "easeInOut", duration: 0.2 (tween) — no spring, no bounce
 * - Slides horizontally: forward = left-in, back = right-in
 */
const variants = {
  enterForward:  { x: "100%", opacity: 0 },
  enterBack:     { x: "-100%", opacity: 0 },
  center:        { x: 0, opacity: 1 },
  exitForward:   { x: "-100%", opacity: 0 },
  exitBack:      { x: "100%", opacity: 0 },
};

const TWEEN: Transition = { ease: "easeInOut", duration: 0.2 };

export function OnboardingShell({
  currentStep,
  children,
  direction = "forward",
}: OnboardingShellProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-hidden">

      {/* ─── Utility Nav Strip ─────────────────────────────────────────────── */}
      <div className="wired-utility-nav px-[24px] justify-between">
        <div className="flex items-center gap-[24px]">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-[6px] text-white hover:text-[#057dbc] transition-[color] duration-[150ms] linear"
          >
            <HouseSimple size={14} weight="bold" />
            <span>CLUB-HUB</span>
          </button>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "1px" }}>
          REGISTRATION
        </span>
      </div>

      {/* ─── Step Tracker ──────────────────────────────────────────────────── */}
      <div
        style={{
          borderBottom: "1px solid #000",
          padding: "16px 24px",
          backgroundColor: "#fff",
        }}
      >
        <div
          style={{
            maxWidth: "var(--max-w-onboarding)",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {STEPS.map((s, i) => (
            <div key={s.step} className="flex items-center gap-[8px] flex-1">
              {/* Step number + label */}
              <div className="flex items-center gap-[6px] flex-shrink-0">
                {/* Square dot — WIRED law: no circles for progress */}
                <div
                  className={`wired-step-dot ${
                    currentStep === s.step
                      ? "active"
                      : currentStep > s.step
                      ? "completed"
                      : ""
                  }`}
                />
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.92px",
                    textTransform: "uppercase" as const,
                    color:
                      currentStep >= s.step
                        ? "var(--color-ink)"
                        : "var(--color-disabled-gray)",
                    whiteSpace: "nowrap" as const,
                    display: "none",
                  }}
                  className="md:block"
                >
                  {s.label}
                </span>
              </div>
              {/* Connector line between steps */}
              {i < STEPS.length - 1 && (
                <div
                  className={`wired-progress-line ${currentStep > s.step ? "active" : ""}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Main Content with Framer Slide ────────────────────────────────── */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentStep}
            initial={direction === "forward" ? variants.enterForward : variants.enterBack}
            animate={variants.center}
            exit={direction === "forward" ? variants.exitForward : variants.exitBack}
            transition={TWEEN}
            className="absolute inset-0 overflow-y-auto"
          >
            <div
              style={{
                maxWidth: "var(--max-w-onboarding)",
                margin: "0 auto",
                padding: "48px 24px 64px",
              }}
            >
              {currentStep > 1 && (
                <button
                  onClick={() => router.back()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontFamily: "var(--font-ui)",
                    fontSize: "13px",
                    fontWeight: 700,
                    letterSpacing: "0.3px",
                    color: "var(--color-caption-gray)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    marginBottom: "32px",
                    padding: 0,
                    transition: "color 150ms linear",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "var(--color-ink)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "var(--color-caption-gray)")
                  }
                >
                  <ArrowLeft size={14} weight="bold" />
                  BACK
                </button>
              )}
              {children}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ─── Bottom Rule ───────────────────────────────────────────────────── */}
      <HairlineRule quiet />
    </div>
  );
}
