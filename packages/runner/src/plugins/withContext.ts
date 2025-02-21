import { Effect } from "effect"
import type { TaskTree, ICEContext } from "../types/types.js"

export const withContext = (
  root: TaskTree | ((ctx: ICEContext) => TaskTree),
  // TODO: should we accept custom contexts as the 2nd arg?
  // customCtx?: any,
) => {
  return {
    transform: (ctx: ICEContext) => {
      if (typeof root === "function") {
        // TODO: do we need access to canister Ids? should that be part of the setup phase?
        // its async... and can fail. also canister_ids.json must be written. hmmm....
        const injectedRoot = root(ctx)
        return injectedRoot
      }
      return root
    },
    children: root,
  }
}
