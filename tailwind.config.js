/** @type {import('tailwindcss').Config} */
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  // hover רק במכשירים עם עכבר - באייפון hover "נתקע" אחרי נגיעה
  future: { hoverOnlyWhenSupported: true },
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        card: token("card"),
        raised: token("raised"),
        hover: token("hover"),
        line: token("line"),
        fg: token("fg"),
        muted: token("muted"),
        accent: token("accent"),
        "accent-ink": token("accent-ink"),
        "accent-text": token("accent-text"),
        good: token("good"),
        warn: token("warn"),
        crit: token("crit"),
      },
      fontFamily: {
        sans: ['"Rubik"', "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: { card: "22px" },
      boxShadow: {
        float: "0 18px 48px -12px rgb(0 0 0 / 0.45), 0 2px 8px rgb(0 0 0 / 0.12)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.23, 1, 0.32, 1)",
        drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [],
};
