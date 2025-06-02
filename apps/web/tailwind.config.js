/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "Menlo", "monospace"],
      },
      colors: {
        // Existing shadcn colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // Vercel/Geist color palette
        "vercel-black": "#000000",
        "vercel-white": "#ffffff",
        "vercel-gray": {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
        },
        "vercel-blue": "#0070f3",
        "vercel-success": "#0070f3",
        "vercel-warning": "#f5a623",
        "vercel-error": "#ee0000",

        // Geist design system colors
        "gray-100": "var(--ds-gray-100)",
        "gray-200": "var(--ds-gray-200)",
        "gray-500": "var(--ds-gray-500)",
        "gray-600": "var(--ds-gray-600)",
        "gray-700": "var(--ds-gray-700)",
        "gray-900": "var(--ds-gray-900)",
        "gray-1000": "var(--ds-gray-1000)",
        "gray-alpha-400": "var(--ds-gray-alpha-400)",
        "background-100": "var(--ds-background-100)",
        "background-200": "var(--ds-background-200)",
        error: "var(--geist-error)",
        warning: "var(--geist-warning)",
        cyan: "var(--geist-cyan)",
        success: "var(--geist-success)",
        background: "var(--geist-background)",
        secondary: "var(--geist-secondary)",
        "accents-1": "var(--accents-1)",
        "accents-2": "var(--accents-2)",

        // Colored toggle variants
        "blue-100": "var(--ds-blue-100)",
        "blue-700": "var(--ds-blue-700)",
        "blue-1000": "var(--ds-blue-1000)",
        "red-100": "var(--ds-red-100)",
        "red-600": "var(--ds-red-600)",
        "red-1000": "var(--ds-red-1000)",
        "amber-100": "var(--ds-amber-100)",
        "amber-700": "var(--ds-amber-700)",
        "amber-1000": "var(--ds-amber-1000)",
        "green-100": "var(--ds-green-100)",
        "green-700": "var(--ds-green-700)",
        "green-1000": "var(--ds-green-1000)",
        "teal-100": "var(--ds-teal-100)",
        "teal-700": "var(--ds-teal-700)",
        "teal-1000": "var(--ds-teal-1000)",
        "purple-100": "var(--ds-purple-100)",
        "purple-700": "var(--ds-purple-700)",
        "purple-1000": "var(--ds-purple-1000)",
        "pink-100": "var(--ds-pink-100)",
        "pink-700": "var(--ds-pink-700)",
        "pink-1000": "var(--ds-pink-1000)",

        // Additional components colors
        "gray-400": "var(--ds-gray-400)",
        "gray-alpha-200": "var(--ds-gray-alpha-200)",
        "blue-600": "var(--ds-blue-600)",
        "blue-900": "var(--ds-blue-900)",
        shadow: "var(--ds-shadow)",
        violet: "var(--geist-violet)",
        foreground: "var(--geist-foreground)",

        // Context card colors
        "context-card-border": "var(--context-card-border)",
      },
      boxShadow: {
        // Material component shadows
        border: "var(--ds-shadow-border)",
        small: "var(--ds-shadow-small)",
        "border-small": "var(--ds-shadow-border-small)",
        medium: "var(--ds-shadow-medium)",
        "border-medium": "var(--ds-shadow-border-medium)",
        large: "var(--ds-shadow-large)",
        "border-large": "var(--ds-shadow-border-large)",
        tooltip: "var(--ds-shadow-tooltip)",
        menu: "var(--ds-shadow-menu)",
        modal: "var(--ds-shadow-modal)",
        fullscreen: "var(--ds-shadow-fullscreen)",
        // Toggle component shadow
        toggle: "var(--ds-toggle-ring)",
      },
      backgroundImage: {
        // Skeleton component gradient
        "skeleton-gradient":
          "linear-gradient(270deg, var(--accents-1), var(--accents-2), var(--accents-2), var(--accents-1))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Geist components keyframes
        skeletonLoading: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        fadeIn: {
          "0%": { opacity: "0", scale: "0.5" },
          "20%": { opacity: "1", scale: "1" },
          "80%": { opacity: "1", scale: "1" },
          "100%": { opacity: "0", scale: "0.5" },
        },
        fadeOut: {
          "0%": { opacity: "1", scale: "1" },
          "20%": { opacity: "0", scale: "0.5" },
          "80%": { opacity: "0", scale: "0.5" },
          "100%": { opacity: "1", scale: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        // Geist components animations
        "skeleton-loading": "skeletonLoading 8s infinite ease-in-out",
        "fade-in": "fadeIn 1s ease-out forwards",
        "fade-out": "fadeOut 1s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
