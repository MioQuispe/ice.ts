import type { TaskTree, Scope, ICEConfig } from "../types/types.js"

// export * from "./custom.js"
export * from "./motoko.js"
export * from "./task.js"
export * from "./custom.js"
export * from "./scope.js"


// is this where we construct the runtime / default environment?
// TODO: can we make this async as well?
export const ICE = (config?: ICEConfig) => {
  // TODO: rename ctx to runtime or config or something??
  return (
    config ??
    {
      // TODO: dfx defaults etc.
    }
  )
}