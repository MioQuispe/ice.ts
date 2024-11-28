import { defineConfig } from 'vitest/config'
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  test: {
    testTimeout: 100000,
  },
  plugins: [wasm()],
})