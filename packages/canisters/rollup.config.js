import dts from "rollup-plugin-dts"
import esbuild from "rollup-plugin-esbuild"
import nodePolyfills from "rollup-plugin-polyfill-node"
// export default {
//   input: "./src/index.ts",
//   output: {
//     dir: "dist",
//   },
// }
//
export default [
  {
    input: `src/index.ts`,
    plugins: [
      esbuild({
        target: "node12",
      }),
    ],
    output: [
      {
        file: `dist/bundle.js`,
        format: "es",
        sourcemap: false,
        // exports: "default",
      },
    ],
  },
  {
    input: `src/index.ts`,
    plugins: [dts()],
    output: {
      file: `dist/bundle.d.ts`,
      format: "es",
    },
  },
]