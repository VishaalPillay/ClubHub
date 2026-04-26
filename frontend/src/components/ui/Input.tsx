import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * WIRED Editorial Input
 *
 * - 2px solid black border, 0px radius
 * - Focus: border stays black, no glow, no ring — only caret blinks
 * - Error: red label below, border stays black
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-[4px] w-full">
        {label && (
          <label htmlFor={id} className="wired-label">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`wired-input ${error ? "border-error" : ""} ${className}`}
          {...props}
        />
        {hint && !error && (
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "12px",
              color: "var(--color-caption-gray)",
              marginTop: "2px",
            }}
          >
            {hint}
          </span>
        )}
        {error && <span className="wired-error-text">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";
