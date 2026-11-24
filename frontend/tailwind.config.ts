/** @type {import('tailwindcss').Config} */
//
// IMPORTANT: every value here must stay byte-identical to the `@theme` block
// in src/styles/globals.css, which is authoritative under Tailwind v4. This
// copy exists so tooling that reads the JS config resolves the same tokens.
// Palette: "Evergreen & Marigold" (2026-11 redesign) — see globals.css.
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Evergreen — brand, navigation, primary actions
        primary: {
          50: '#eef7f2',
          100: '#d6ede0',
          200: '#addac3',
          300: '#7cc1a0',
          400: '#4aa27b',
          500: '#24845f',
          600: '#156b4c',
          700: '#0f573e',
          800: '#0d4633',
          900: '#0b3729',
          950: '#062319',
        },
        // Clay rose (historic slot name `wine`) — supporting categorical tone
        wine: {
          50: '#fbf1f3',
          100: '#f6dde4',
          200: '#ecbacb',
          300: '#dc90aa',
          400: '#c76688',
          500: '#a63f63',
          600: '#86314f',
          700: '#6b2740',
          800: '#511e31',
          900: '#361420',
        },
        // Indigo (historic slot name `purple`) — supporting tone, info states
        purple: {
          50: '#f1f3fb',
          100: '#e1e6f7',
          200: '#c3cced',
          300: '#9daddf',
          400: '#7386cc',
          500: '#5264b4',
          600: '#404f95',
          700: '#334077',
          800: '#28315a',
          900: '#1b213d',
        },
        // Marigold — warmth, highlights, marketing CTAs
        accent: {
          50: '#fff8eb',
          100: '#feedc9',
          200: '#fcd98f',
          300: '#f9c25a',
          400: '#f5aa2f',
          500: '#e38c12',
          600: '#b4600c',
          700: '#8f4a0e',
          800: '#733c11',
        },

        canvas: '#f6f5f0',
        surface: '#ffffff',
        'surface-subtle': '#f9f8f4',
        'surface-sunken': '#f1f0ea',

        ink: '#13201a',
        body: '#2d3a33',
        secondary: '#56625b',
        muted: '#646e68',

        line: '#e4e2d9',
        'line-strong': '#d6d3c7',
        'line-input': '#c8c5b8',
        'line-input-hover': '#9a988d',

        'success-text': '#11643f',
        'success-bg': '#edf8f1',
        'success-border': '#bde3cc',

        'warning-text': '#8a4a07',
        'warning-bg': '#fff7e8',
        'warning-border': '#f6d9a2',

        'danger-text': '#b3261e',
        'danger-bg': '#fef3f2',
        'danger-border': '#f7cbc6',
        'danger-solid': '#d0362b',
        'danger-solid-hover': '#b3261e',

        'info-text': '#3d4b8f',
        'info-bg': '#f1f3fb',
        'info-border': '#cdd5f0',

        'neutral-text': '#3a4540',
        'neutral-bg': '#f1f1ec',
        'neutral-border': '#e1e0d7',

        'gold-text': '#8a4a07',
        'gold-bg': '#fff7e8',
        'gold-border': '#f6d9a2',
      },
      fontFamily: {
        // Self-hosted via next/font (see app/layout.tsx); system stack as fallback.
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        serif: ['var(--font-display)', 'var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        accent: ['var(--font-accent)', 'Georgia', '"Times New Roman"', 'serif'],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(19 32 26 / 0.06)',
        card: '0 1px 2px 0 rgb(19 32 26 / 0.04), 0 2px 6px -2px rgb(19 32 26 / 0.05)',
        panel: '0 1px 2px 0 rgb(19 32 26 / 0.04), 0 12px 28px -10px rgb(19 32 26 / 0.16)',
        dialog: '0 2px 6px 0 rgb(6 35 25 / 0.06), 0 32px 64px -16px rgb(6 35 25 / 0.34)',
        glow: '0 0 0 1px rgb(15 87 62 / 0.08), 0 8px 24px -8px rgb(15 87 62 / 0.35)',
      },
      maxWidth: {
        prose: '65ch',
      },
    },
  },
  plugins: [],
};
