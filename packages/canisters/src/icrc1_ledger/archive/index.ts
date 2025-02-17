import path from "node:path"
import type { TaskCtxShape } from "@crystal/runner"
import { customCanister } from "@crystal/runner"
import type { ICRC1ArchiveInitArgs } from "./index"
import type { ArchiveArg } from "./icrc1_archive.types"
import type { _SERVICE } from "./icrc1_archive.did"

const canisterName = "icrc1_ledger_archive"

// TODO: implement this
export const ICRC1Archive = (
  initArgsOrFn:
    | ICRC1ArchiveInitArgs
    | ((args: { ctx: TaskCtxShape }) => ICRC1ArchiveInitArgs),
) => {
  return customCanister<[ArchiveArg], _SERVICE>(({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn({ ctx }) : initArgsOrFn
    return {
      canisterId: initArgs.canisterId,
      wasm: path.resolve(__dirname, `./${canisterName}/${canisterName}.wasm`),
      candid: path.resolve(__dirname, `./${canisterName}/${canisterName}.did`),
    }
  })
}