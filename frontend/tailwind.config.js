/** @type {import('tailwindcss').Config} */

// Les gris (et « white », la couleur du texte le plus fort) sont des variables CSS :
// le thème clair et le thème sombre les redéfinissent dans index.css, et toutes les
// pages suivent sans changer une seule classe.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const zinc = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((k) => [k, v(`zinc-${k}`)]),
);

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        zinc,
        white: v("strong"),
        // Niveaux d'alerte : du plus calme au plus grave.
        level: {
          1: "#0ea5e9",
          2: "#f59e0b",
          3: "#f97316",
          4: "#e11d48",
          5: "#b91c1c",
        },
        // Accent : le bleu-vert du bracelet Veilleur, utilisé avec parcimonie.
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
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "SF Pro Text", "Segoe UI", "Roboto", "sans-serif"],
      },
      keyframes: {
        "soft-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        "ring-pulse": {
          "0%": { transform: "scale(1)", opacity: "0.7" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
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
