import { Effect } from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import { filterNodes, type ProgressUpdate } from "./lib.js"
import { runTasks } from "./run.js"
import { Tags } from "../builders/types.js"
import type { Task } from "../types/types.js"

export const canistersBindingsTask = (progressCb?: (update: ProgressUpdate<unknown>) => void) =>
  Effect.gen(function* () {
    yield* Effect.logDebug("Running canisters:bindings")
    const { taskTree } = yield* ICEConfigService
    const tasksWithPath = (yield* filterNodes(
      taskTree,
      (node) =>
        node._tag === "task" &&
        node.tags.includes(Tags.CANISTER) &&
        node.tags.includes(Tags.BINDINGS),
    )) as Array<{ node: Task, path: string[] }>
    yield* runTasks(tasksWithPath.map(({ node }) => node), progressCb)
  })
