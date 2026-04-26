import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
}

/**
 * WIRED Editorial Button
 *
 * primary: white bg, 2px black border — inverts to black on hover (150ms linear)
 * secondary: black bg, 2px white border — inverts to white on hover (150ms linear)
 *
 * WIRED law: 0px border-radius, no shadow, no spring animations.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", fullWidth = false, className = "", children, ...props }, ref) => {
    const base = variant === "primary" ? "wired-btn-primary" : "wired-btn-secondary";
    return (
      <button
        ref={ref}
        className={`${base} ${fullWidth ? "w-full" : ""} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
