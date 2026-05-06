import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    screens: {
      xs: "400px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        bg: {
          base: "#0b0d12",
          surface: "#11141b",
          elevated: "#171b25",
          hover: "#1d2230",
        },
        ink: {
          primary: "#f5f7fa",
          secondary: "#a8b0c0",
          tertiary: "#6b7388",
          muted: "#454c5f",
        },
        edge: {
          subtle: "#1d2230",
          strong: "#262c3b",
        },
        accent: {
          DEFAULT: "#7c5cff",
          soft: "#9c85ff",
        },
        gain: {
          DEFAULT: "#16c784",
          soft: "rgba(22, 199, 132, 0.16)",
        },
        loss: {
          DEFAULT: "#ea3943",
          soft: "rgba(234, 57, 67, 0.16)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.32)",
        glow: "0 0 0 6px rgba(124, 92, 255, 0.12)",
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(0.85)" },
        },
        ringPulse: {
          "0%": { transform: "scale(0.6)", opacity: "0.7" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1.6s ease-in-out infinite",
        ringPulse: "ringPulse 1.8s ease-out infinite",
        fadeIn: "fadeIn 320ms ease-out both",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
