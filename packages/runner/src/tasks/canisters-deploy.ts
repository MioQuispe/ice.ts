import { Effect } from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import { executeSortedTasks, filterTasks, topologicalSortTasks } from "./lib.js"
import { Tags } from "../builders/types.js"
import type { Task } from "../types/types.js"

export const canistersDeployTask = () =>
  Effect.gen(function* () {
    const { taskTree } = yield* ICEConfigService
    const tasksWithPath = (yield* filterTasks(
      taskTree,
      (node) =>
        node._tag === "task" &&
        node.tags.includes(Tags.CANISTER) &&
        node.tags.includes(Tags.DEPLOY),
    )) as Array<{ task: Task; path: string[] }>
    // yield* Effect.forEach(
    //   tasksWithPath,
    //   ({ path }) => runTaskByPath(path.join(":")),
    //   { concurrency: "unbounded" },
    // )
    // yield* Effect.forEach(
    //   tasksWithPath.map(({ task }) => task),
    //   ({ path }) => runTaskByPath(path.join(":")),
    //   { concurrency: "unbounded" },
    // )
    const tasks = tasksWithPath.map(({ task }) => task)
    const sortedTasks = topologicalSortTasks(
      new Map(tasks.map((task) => [task.id, task])),
    )
    return executeSortedTasks(sortedTasks)
  })
