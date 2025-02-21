import { Effect } from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import { filterTasks } from "./lib.js"
import { Tags } from "../builders/types.js"

export const listCanistersTask = () =>
  Effect.gen(function* () {
    const { taskTree } = yield* ICEConfigService
    const tasksWithPath = yield* filterTasks(
      taskTree,
      (node) => node._tag === "task" && node.tags.includes(Tags.CANISTER),
    )

    // TODO: format nicely
    const taskList = tasksWithPath.map(({ task, path }) => {
      const taskPath = path.join(":") // Use colon to represent hierarchy
      return `  ${taskPath}` // Indent for better readability
    })

    const formattedTaskList = ["Available canister tasks:", ...taskList].join(
      "\n",
    )

    yield* Effect.logInfo(formattedTaskList)
  })