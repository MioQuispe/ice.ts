import { Opt } from "../types"
import * as url from "node:url"
import path from "node:path"
import { customCanister } from "@crystal/runner"
import type { TaskCtxShape } from "@crystal/runner"
import { Principal } from "@dfinity/principal"
import type { InitArgs } from "./dip721.did.d"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))
// const __dirname = url.fileURLToPath(import.meta.url)

// export const DIP721 = ({ custodians, logo, name, symbol }, override = { dfx_js: {} }): ExtendedCanisterConfiguration => ({
//   type: "custom",
//   wasm: path.resolve(__dirname, `./${canisterName}/${canisterName}.wasm`),
//   build: "",
//   // TODO: fix
//   candid: path.resolve(__dirname, `./${canisterName}/${canisterName}.did`),
//   // dependencies: [...providers],
//   _metadata: {
//     standard: "DIP721v2",
//   },
//   ...override,
//   dfx_js: {
//     ...override.dfx_js,
//     args: [
//       Opt({
//         custodians: Opt(custodians),
//         logo: Opt(logo),
//         name: Opt(name),
//         symbol: Opt(symbol),
//       }),
//     ],
//   },
// })

type DIP721InitArgs = {
  custodians?: Array<string>
  logo?: string
  name?: string
  symbol?: string
  canisterId?: string
}

const canisterName = "dip721"
export const DIP721 = (
  initArgsOrFn: DIP721InitArgs | ((ctx: TaskCtxShape) => DIP721InitArgs),
) => {
  return customCanister<InitArgs>((ctx) => {
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn(ctx) : initArgsOrFn
    return {
      canisterId: initArgs.canisterId,
      wasm: path.resolve(__dirname, `./${canisterName}/${canisterName}.wasm`),
      candid: path.resolve(__dirname, `./${canisterName}/${canisterName}.did`),
      // TODO: optional cap canister?
      // dependencies: [...providers],
    }
    // @ts-ignore
  }).install(async ({ ctx, mode }) => {
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn(ctx) : initArgsOrFn
    // TODO: proper types
    return [
      Opt({
        custodians: Opt(initArgs.custodians?.map((p) => Principal.fromText(p))),
        logo: Opt(initArgs.logo),
        name: Opt(initArgs.name),
        symbol: Opt(initArgs.symbol),
      }),
    ]
    // satisfies InitArgs
  })
}

// TODO:
//   _metadata: {
//   standard: "icrc1",
// },
