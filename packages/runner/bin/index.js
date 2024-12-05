#!/usr/bin/env node --import tsx

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

import { runTasksEffect } from "../dist"

;(async () => {
  const tasks = process.argv.slice(2)
  await runTasksEffect(tasks)
})()
