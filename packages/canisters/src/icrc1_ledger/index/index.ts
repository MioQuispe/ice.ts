import path from "node:path"
import type { TaskCtxShape } from "@ice/runner"
import { customCanister } from "@ice/runner"
import type { ICRC1IndexInitArgs } from "./index"
import type { IndexArg } from "./icrc1_index.types"
import type { _SERVICE } from "./icrc1_index.did"

const canisterName = "icrc1_ledger_index"

// TODO: implement this
export const ICRC1Index = (
  initArgsOrFn:
    | ICRC1IndexInitArgs
    | ((args: { ctx: TaskCtxShape }) => ICRC1IndexInitArgs),
) => {
  return customCanister<[IndexArg], _SERVICE>(({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn({ ctx }) : initArgsOrFn
    return {
      canisterId: initArgs.canisterId,
      wasm: path.resolve(__dirname, `./${canisterName}/${canisterName}.wasm`),
      candid: path.resolve(__dirname, `./${canisterName}/${canisterName}.did`),
    }
  })
}