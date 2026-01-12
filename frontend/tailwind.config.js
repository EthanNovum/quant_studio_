/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // A-share market colors: red = up, green = down
        up: '#ef4444',
        down: '#22c55e',
        // UI colors
        background: '#0a0a0a',
        foreground: '#fafafa',
        card: '#171717',
        'card-foreground': '#fafafa',
        primary: '#3b82f6',
        'primary-foreground': '#fafafa',
        secondary: '#262626',
        'secondary-foreground': '#fafafa',
        muted: '#262626',
        'muted-foreground': '#a3a3a3',
        accent: '#262626',
        'accent-foreground': '#fafafa',
        destructive: '#ef4444',
        'destructive-foreground': '#fafafa',
        border: '#262626',
        input: '#262626',
        ring: '#3b82f6',
        danger: '#dc2626',
        'danger-foreground': '#ffffff',
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
    },
  },
  plugins: [],
}
