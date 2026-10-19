import type { Config } from "tailwindcss";

// Shelf Edge: the shelf-strip green owns the shell, white ticket stock carries values,
// talker yellow and stop red carry review and blocking states.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rail: { DEFAULT: "#0F3D2E", 2: "#174D3B", 3: "#1F5C47", ink: "#C9D8D1" },
        ground: "#F1F2EC",
        stock: "#FFFFFF",
        ink: { DEFAULT: "#121514", 2: "#2C322F", muted: "#5A615C", faint: "#757C77" },
        line: { DEFAULT: "#D6D9CF", strong: "#AEB4A9" },
        talker: { DEFAULT: "#FFD23F", soft: "#FFF4CC", deep: "#8A6A00" },
        stop: { DEFAULT: "#D92B2B", soft: "#FBE8E6", deep: "#A11D1D" },
        ok: { DEFAULT: "#0F3D2E", soft: "#E3EDE8", deep: "#1C6B4F" },
      },
      fontFamily: {
        sans: ["var(--font-archivo)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { DEFAULT: "2px", sm: "2px", md: "3px", lg: "4px" },
      fontSize: {
        code: ["11px", { lineHeight: "16px", letterSpacing: "0.05em" }],
        label: ["12px", { lineHeight: "16px", letterSpacing: "0.06em" }],
      },
      boxShadow: {
        ticket: "0 1px 0 rgba(18,21,20,0.04), 0 2px 6px -2px rgba(18,21,20,0.08)",
        lift: "0 2px 4px rgba(18,21,20,0.06), 0 12px 28px -12px rgba(18,21,20,0.22)",
      },
      transitionTimingFunction: { out: "cubic-bezier(0.16, 1, 0.3, 1)" },
    },
  },
  plugins: [],
};
export default config;
