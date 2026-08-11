/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(214 20% 18%)',
        input: 'hsl(214 20% 18%)',
        ring: 'hsl(212 100% 65%)',
        background: 'hsl(216 28% 7%)',
        foreground: 'hsl(210 20% 95%)',
        primary: { DEFAULT: 'hsl(212 100% 60%)', foreground: 'hsl(0 0% 100%)' },
        secondary: { DEFAULT: 'hsl(214 20% 18%)', foreground: 'hsl(210 20% 90%)' },
        muted: { DEFAULT: 'hsl(214 18% 14%)', foreground: 'hsl(215 10% 60%)' },
        accent: { DEFAULT: 'hsl(214 18% 18%)', foreground: 'hsl(210 20% 95%)' },
        destructive: { DEFAULT: 'hsl(0 70% 50%)', foreground: 'hsl(0 0% 100%)' },
        card: { DEFAULT: 'hsl(216 24% 10%)', foreground: 'hsl(210 20% 95%)' },
        popover: { DEFAULT: 'hsl(216 24% 12%)', foreground: 'hsl(210 20% 95%)' },
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
      keyframes: {
        'slide-in': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
