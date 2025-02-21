import { Effect } from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import { filterTasks } from "./lib.js"
import { Tags } from "../builders/types.js"
import { runTaskByPath } from "./run.js"

export const canistersInstallTask = () =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Running canisters:install")
    const { taskTree } = yield* ICEConfigService
    const tasksWithPath = yield* filterTasks(
      taskTree,
      (node) =>
        node._tag === "task" &&
        node.tags.includes(Tags.CANISTER) &&
        node.tags.includes(Tags.INSTALL),
    )
    yield* Effect.forEach(
      tasksWithPath,
      ({ path }) => runTaskByPath(path.join(":")),
      { concurrency: "unbounded" },
    )
  })

