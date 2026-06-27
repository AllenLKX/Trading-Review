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
        background: "#051425",
        surface: "#0d1c2e",
        "surface-soft": "#122032",
        "surface-raised": "#1d2b3d",
        line: "#283648",
        muted: "#93a4b8",
        "muted-strong": "#c7d2e3",
        primary: "#4f46e5",
        "primary-soft": "#c3c0ff",
        buy: "#25a475",
        sell: "#c20038",
        risk: "#ff7b8a"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(195, 192, 255, 0.22), 0 18px 42px rgba(0, 0, 0, 0.28)"
      }
    }
  },
  plugins: []
};

export default config;
