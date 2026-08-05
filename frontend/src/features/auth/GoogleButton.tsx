"use client";

import { useEffect, useRef, useState } from "react";
import { googleAuth } from "@/lib/api/auth";

/** Minimal typing for the Google Identity Services global (loaded from gsi/client). */
type GoogleId = {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with";
      width?: number;
      logo_alignment?: "left" | "center";
    }
  ) => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/**
 * "Continue with Google" via Google Identity Services. Renders Google's official
 * button (their branding rules require it) into an editorial 2px-border frame.
 * Renders nothing when NEXT_PUBLIC_GOOGLE_CLIENT_ID is unset, so email/password
 * remains the only path until Google is configured.
 */
export default function GoogleButton({
  text,
  onSuccess,
  onError,
}: {
  text: "signup_with" | "signin_with" | "continue_with";
  onSuccess: (result: { isNew: boolean; profileCompleted: boolean }) => void;
  onError: (message: string) => void;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  // Keep the latest handlers without re-initializing GIS on every render.
  const handlersRef = useRef({ onSuccess, onError });
  useEffect(() => {
    handlersRef.current = { onSuccess, onError };
  });

  useEffect(() => {
    if (!CLIENT_ID || !slotRef.current) return;
    const slot = slotRef.current;
    let cancelled = false;
    let initialized = false;
    let lastWidth = 0;

    // Re-paints Google's button at the slot's *current* width. Called both once
    // GIS is ready and from the ResizeObserver below, because the slot can still
    // be 0-wide (or mid-transition, e.g. RegisterWizard's framer-motion slide)
    // the moment the script finishes loading — painting once at that stale width
    // is what left the button narrower than its border frame.
    const paint = () => {
      const id = window.google?.accounts?.id;
      const width = slot.clientWidth;
      if (cancelled || !id || !width || width === lastWidth) return;
      lastWidth = width;
      slot.innerHTML = ""; // effects can run twice (dev StrictMode) — never stack two buttons
      id.renderButton(slot, {
        type: "standard",
        theme: "outline",
        size: "large",
        text,
        width,
        logo_alignment: "center",
      });
    };

    const init = () => {
      const id = window.google?.accounts?.id;
      if (cancelled || !id || initialized) return;
      initialized = true;
      id.initialize({
        client_id: CLIENT_ID,
        callback: async ({ credential }) => {
          try {
            handlersRef.current.onSuccess(await googleAuth(credential));
          } catch (e: unknown) {
            handlersRef.current.onError(
              e instanceof Error ? e.message : "Google sign-in failed."
            );
          }
        },
      });
      paint();
    };

    if (window.google?.accounts?.id) {
      init();
    } else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = GSI_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", init);
      script.addEventListener("error", () => !cancelled && setFailed(true));
    }

    const observer = new ResizeObserver(() => paint());
    observer.observe(slot);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [text]);

  if (!CLIENT_ID || failed) return null;

  return (
    <div>
      <div ref={slotRef} className="border-2 border-black p-1 flex justify-center" />
      <div className="flex items-center gap-4 my-5">
        <span className="flex-1 h-px bg-[#e2e8f0]" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#757575]">
          or with email
        </span>
        <span className="flex-1 h-px bg-[#e2e8f0]" />
      </div>
    </div>
  );
}
