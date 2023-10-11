#!/usr/bin/env node --loader tsx

import { runTasks, getDfxConfig, generateDeclarations } from "../dist/dfx"
import fs from "fs"
import path from "path"

;(async () => {
  // const appDirectory = fs.realpathSync(process.cwd())
  // const { default: dfxConfig } = await import(await path.resolve(appDirectory, configPath))
  const dfxConfig = await getDfxConfig()
  const tasks = process.argv.slice(2)
  try {
    await runTasks(dfxConfig, tasks)
    await generateDeclarations(dfxConfig)
  } catch (e) {
    console.log("Error deploying", e)
  }
  console.log("Done")
})()
