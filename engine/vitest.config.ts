import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Only the admin component tests need it; the plugin is inert for the rest.
  plugins: [react()],
  test: {
    /**
     * Node by default. The admin screens are tested in a browser-like
     * environment, which each of those files asks for with a
     * `@vitest-environment jsdom` docblock — one runner, no second config.
     */
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],

  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` is a build-time guard for the Next bundler. Under the
      // test runner there is no client graph to protect, so it resolves to a
      // no-op rather than throwing.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
});
