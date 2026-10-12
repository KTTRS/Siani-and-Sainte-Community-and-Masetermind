import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: ".5625rem",
        md: ".375rem",
        sm: ".1875rem",
        // Direction D — Tactical Mil-Spec. 2px on every surface.
        d: "2px",
      },
      spacing: {
        // Direction D scale (xs..3xl). Use as p-d-md, gap-d-lg, etc.
        "d-xs": "var(--d-space-xs)",
        "d-sm": "var(--d-space-sm)",
        "d-md": "var(--d-space-md)",
        "d-lg": "var(--d-space-lg)",
        "d-xl": "var(--d-space-xl)",
        "d-2xl": "var(--d-space-2xl)",
        "d-3xl": "var(--d-space-3xl)",
      },
      colors: {
        // Direction D semantic tokens — single source of truth going forward.
        bg:        "hsl(var(--bg) / <alpha-value>)",
        surface:   "hsl(var(--surface) / <alpha-value>)",
        "surface-2": "hsl(var(--surface-2) / <alpha-value>)",
        rim:       "hsl(var(--rim) / <alpha-value>)",
        "rim-bright": "hsl(var(--rim-bright) / <alpha-value>)",
        ok:        "hsl(var(--ok) / <alpha-value>)",
        hi:        "hsl(var(--hi) / <alpha-value>)",
        mid:       "hsl(var(--mid) / <alpha-value>)",
        lo:        "hsl(var(--lo) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          border: "hsl(var(--card-border) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
          border: "hsl(var(--popover-border) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          border: "var(--primary-border)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          border: "var(--secondary-border)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
          border: "var(--muted-border)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          border: "var(--accent-border)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border: "var(--destructive-border)",
        },
        ring: "hsl(var(--ring) / <alpha-value>)",
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },
        sidebar: {
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
        },
        "sidebar-primary": {
          DEFAULT: "hsl(var(--sidebar-primary) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          border: "var(--sidebar-primary-border)",
        },
        "sidebar-accent": {
          DEFAULT: "hsl(var(--sidebar-accent) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "var(--sidebar-accent-border)"
        },
        // ORGANIC FUTURISM — Everglade / Lime / Mint / Fog scales
        everglade: {
          950: "hsl(var(--everglade-950) / <alpha-value>)",
          900: "hsl(var(--everglade-900) / <alpha-value>)",
          800: "hsl(var(--everglade-800) / <alpha-value>)",
          700: "hsl(var(--everglade-700) / <alpha-value>)",
          600: "hsl(var(--everglade-600) / <alpha-value>)",
        },
        mint: {
          200: "hsl(var(--mint-200) / <alpha-value>)",
          300: "hsl(var(--mint-300) / <alpha-value>)",
          500: "hsl(var(--mint-500) / <alpha-value>)",
        },
        fog: {
          100: "hsl(var(--fog-100) / <alpha-value>)",
          200: "hsl(var(--fog-200) / <alpha-value>)",
        },
        // Legacy crimson alias — now resolves to lime-core via index.css.
        crimson: {
          DEFAULT: "hsl(var(--crimson) / <alpha-value>)",
          deep: "hsl(var(--crimson-deep) / <alpha-value>)",
          glow: "hsl(var(--crimson-glow) / <alpha-value>)",
          muted: "hsl(var(--crimson-muted) / <alpha-value>)",
        },
        void: {
          DEFAULT: "hsl(var(--void) / <alpha-value>)",
        },
        black: {
          DEFAULT: "hsl(var(--black) / <alpha-value>)",
        },
        charcoal: {
          DEFAULT: "hsl(var(--charcoal) / <alpha-value>)",
        },
        graphite: {
          DEFAULT: "hsl(var(--graphite) / <alpha-value>)",
        },
        smoke: {
          DEFAULT: "hsl(var(--smoke) / <alpha-value>)",
        },
        steel: {
          DEFAULT: "hsl(var(--steel) / <alpha-value>)",
        },
        white: {
          DEFAULT: "hsl(var(--white) / <alpha-value>)",
        },
        silver: {
          DEFAULT: "hsl(var(--silver) / <alpha-value>)",
        },
        gray: {
          DEFAULT: "hsl(var(--gray) / <alpha-value>)",
        },
        chrome: {
          DEFAULT: "hsl(var(--chrome) / <alpha-value>)",
        },
        platinum: {
          DEFAULT: "hsl(var(--platinum) / <alpha-value>)",
        },
        // Legacy aliases for backward compatibility
        infrared: {
          core: "hsl(var(--crimson) / <alpha-value>)",
          bright: "hsl(var(--crimson-glow) / <alpha-value>)",
          muted: "hsl(var(--crimson-muted) / <alpha-value>)",
          dark: "hsl(var(--crimson-deep) / <alpha-value>)",
        },
        signal: {
          // Direction D primary
          DEFAULT: "hsl(var(--signal) / <alpha-value>)",
          glow: "hsl(var(--signal-glow) / <alpha-value>)",
          // Legacy aliases (still resolve via crimson tokens which now point at signal)
          core: "hsl(var(--crimson) / <alpha-value>)",
          bright: "hsl(var(--crimson-glow) / <alpha-value>)",
          muted: "hsl(var(--crimson-muted) / <alpha-value>)",
          dark: "hsl(var(--crimson-deep) / <alpha-value>)",
        },
        lime: {
          DEFAULT: "hsl(var(--lime-core) / <alpha-value>)",
          core:   "hsl(var(--lime-core) / <alpha-value>)",
          soft:   "hsl(var(--lime-soft) / <alpha-value>)",
          bright: "hsl(var(--lime-soft) / <alpha-value>)",
          muted:  "hsl(var(--everglade-600) / <alpha-value>)",
          dark:   "hsl(var(--everglade-700) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
        karn: ["var(--font-karn)"],
        condensed: ["var(--font-condensed)"],
        stats: ["var(--font-stats)"],
        broken: ["var(--font-broken)"],
        display: ["var(--font-display)"],
        // Organic Futurism — Wealth reserved for SIANI / SAINTE logo only.
        wealth:    ["var(--font-wealth)"],
        "display-d": ["var(--font-display-d)"],
        headline: ["var(--font-headline)"],
        body: ["var(--font-body)"],
        label: ["var(--font-label)"],
        numeric: ["var(--font-numeric)"],
      },
      boxShadow: {
        "d-raised":  "var(--d-shadow-raised)",
        "d-sunken":  "var(--d-shadow-sunken)",
        "d-pressed": "var(--d-shadow-pressed)",
        "d-modal":   "var(--d-shadow-modal)",
        "d-signal":  "var(--d-signal-glow)",
      },
      transitionDuration: {
        "d-tap":    "80ms",
        "d-nudge":  "120ms",
        "d-reveal": "240ms",
      },
      transitionTimingFunction: {
        "d-precision": "cubic-bezier(0.2, 0.0, 0.2, 1)",
      },
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.25rem", fontWeight: "500" }],
        sm: ["0.9375rem", { lineHeight: "1.375rem", fontWeight: "500" }],
        base: ["1.0625rem", { lineHeight: "1.625rem", fontWeight: "500" }],
        lg: ["1.1875rem", { lineHeight: "1.75rem", fontWeight: "600" }],
        xl: ["1.375rem", { lineHeight: "1.875rem", fontWeight: "600" }],
        "2xl": ["1.625rem", { lineHeight: "2rem", fontWeight: "700" }],
        "3xl": ["2rem", { lineHeight: "2.375rem", fontWeight: "700" }],
        "4xl": ["2.5rem", { lineHeight: "2.75rem", fontWeight: "800" }],
        "5xl": ["3.25rem", { lineHeight: "1.1", fontWeight: "800" }],
      },
      fontWeight: {
        normal: "500",
        medium: "600",
        semibold: "700",
        bold: "800",
        extrabold: "900",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { 
            boxShadow: "0 0 20px rgba(220,20,60,0.2)",
            transform: "scale(1)",
          },
          "50%": { 
            boxShadow: "0 0 40px rgba(220,20,60,0.4)",
            transform: "scale(1.02)",
          },
        },
        "breathe": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.03)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "breathe": "breathe 4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
