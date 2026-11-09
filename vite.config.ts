import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './', // works under the GitHub Pages /repo/ path
  plugins: [svelte()],
  test: { include: ['src/**/*.test.ts'] },
});
