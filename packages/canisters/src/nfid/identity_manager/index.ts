import { Opt } from "@crystal/runner"
import * as url from "node:url"
import path from "node:path"
import { customCanister } from "@crystal/runner"
import type { TaskCtxShape } from "@crystal/runner"
import { Principal } from "@dfinity/principal"
import type { _SERVICE } from "./identity_manager.types.js"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

type NFIDIdentityManagerInitArgs = {
  canisterId?: string
}


const Ids = {
  local: "74gpt-tiaaa-aaaak-aacaa-cai",
  ic: "74gpt-tiaaa-aaaak-aacaa-cai",
}
// TODO:
type InitArgs = []

const canisterName = "identity_manager"

export const NFIDIdentityManager = (
  initArgsOrFn?: NFIDIdentityManagerInitArgs | ((args: { ctx: TaskCtxShape }) => NFIDIdentityManagerInitArgs),
) => {
  return customCanister<InitArgs, _SERVICE>(({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn({ ctx }) : initArgsOrFn
    return {
      canisterId: initArgs?.canisterId ?? Ids.local,
      wasm: path.resolve(__dirname, `./nfid/${canisterName}/${canisterName}.wasm`),
      candid: path.resolve(__dirname, `./nfid/${canisterName}/${canisterName}.did`),
    }
  }).install(async ({ ctx, mode }) => {
      // TODO: optional cap canister?
      // dependencies: [...providers],
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn({ ctx }) : initArgsOrFn
    // TODO: proper types
    return []
  })
}

NFIDIdentityManager.provides = NFIDIdentityManager().done().children.install

// TODO: initialize
// dfx canister call identity_manager configure '(record {env = opt "test"})'
