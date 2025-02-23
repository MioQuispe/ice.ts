import { Effect } from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import { filterNodes } from "./lib.js"
import { Tags } from "../builders/types.js"

export const listTasksTask = () =>
  Effect.gen(function* () {
    // TODO: remove builders
    const { taskTree } = yield* ICEConfigService
    const tasksWithPath = yield* filterNodes(
      taskTree,
      (node) => node._tag === "task" && !node.tags.includes(Tags.CANISTER),
    )
    // TODO: format nicely
    const taskList = tasksWithPath.map(({ node: task, path }) => {
      const taskPath = path.join(":") // Use colon to represent hierarchy
      return `  ${taskPath}` // Indent for better readability
    })

    // const formattedTaskList = ["Available tasks:", ...taskList].join("\n")

    // yield* Effect.logDebug(formattedTaskList)
    return taskList
  })