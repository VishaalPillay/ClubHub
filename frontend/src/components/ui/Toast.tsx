"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

export type ToastTone = "info" | "success" | "error";

const TONE_BAR: Record<ToastTone, string> = {
  info: "bg-black",
  success: "bg-[#057DBC]",
  error: "bg-red-600",
};

/**
 * Bottom-right editorial toast — the in-page replacement for `alert()`, which blocks
 * the main thread and renders as browser chrome instead of as part of the product.
 *
 * Controlled: render with a non-null `message` to show it. Auto-dismisses after
 * `duration` ms and calls onDismiss; a manual close button does the same.
 */
export default function Toast({
  message,
  tone = "info",
  duration = 3800,
  onDismiss,
}: {
  message: string | null;
  tone?: ToastTone;
  duration?: number;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [message, duration, onDismiss]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="fixed bottom-6 right-6 z-[120] max-w-sm border-2 border-black bg-white flex items-stretch"
        >
          <div className={`w-1.5 shrink-0 ${TONE_BAR[tone]}`} />
          <div className="flex items-start gap-3 px-4 py-3">
            <p className="font-ui text-[14px] text-black">{message}</p>
            <button
              onClick={onDismiss}
              aria-label="Dismiss"
              className="text-[#757575] hover:text-black transition-colors shrink-0 -mt-0.5"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
