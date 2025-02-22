import { defineConfig } from 'tsup';

/**
 * tsup configuration for the @ice.ts/canisters package.
 *
 * This config:
 * - Bundles the code starting from src/index.ts
 * - Outputs the bundle as dist/bundle.js (because the entry is named "bundle")
 * - Uses ESM format with sourcemaps enabled
 * - Cleans the output directory before building
 */
export default defineConfig({
  entry: {
    bundle: 'src/index.ts' // Entry keyed as "bundle" to output "bundle.js"
  },
  outDir: 'dist',
  format: ['esm'],
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  external: ['@ice.ts/runner'],
  esbuildOptions(options) {
    options.loader = {
      ...options.loader,
      '.wasm': 'file'
    };
  }
}); 