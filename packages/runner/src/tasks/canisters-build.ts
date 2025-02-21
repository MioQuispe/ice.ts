import { Effect } from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import { filterTasks } from "./lib.js"
import { runTaskByPath } from "./run.js"
import { Tags } from "../builders/types.js"


export const canistersBuildTask = () =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Running canisters:build")
    const { taskTree } = yield* ICEConfigService
    const tasksWithPath = yield* filterTasks(
      taskTree,
      (node) =>
        node._tag === "task" &&
        node.tags.includes(Tags.CANISTER) &&
        node.tags.includes(Tags.BUILD),
    )
    yield* Effect.forEach(
      tasksWithPath,
      ({ path }) => runTaskByPath(path.join(":")),
      { concurrency: "unbounded" },
    )
  })