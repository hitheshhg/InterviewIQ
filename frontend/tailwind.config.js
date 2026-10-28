/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        aurora: {
          bg: "#0B0F19",
          surface: "rgba(18, 24, 38, 0.7)",
          card: "rgba(255, 255, 255, 0.04)",
          border: "rgba(255, 255, 255, 0.1)",
          cyan: "#06B6D4",
          violet: "#8B5CF6",
          emerald: "#10B981",
          pink: "#EC4899",
          amber: "#F59E0B",
        },
      },
      backgroundImage: {
        'aurora-gradient': 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(139, 92, 246, 0.15) 50%, rgba(236, 72, 153, 0.15) 100%)',
        'aurora-glow': 'radial-gradient(ellipse at top, rgba(139, 92, 246, 0.25), transparent 70%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'neon-cyan': '0 0 20px -2px rgba(6, 182, 212, 0.5)',
        'neon-violet': '0 0 20px -2px rgba(139, 92, 246, 0.5)',
      },
    },
  },
  plugins: [],
}
