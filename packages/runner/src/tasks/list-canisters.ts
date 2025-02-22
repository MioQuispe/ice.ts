import { Effect } from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import { filterNodes } from "./lib.js"
import { Tags } from "../builders/types.js"

export const listCanistersTask = () =>
  Effect.gen(function* () {
    const { taskTree } = yield* ICEConfigService
    const canisterScopesWithPath = yield* filterNodes(
      taskTree,
      (node) => node._tag === "scope" && node.tags.includes(Tags.CANISTER),
    )

    // TODO: format nicely
    const canisterList = canisterScopesWithPath.map(({ node, path }) => {
      const scopePath = path.join(":") // Use colon to represent hierarchy
      return `  ${scopePath}` // Indent for better readability
    })

    // const formattedTaskList = ["Available canister tasks:", ...taskList].join(
    //   "\n",
    // )

    // yield* Effect.logInfo(formattedTaskList)
    return canisterList
  })