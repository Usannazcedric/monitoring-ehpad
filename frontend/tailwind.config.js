/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Niveaux d'alerte : du plus calme au plus grave.
        level: {
          1: "#38bdf8",
          2: "#fbbf24",
          3: "#fb923c",
          4: "#f43f5e",
          5: "#dc2626",
        },
        // Gris bleutés de la console de nuit : la palette « zinc » d'origine est
        // redéfinie ici, toutes les pages en héritent sans changer leurs classes.
        zinc: {
          50: "#f8fafc",
          100: "#eef2f7",
          200: "#dbe3ee",
          300: "#c3cddb",
          400: "#94a3b8",
          500: "#6b7a93",
          600: "#46546e",
          700: "#2b3750",
          800: "#1b2438",
          900: "#111827",
          950: "#0a0f1c",
        },
        // Accent : le bleu-vert du bracelet Veilleur.
        brand: {
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          900: "#134e4a",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      keyframes: {
        "soft-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        "ring-pulse": {
          "0%": { transform: "scale(1)", opacity: "0.7" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
      },
      animation: {
        "soft-pulse": "soft-pulse 1.6s ease-in-out infinite",
        "ring-pulse": "ring-pulse 1.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};
