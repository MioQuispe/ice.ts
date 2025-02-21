import { Effect } from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import { filterTasks } from "./lib.js"

export const listTasksTask = () =>
  Effect.gen(function* () {
    // TODO: remove builders
    const { taskTree } = yield* ICEConfigService
    const tasksWithPath = yield* filterTasks(
      taskTree,
      (node) => node._tag === "task",
    )
    // TODO: format nicely
    const taskList = tasksWithPath.map(({ task, path }) => {
      const taskPath = path.join(":") // Use colon to represent hierarchy
      return `  ${taskPath}` // Indent for better readability
    })

    const formattedTaskList = ["Available tasks:", ...taskList].join("\n")

    yield* Effect.logInfo(formattedTaskList)
  })