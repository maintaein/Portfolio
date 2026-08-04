import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.test.{ts,tsx}'],
  },
  resolve: {
    // tsconfig.json의 "@/*": ["./*"]와 동일하게 맞춘다
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
