import type { Config } from "tailwindcss";

// Carbon Set: the brief is a multi-part routing form. Carbon ink carries structure and action,
// white bond sheets sit on a cool desk, copy tints carry state, and stamp red only ever blocks.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#15182B", 2: "#2E3247", muted: "#555A6E", faint: "#6B7083", soft: "#8C91A3" },
        paper: "#FFFFFF",
        desk: { DEFAULT: "#ECEEF2", 2: "#E2E5EB", 3: "#D6DAE2" },
        line: { DEFAULT: "#DADDE4", strong: "#B4B9C6" },
        canary: { soft: "#FFF5C2", DEFAULT: "#FFE066", deep: "#735600" },
        mint: { soft: "#DDF3E4", DEFAULT: "#8FDBA9", deep: "#17663A" },
        sky: { soft: "#E0ECFF", DEFAULT: "#A6C8FF", deep: "#1D4FA0" },
        gold: { soft: "#FFEDCC", DEFAULT: "#FFC85C", deep: "#7A4E00" },
        pink: { soft: "#FFE3EA", DEFAULT: "#FFB3C7", deep: "#9E2049" },
        stop: { soft: "#FFE4E7", DEFAULT: "#D3283C", deep: "#A01A2B" },
      },
      fontFamily: {
        sans: ["var(--font-text)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-text)", "system-ui", "sans-serif"],
      },
      borderRadius: { sm: "4px", DEFAULT: "6px", md: "8px", lg: "12px", xl: "16px", "2xl": "22px" },
      fontSize: {
        meta: ["12px", { lineHeight: "16px" }],
      },
      boxShadow: {
        sheet: "0 1px 0 rgba(21,24,43,0.03), 0 1px 3px rgba(21,24,43,0.06), 0 12px 28px -18px rgba(21,24,43,0.22)",
        raised: "0 1px 2px rgba(21,24,43,0.06), 0 18px 40px -20px rgba(21,24,43,0.32)",
        lift: "0 2px 6px rgba(21,24,43,0.08), 0 28px 56px -24px rgba(21,24,43,0.42)",
        focus: "0 0 0 2px #FFFFFF, 0 0 0 4px #15182B",
        selected: "inset 0 0 0 1.5px #15182B",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.23, 1, 0.32, 1)",
        "in-out": "cubic-bezier(0.77, 0, 0.175, 1)",
        drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      maxWidth: { page: "1560px" },
    },
  },
  plugins: [],
};
export default config;
