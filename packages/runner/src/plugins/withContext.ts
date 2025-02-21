import { Effect } from "effect"
import type { Scope, Plugin, PreTaskTree, ICEContext } from "../types"

export const withContext = (
  root: PreTaskTree | ((ctx: ICEContext) => PreTaskTree),
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
