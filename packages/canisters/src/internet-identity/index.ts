import path from "node:path"
import { Opt } from "../types"
import * as url from "node:url"
import type { ActorSubclass } from "@dfinity/agent"
import { idlFactory } from "./internet_identity.did"
import type { InternetIdentityInit } from "./internet_identity.types"
import { Crystal, type TaskCtxShape } from "@crystal/runner"

const crystal = Crystal()

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

const InternetIdentityIds = {
  local: "rdmx6-jaaaa-aaaaa-aaadq-cai",
  ic: "rdmx6-jaaaa-aaaaa-aaadq-cai",
}

export type CanisterInitArgs = [Opt<{
  assigned_user_number_range : [bigint, bigint],
}>]

type InitArgs = {
  owner: string
  assignedUserNumberRange: [bigint, bigint]
}
export const InternetIdentity = (
  initArgs: InitArgs
) => {
  return crystal
    .customCanister<CanisterInitArgs>({
      canisterId: InternetIdentityIds.local,
      candid: path.resolve(
        __dirname,
        "./internet-identity/internet_identity.did",
      ),
      wasm: path.resolve(
        __dirname,
        "./internet-identity/internet_identity.wasm",
      ),
    })
    .install(async ({ mode }) => {
      // TODO: automatic types for actor?
      // TODO: do we need to install the canister here also?
      if (mode === "install" || mode === "reinstall") {
        const args: InternetIdentityInit = {
          assigned_user_number_range: initArgs.assignedUserNumberRange,
        }
        return [Opt(args)]
      }
      // TODO: should be error, type is wrong!
      // if (mode === "reinstall") {
      //   return [Opt(initArgs.owner ?? null)]
      // }
      if (mode === "upgrade") {
        // return [Opt(initArgs.owner ?? null)]
      }
      // -m, --mode <MODE>
      // Specifies the mode of canister installation.
      // If set to 'auto', either 'install' or 'upgrade' will be used, depending on whether the canister is already installed.
      // [possible values: install, reinstall, upgrade, auto]
    })
}

InternetIdentity.id = InternetIdentityIds

InternetIdentity.idlFactory = idlFactory

export type InternetIdentityActor = ActorSubclass<
  import("./internet_identity.types")._SERVICE
>

// InternetIdentity({ owner: "123", assignedUserNumberRange: [1n, 100n] }).install(async ({ mode, ctx }) => {
//   return [[{assigned_user_number_range: [1n, 100n]}]]
// })