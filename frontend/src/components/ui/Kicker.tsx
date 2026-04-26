import { HTMLAttributes } from "react";

interface KickerProps extends HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  className?: string;
}

/**
 * WIRED Kicker — ALL-CAPS mono eyebrow above every headline.
 *
 * Sits 4–8px above the headline it labels.
 * Must ALWAYS be uppercase. Lowercase mono = broken.
 * Extends HTMLAttributes so style, onClick, etc. pass through naturally.
 */
export function Kicker({ children, className = "", ...rest }: KickerProps) {
  return (
    <span className={`wired-kicker ${className}`} {...rest}>
      {children}
    </span>
  );
}
