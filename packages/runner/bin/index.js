#!/usr/bin/env  node --experimental-wasm-modules --no-warnings=ExperimentalWarning

import { runCli } from "../dist/index.js"

;(async () => {
  await runCli()
})()
