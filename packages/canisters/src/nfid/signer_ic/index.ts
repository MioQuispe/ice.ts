import { customCanister } from "@crystal/runner";
import * as url from "node:url";
import path from "node:path";
import type { TaskCtxShape } from "@crystal/runner";
import type { _SERVICE } from "./signer_ic.types.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const canisterName = "signer_ic";

type InitArgs = []
/**
 * Creates an instance of the SignerIc canister.
 * @param initArgsOrFn Initialization arguments or a function returning them.
 * @returns A canister instance.
 */
export const NFIDSignerIc = (
  initArgsOrFn?: { canisterId?: string } | ((args: { ctx: TaskCtxShape }) => { canisterId?: string }),
) =>
  customCanister<InitArgs, _SERVICE>(({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn({ ctx }) : initArgsOrFn;
    return {
      canisterId: initArgs?.canisterId,
      wasm: path.resolve(__dirname, `./nfid/${canisterName}/${canisterName}.wasm`),
      candid: path.resolve(__dirname, `./nfid/${canisterName}/${canisterName}.did`),
    };
  }).install(async ({ ctx, mode }) => {
    // TODO: Add installation logic if needed.
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn({ ctx }) : initArgsOrFn
    return [];
  }); 