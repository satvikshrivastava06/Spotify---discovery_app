import type { Config } from "tailwindcss";

// Design system tokens — see Phase 7 Module 1 notes in the project spec
// for the reasoning (a record-collector/archive aesthetic, deliberately
// not a Spotify-green or generic near-black-plus-acid-accent look).
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14110F", // primary background — warm walnut-black, not cold near-black
        graphite: "#241F19", // elevated surface (cards)
        paper: "#EDE6D6", // primary text — warm off-white, not pure white
        "paper-muted": "#B8AF9C", // secondary text
        tape: "#C9A15A", // primary accent — analog tape/VU-meter amber
        verdigris: "#5B8A72", // secondary accent — aged-copper green
        rust: "#A6503A", // error/alert — oxidized brick red, not paint-bright vermilion
      },
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
} satisfies Config;
