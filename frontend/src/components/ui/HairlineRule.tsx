interface HairlineRuleProps {
  quiet?: boolean; // true = #e0d9ca, false = #000000
  className?: string;
}

/**
 * WIRED Hairline Rule — editorial column separator.
 *
 * Default (quiet=false): 1px solid #000000 — editorial, structural
 * Quiet (quiet=true): 1px solid #e0d9ca — barely visible section break
 *
 * NEVER use box-shadow to simulate a rule. This IS the rule.
 */
export function HairlineRule({ quiet = false, className = "" }: HairlineRuleProps) {
  return (
    <hr className={`${quiet ? "wired-rule-quiet" : "wired-rule"} ${className}`} />
  );
}
