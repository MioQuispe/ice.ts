import { Opt } from "../types"
import * as url from "node:url"
import path from "node:path"
import { customCanister } from "@ice.ts/runner"
import type { TaskCtxShape } from "@ice.ts/runner"
import { Principal } from "@dfinity/principal"
import type { InitArgs, _SERVICE } from "./dip721.did.d"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

type DIP721InitArgs = {
  custodians?: Array<string>
  logo?: string
  name?: string
  symbol?: string
  canisterId?: string
}

const canisterName = "dip721"

export const DIP721 = (
  initArgsOrFn?: DIP721InitArgs | ((args: { ctx: TaskCtxShape }) => DIP721InitArgs),
) => {
  return customCanister<[Opt<InitArgs>], _SERVICE>(({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn({ ctx }) : initArgsOrFn
    return {
      canisterId: initArgs.canisterId,
      wasm: path.resolve(__dirname, `./${canisterName}/${canisterName}.wasm.gz`),
      candid: path.resolve(__dirname, `./${canisterName}/${canisterName}.did`),
    }
  }).installArgs(async ({ ctx, mode }) => {
      // TODO: optional cap canister?
      // dependencies: [...providers],
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn({ ctx }) : initArgsOrFn
    // TODO: proper types
    return [Opt({
        // custodians: Opt(initArgs.custodians?.map((p) => Principal.fromText(p))),
        custodians: Opt(),
        logo: Opt(initArgs.logo),
        name: Opt(initArgs.name),
        symbol: Opt(initArgs.symbol),
      })]
  })
}

// TODO:
//   _metadata: {
//   standard: "icrc1",
// },
