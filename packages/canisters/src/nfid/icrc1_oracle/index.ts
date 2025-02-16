import { customCanister, Opt } from "@crystal/runner"
import * as url from "node:url"
import path from "node:path"
import type { TaskCtxShape } from "@crystal/runner"
import type { _SERVICE } from "./icrc1_oracle.types.js"
import { Principal } from "@dfinity/principal"
import { NFIDIdentityManager } from "../identity_manager/index.js"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))
const canisterName = "icrc1_oracle"

// const Conf = IDL.Record({
//   'controllers' : IDL.Opt(IDL.Vec(IDL.Principal)),
//   'im_canister' : IDL.Opt(IDL.Principal),
// });
// return [IDL.Opt(Conf)];
type InitArgs = {
  controllers: [Principal[]] | []
  im_canister: [Principal] | []
}

type NFIDIcrc1OracleInitArgs = {
  canisterId?: string
}

/**
 * Creates an instance of the Icrc1Oracle canister.
 * @param initArgsOrFn Initialization arguments or a function that returns them.
 * @returns A canister instance.
 */
export const NFIDIcrc1Oracle = (
  initArgsOrFn?:
    | NFIDIcrc1OracleInitArgs
    | ((ctx: TaskCtxShape) => NFIDIcrc1OracleInitArgs),
) =>
  customCanister<[Opt<InitArgs>], _SERVICE>((ctx) => {
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn(ctx) : initArgsOrFn
    return {
      canisterId: initArgs?.canisterId,
      wasm: path.resolve(__dirname, `./nfid/${canisterName}/${canisterName}.wasm`),
      candid: path.resolve(__dirname, `./nfid/${canisterName}/${canisterName}.did`),
    }
  })
    .deps({ NFIDIdentityManager })
    .install(async ({ ctx, mode }) => {
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn(ctx) : initArgsOrFn
      // TODO: Add installation logic if needed.
      const imCanister = Principal.fromText(
        ctx.dependencies.NFIDIdentityManager.canisterId,
      )
      return [
        Opt({
          controllers: [],
          im_canister: [imCanister],
        }),
      ]
    })
