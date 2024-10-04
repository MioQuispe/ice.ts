#!/usr/bin/env node --import tsx

import { runTasks, getDfxConfig } from "../dist"
import fs from "fs"
import path from "path"

  ;(async () => {
  // const appDirectory = fs.realpathSync(process.cwd())
  // const { default: dfxConfig } = await import(await path.resolve(appDirectory, configPath))
  const dfxConfig = await getDfxConfig()
  const tasks = process.argv.slice(2)
  try {
    await runTasks(dfxConfig, tasks)
    // await generateDeclarations(dfxConfig)
  } catch (e) {
    console.log("Error deploying", e)
  }
  console.log("Done")
})()
