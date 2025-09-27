import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config = {
  content: ['./app/**/*.{ts,tsx,mdx}', './src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {}
  },
  plugins: [typography]
} satisfies Config;

export default config;
