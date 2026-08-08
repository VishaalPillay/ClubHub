import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Links out of this site go to app.<domain>, a different origin. next/link buys
      // nothing for an external href (no client-side navigation, no prefetch worth having)
      // and the rule cannot tell the difference, so it fires on every CTA. See links.ts.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);

export default eslintConfig;
