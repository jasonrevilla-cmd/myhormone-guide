/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#EEF2F7',
          100: '#D4DFF0',
          200: '#A9BFE0',
          300: '#7E9FD1',
          400: '#537FC1',
          500: '#2D5FA8',
          600: '#1A3C5E',
          700: '#152F4A',
          800: '#0F2236',
          900: '#0A1623',
        },
        teal: {
          50:  '#E8F7F6',
          100: '#C5EAE8',
          200: '#8BD5D1',
          300: '#51C0BB',
          400: '#2A9D8F',
          500: '#1E8075',
          600: '#16625A',
          700: '#0F4540',
          800: '#082826',
          900: '#040C0B',
        },
        warm: {
          50:  '#FDF8F0',
          100: '#FAF0DC',
          200: '#F4E0BA',
          300: '#EDD098',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: theme('colors.gray.700'),
            maxWidth: '70ch',
            a: {
              color: theme('colors.teal.400'),
              textDecoration: 'underline',
              textDecorationColor: theme('colors.teal.200'),
              '&:hover': {
                color: theme('colors.navy.600'),
                textDecorationColor: theme('colors.navy.300'),
              },
            },
            h1: { color: theme('colors.navy.600'), fontWeight: '700' },
            h2: { color: theme('colors.navy.600'), fontWeight: '600' },
            h3: { color: theme('colors.navy.700'), fontWeight: '600' },
            h4: { color: theme('colors.navy.700') },
            strong: { color: theme('colors.navy.700') },
            blockquote: {
              borderLeftColor: theme('colors.teal.400'),
              backgroundColor: theme('colors.teal.50'),
              padding: '1rem 1.5rem',
              borderRadius: '0 0.5rem 0.5rem 0',
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            code: {
              backgroundColor: theme('colors.navy.50'),
              color: theme('colors.navy.700'),
              padding: '0.125rem 0.375rem',
              borderRadius: '0.25rem',
              fontWeight: '500',
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
