import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--color-background) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-soft": "rgb(var(--color-surface-soft) / <alpha-value>)",
        "surface-raised": "rgb(var(--color-surface-raised) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        "muted-strong": "rgb(var(--color-muted-strong) / <alpha-value>)",
        foreground: "rgb(var(--color-foreground) / <alpha-value>)",
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        "primary-soft": "rgb(var(--color-primary-soft) / <alpha-value>)",
        buy: "rgb(var(--color-buy) / <alpha-value>)",
        sell: "rgb(var(--color-sell) / <alpha-value>)",
        risk: "rgb(var(--color-risk) / <alpha-value>)",
        "danger-surface": "rgb(var(--color-danger-surface) / <alpha-value>)",
        "danger-foreground": "rgb(var(--color-danger-foreground) / <alpha-value>)",
        "success-surface": "rgb(var(--color-success-surface) / <alpha-value>)",
        "success-foreground": "rgb(var(--color-success-foreground) / <alpha-value>)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--color-primary-soft) / 0.22), 0 18px 42px rgb(15 23 42 / 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
