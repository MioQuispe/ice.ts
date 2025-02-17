import { customCanister, Opt } from "@crystal/runner"
import * as url from "node:url"
import path from "node:path"
import type { TaskCtxShape } from "@crystal/runner"
import type { _SERVICE } from "./icrc1_registry.types"
import { Principal } from "@dfinity/principal"
import { NFIDIdentityManager } from "../identity_manager/index.js"
const __dirname = url.fileURLToPath(new URL(".", import.meta.url))
const canisterName = "icrc1_registry"

type NFIDIcrc1RegistryInitArgs = {
  canisterId?: string
}
// const Conf = IDL.Record({ 'im_canister' : IDL.Opt(IDL.Text) });
// return [Conf];
type InitArgs = {
  im_canister: Opt<string>
}

/**
 * Creates an instance of the IcrcRegistry canister.
 * @param initArgsOrFn Initialization arguments or a function returning them.
 * @returns A canister instance.
 */
export const NFIDIcrc1Registry = (
  initArgsOrFn?:
    | NFIDIcrc1RegistryInitArgs
    | ((args: { ctx: TaskCtxShape }) => NFIDIcrc1RegistryInitArgs),
) =>
  customCanister<[InitArgs], _SERVICE>(({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn({ ctx }) : initArgsOrFn
    return {
      canisterId: initArgs?.canisterId,
      wasm: path.resolve(
        __dirname,
        `./nfid/${canisterName}/${canisterName}.wasm`,
      ),
      candid: path.resolve(
        __dirname,
        `./nfid/${canisterName}/${canisterName}.did`,
      ),
    }
  })
    .dependsOn({ NFIDIdentityManager })
    .install(async ({ ctx, mode }) => {
      // TODO: Add installation logic if needed.
      const initArgs =
        typeof initArgsOrFn === "function" ? initArgsOrFn({ ctx }) : initArgsOrFn
      return [
        {
          im_canister: Opt<string>(
            ctx.dependencies.NFIDIdentityManager.canisterId,
          ),
        },
      ]
    })
