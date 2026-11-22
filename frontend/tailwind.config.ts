/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // InternPath brand palette — Phase 9: forest green / wine / purple / ivory / terracotta
        // Primary forest green anchors the brand; wine/burgundy for depth; purple for accents.
        primary: {
          50: '#f0f6f4',
          100: '#dce9e2',
          200: '#b9d2ca',
          300: '#96b9b1',
          400: '#73a198',
          500: '#50897f',
          600: '#315f50',   /* primary forest green */
          700: '#23483d',   /* deep green */
          800: '#1d372e',
          900: '#142622',
          950: '#0a1714',
        },
        // Wine / burgundy family — secondary brand depth
        wine: {
          50: '#f7eef1',
          100: '#eadfe6',
          200: '#d5bdcf',
          300: '#c0a5b7',
          400: '#aa8da0',
          500: '#702f45',   /* wine / burgundy */
          600: '#4d2032',   /* deep wine */
          700: '#3d1928',
          800: '#2d131d',
          900: '#1e0d13',
        },
        // Muted purple family — accent depth
        purple: {
          50: '#f2f0f5',
          100: '#e7e3ec',
          200: '#cfc6dd',
          300: '#b7a9cf',
          400: '#9f8cc2',
          500: '#76618f',   /* muted purple */
          600: '#514365',   /* deep purple */
          700: '#403451',
          800: '#30263d',
          900: '#1e0d13',
        },
        // Semantic tokens for surfaces, text and status. Kept flat so class
        // names read as `bg-success-bg`, `text-danger-text`, `bg-canvas` etc.
        canvas: '#f7f4ee',        /* warm off-white page background */
        surface: '#fffefa',       /* warm white surface */
        'surface-subtle': '#faf8f5',

        ink: '#292c2a',           /* primary text */
        body: '#3a3d39',          /* body text */
        // IMPORTANT: these three values must stay byte-identical to the
        // `@theme` block in src/styles/globals.css (which overrides this
        // file under Tailwind v4). The 2026-11 contrast audit raised
        // secondary/muted to AA-safe greys; keeping the JS copy in sync
        // prevents a silent regression if resolution order ever changes.
        secondary: '#6b6a66',     /* secondary text (AA on canvas) */
        muted: '#6f6e69',         /* muted text (AA on canvas) */

        line: '#e6e0d7',          /* borders */
        'line-input': '#b9b1a8',
        'line-input-hover': '#8c8a87',

        // Terracotta accent for marketing CTAs (owner reference: "terracotta
        // primary actions"). Distinct from danger red so CTAs never read as errors.
        accent: {
          50: '#fbf1ec',
          100: '#f5ddd1',
          500: '#c4592f',
          600: '#a9471f',   /* AA on white for text and white-on-fill */
          700: '#8c3a19',
        },

        'success-text': '#315f50',   /* forest green */
        'success-bg': '#f0faf6',
        'success-border': '#b9d2ca',

        'warning-text': '#92400e',   /* muted gold */
        'warning-bg': '#fffbeb',
        'warning-border': '#fde68a',

        'danger-text': '#b4432a',   /* deep terracotta — 5.4:1 on danger-bg (AA) */
        'danger-bg': '#fdf2ef',
        'danger-border': '#f1c6b9',
        'danger-solid': '#dc2626',
        'danger-solid-hover': '#b91c1c',

        'info-text': '#514365',    /* deep purple */
        'info-bg': '#f2f0f5',
        'info-border': '#d5bdcf',

        'neutral-text': '#3a3d39',
        'neutral-bg': '#f3f4f6',
        'neutral-border': '#e5e7eb',

        'gold-text': '#92400e',      /* muted gold */
        'gold-bg': '#fffbeb',
        'gold-border': '#fde68a',
      },
      fontFamily: {
        // Self-hosted via next/font (see app/layout.tsx); system stack as fallback.
        sans: [
          'var(--font-inter)',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans"',
          'sans-serif',
        ],
      },
      boxShadow: {
        // Softer, deliberate elevation for cards…
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.05)',
        // …for raised panels and popovers…
        panel: '0 6px 16px -6px rgb(15 23 42 / 0.10)',
        // …and a grounded drop for dialogs.
        dialog: '0 20px 50px -12px rgb(13 26 48 / 0.35)',
      },
      maxWidth: {
        // Reading-friendly content measure for forms and prose.
        prose: '65ch',
      },
    },
  },
  plugins: [],
};
