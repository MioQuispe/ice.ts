#!/usr/bin/env -S tsx

import { runTasks } from "../dist/index.mjs";
// const appDirectory = fs.realpathSync(process.cwd())
// const { default: dfxConfig } = await import(await path.resolve(appDirectory, configPath))
// ;(async() => {

// await new Promise((res) => setTimeout(res, 1000))
console.log("blaaaaaaaa")
const tasks = process.argv.slice(2)
try {
  await runTasks(tasks)
} catch (e) {
  console.log("Error deploying", e)
}
