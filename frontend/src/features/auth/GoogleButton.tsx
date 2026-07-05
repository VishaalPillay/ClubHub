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
  onSuccess: (result: { isNew: boolean }) => void;
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

    const render = () => {
      const id = window.google?.accounts?.id;
      if (cancelled || !id || !slot) return;
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
      id.renderButton(slot, {
        type: "standard",
        theme: "outline",
        size: "large",
        text,
        width: slot.clientWidth || 360,
        logo_alignment: "center",
      });
    };

    if (window.google?.accounts?.id) {
      render();
    } else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = GSI_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
      script.addEventListener("error", () => !cancelled && setFailed(true));
    }

    return () => {
      cancelled = true;
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
