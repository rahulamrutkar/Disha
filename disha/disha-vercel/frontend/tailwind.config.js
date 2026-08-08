export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Legacy theme tokens (used by VerdictPanel, TickerRhythm, NewsFeed)
        base:     "#0F1A2B",
        panel:    "var(--bg-panel)",
        panel2:   "var(--bg-card)",
        hairline: "var(--border-color, #2A3B57)",
        gold:     "#D4A537",
        goldsoft: "#E8C97A",
        gain:     "#3FB68B",
        loss:     "#E2604F",
        ink:      "var(--text-1)",
        muted:    "var(--text-3)",
      },
    },
  },
  plugins: [],
}
