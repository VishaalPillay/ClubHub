import type { Config } from "tailwindcss";

/**
 * WIRED Editorial System — Locked-Down Tailwind Config
 *
 * CRITICAL: We use `theme: {}` not `theme.extend`.
 * This REPLACES all Tailwind defaults, making it physically impossible
 * to use shadow-*, rounded-lg, bg-blue-500, etc.
 * Only what is explicitly defined below can be used.
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // ─── COLORS: Only WIRED palette — nothing else ───────────────────────────
    colors: {
      transparent: "transparent",
      current: "currentColor",
      // WIRED core palette
      black: "#000000",
      white: "#FFFFFF",
      ink: "#1A1A1A",
      "caption-gray": "#757575",
      "disabled-gray": "#999999",
      "hairline-tint": "#E2E8F0",
      "link-blue": "#057DBC",
      // Error (used sparingly, forms only)
      error: "#E53E3E",
    },

    // ─── BORDER RADIUS: Exactly 3 values, as per WIRED law ───────────────────
    borderRadius: {
      none: "0px",       // Default — every container, button, input, image
      full: "50%",       // ONLY for icon buttons and circular author avatars
      pill: "1920px",    // ONLY for inline text spans like "BREAKING", "LIVE"
    },

    // ─── BOX SHADOW: None. WIRED is flat by religion. ────────────────────────
    boxShadow: {
      none: "none",
    },

    // ─── BORDER WIDTH ─────────────────────────────────────────────────────────
    borderWidth: {
      DEFAULT: "1px",
      "0": "0px",
      "1": "1px",      // Hairline rule
      "2": "2px",      // Buttons, inputs, ribbons
    },

    // ─── SPACING: 8px base scale ──────────────────────────────────────────────
    spacing: {
      px: "1px",
      "0": "0px",
      "0.5": "4px",
      "1": "8px",
      "1.5": "12px",
      "2": "16px",
      "3": "24px",
      "4": "32px",
      "5": "40px",
      "6": "48px",
      "8": "64px",
      "10": "80px",
      "12": "96px",
      "16": "128px",
      "20": "160px",
      "24": "192px",
    },

    // ─── FONT FAMILY: Mapped to next/font CSS variables ───────────────────────
    fontFamily: {
      // WiredDisplay substitute — display headlines, feature titles
      display: ["var(--font-newsreader)", "Georgia", "serif"],
      // BreveText substitute — article body, decks, longer captions
      body: ["var(--font-newsreader)", "Georgia", "serif"],
      // Apercu substitute — UI labels, buttons, navigation
      ui: ["var(--font-inter)", "Helvetica Neue", "sans-serif"],
      // WiredMono substitute — ALL-CAPS kickers, eyebrows, timestamps
      mono: ["var(--font-space-grotesk)", "Space Mono", "monospace"],
    },

    // ─── FONT SIZE ────────────────────────────────────────────────────────────
    fontSize: {
      "11": ["11px", { lineHeight: "1.45", letterSpacing: "0" }],
      "12": ["12px", { lineHeight: "1.33", letterSpacing: "1.1px" }],
      "13": ["13px", { lineHeight: "1.23", letterSpacing: "0.92px" }],
      "14": ["14px", { lineHeight: "1.29", letterSpacing: "0.4px" }],
      "16": ["16px", { lineHeight: "1.25", letterSpacing: "0.3px" }],
      "17": ["17px", { lineHeight: "1.29", letterSpacing: "-0.144px" }],
      "19": ["19px", { lineHeight: "1.47", letterSpacing: "0.108px" }],
      "20": ["20px", { lineHeight: "1.20", letterSpacing: "-0.28px" }],
      "26": ["26px", { lineHeight: "1.18", letterSpacing: "0" }],
      "36": ["36px", { lineHeight: "1.05", letterSpacing: "-0.5px" }],
      "40": ["40px", { lineHeight: "1.05", letterSpacing: "-0.5px" }],
      "64": ["64px", { lineHeight: "1.05", letterSpacing: "-0.5px" }],
    },

    // ─── FONT WEIGHT ─────────────────────────────────────────────────────────
    fontWeight: {
      normal: "400",
      semibold: "600",
      bold: "700",
    },

    // ─── MAX WIDTH ────────────────────────────────────────────────────────────
    maxWidth: {
      editorial: "1600px",
      content: "1280px",
      form: "640px",
      "onboarding": "720px",
    },

    // ─── SCREENS: WIRED breakpoints ───────────────────────────────────────────
    screens: {
      sm: "375px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1600px",
    },

    // ─── Z-INDEX ──────────────────────────────────────────────────────────────
    zIndex: {
      auto: "auto",
      "0": "0",
      "10": "10",
      "20": "20",
      "50": "50",
    },

    // ─── TRANSITION ───────────────────────────────────────────────────────────
    transitionDuration: {
      "0": "0ms",
      "150": "150ms",   // Micro-interactions: button hovers, link color swaps
      "200": "200ms",   // Structural state changes
    },
    transitionTimingFunction: {
      linear: "linear",
      "ease-in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
    },

    // ─── LINE HEIGHT ─────────────────────────────────────────────────────────
    lineHeight: {
      none: "1",
      tight: "1.05",
      snug: "1.18",
      normal: "1.25",
      relaxed: "1.47",
      loose: "1.50",
    },

    // ─── LETTER SPACING ──────────────────────────────────────────────────────
    letterSpacing: {
      tightest: "-0.5px",
      tight: "-0.28px",
      normal: "0",
      wide: "0.3px",
      wider: "0.92px",
      widest: "1.2px",
    },

    // ─── OPACITY ─────────────────────────────────────────────────────────────
    opacity: {
      "0": "0",
      "50": "0.5",
      "100": "1",
    },

    // ─── ASPECT RATIO ────────────────────────────────────────────────────────
    aspectRatio: {
      auto: "auto",
      "16/9": "16 / 9",
      "4/3": "4 / 3",
      "1/1": "1 / 1",
      square: "1 / 1",
    },

    // ─── GRID ─────────────────────────────────────────────────────────────────
    gridTemplateColumns: {
      "1": "repeat(1, minmax(0, 1fr))",
      "2": "repeat(2, minmax(0, 1fr))",
      "3": "repeat(3, minmax(0, 1fr))",
      "4": "repeat(4, minmax(0, 1fr))",
      "12": "repeat(12, minmax(0, 1fr))",
    },
    gap: {
      px: "1px",
      "0": "0px",
      "0.5": "4px",
      "1": "8px",
      "1.5": "12px",
      "2": "16px",
      "3": "24px",
      "4": "32px",
      "6": "48px",
    },
  },
  plugins: [],
};

export default config;
