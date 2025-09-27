import type { Config } from 'tailwindcss';

const config = {
  content: ['./app/**/*.{ts,tsx,mdx}', './src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {}
  },
  plugins: {
    '@tailwindcss/typography': {}
  }
} satisfies Config;

export default config;
