/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0F1A2B",
        panel: "#16243A",
        panel2: "#1C2C45",
        hairline: "#2A3B57",
        gold: "#D4A537",
        goldsoft: "#E8C97A",
        gain: "#3FB68B",
        loss: "#E2604F",
        ink: "#EDEAE0",
        muted: "#8A93A6",
      },
      fontFamily: {
        display: ["'Newsreader'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
}
