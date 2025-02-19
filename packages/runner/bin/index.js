#!/usr/bin/env  node --experimental-wasm-modules --no-warnings=ExperimentalWarning

// import { runTasks, getDfxConfig } from "../dist"
// import fs from "node:fs"
// import path from "node:path"

//   ;(async () => {
//   const dfxConfig = await getDfxConfig()
//   const tasks = process.argv.slice(2)
//   try {
//     await runTasks(dfxConfig, tasks)
//     // await generateDeclarations(dfxConfig)
//   } catch (e) {
//     console.log("Error deploying", e)
//   }
//   console.log("Done")
// })()

import { runCli } from "../dist/index.js"

;(async () => {
  await runCli()
})()
