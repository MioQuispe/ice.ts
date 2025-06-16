import * as url from "node:url"
import path from "node:path"
import { Principal } from "@dfinity/principal"
import { customCanister, type TaskCtxShape } from "@ice.ts/runner"
import { CapRouter } from "../cap"
import type { _SERVICE } from "./candid_ui.types"
import { Effect } from "effect"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

// TODO: bigint?
type CanisterInitArgs = []

type InitArgs = {
  canisterId?: string
}

const canisterName = "candid_ui"

export const CandidUI = (
  initArgsOrFn?:
    | InitArgs
    | ((args: { ctx: TaskCtxShape }) => InitArgs)
    | ((args: { ctx: TaskCtxShape }) => Promise<InitArgs>),
) => {
  const result = customCanister<_SERVICE, CanisterInitArgs>(async ({ ctx }) => {
    let initArgs: InitArgs
    const initResult =
      typeof initArgsOrFn === "function" ? initArgsOrFn({ ctx }) : initArgsOrFn
    if (initResult instanceof Promise) {
      initArgs = await initResult
    } else {
      initArgs = initResult
    }
    return {
      canisterId: initArgs?.canisterId,
      wasm: path.resolve(__dirname, `./${canisterName}/${canisterName}.wasm.gz`),
      candid: path.resolve(__dirname, `./${canisterName}/${canisterName}.did`),
    }
  })
  .installArgs(async ({ ctx, mode }) => {
    let initArgs: InitArgs
    const initResult =
      typeof initArgsOrFn === "function" ? initArgsOrFn({ ctx }) : initArgsOrFn
    if (initResult instanceof Promise) {
      initArgs = await initResult
    } else {
      initArgs = initResult
    }
    return []
  })

  return result
}