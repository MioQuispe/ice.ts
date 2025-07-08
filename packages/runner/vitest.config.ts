import wasm from 'vite-plugin-wasm';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 100000,
    coverage: {
      provider: "v8",
    },
  },
  plugins: [wasm()],
})