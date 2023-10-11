import * as url from "url"
import path from "path"
import { Principal } from "@dfinity/principal"
import { InitArg as EgoOpsInitArg } from "./ego_ops/ego_ops"
import { InitArg as EgoLedgerInitArg } from "./ego_ledger/ego_ledger"
import { InitArg as EgoStoreInitArg } from "./ego_store/ego_store"
import { InitArg as EgoDevInitArg } from "./ego_dev/ego_dev"
import { InitArg as EgoAssetsInitArg } from "./ego_assets/ego_assets"
import { InitArg as EgoTenantInitArg } from "./ego_tenant/ego_tenant"
import { InitArg as EgoFileInitArg } from "./ego_file/ego_file"
import { Opt } from "../types"
import type { ExtendedCanisterConfiguration } from "@dfx-js/core"


const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

type EgoInitArgs = {}
const canisterName = "ego"
export const Ego = (args: EgoInitArgs) => ({
  type: "custom",
  candid: path.resolve(__dirname, "./ego/ego.did"),
  wasm: path.resolve(__dirname, "./ego/ego.wasm"),
  build: "",
  _metadata: {
    // standard: "DIP20",
  },
  dfx_js: {
    args: [],
  },
})

type EgoAssetsInitArgs = {
  init_caller: string
}
const egoAssetsCanisterName = "ego_assets"
export const EgoAssets = (args: EgoAssetsInitArgs): ExtendedCanisterConfiguration => ({
  type: "custom",
  candid: path.resolve(__dirname, `./ego/${egoAssetsCanisterName}/${egoAssetsCanisterName}.did`),
  wasm: path.resolve(__dirname, `./ego/${egoAssetsCanisterName}/${egoAssetsCanisterName}.wasm`),
  build: "",
  _metadata: {
    // standard: "DIP20",
  },
  dfx_js: {
    args: [{ init_caller: Opt(Principal.from(args.init_caller)) }] as EgoAssetsInitArg[],
  },
})

type EgoDevInitArgs = {
  init_caller: string
}
const egoDevCanisterName = "ego_dev"
export const EgoDev = (args: EgoDevInitArgs): ExtendedCanisterConfiguration => ({
  type: "custom",
  candid: path.resolve(__dirname, `./ego/${egoDevCanisterName}/${egoDevCanisterName}.did`),
  wasm: path.resolve(__dirname, `./ego/${egoDevCanisterName}/${egoDevCanisterName}.wasm`),
  build: "",
  _metadata: {
    // standard: "DIP20",
  },
  dfx_js: {
    args: [{ init_caller: Opt(Principal.from(args.init_caller)) }] as EgoDevInitArg[],
  },
})

type EgoFileInitArgs = {
  init_caller: string
}
const egoFileCanisterName = "ego_file"
export const EgoFile = (args: EgoFileInitArgs): ExtendedCanisterConfiguration => ({
  type: "custom",
  candid: path.resolve(__dirname, `./ego/${egoFileCanisterName}/${egoFileCanisterName}.did`),
  wasm: path.resolve(__dirname, `./ego/${egoFileCanisterName}/${egoFileCanisterName}.wasm`),
  build: "",
  _metadata: {
    // standard: "DIP20",
  },
  dfx_js: {
    args: [{ init_caller: Opt(Principal.from(args.init_caller)) }] as EgoFileInitArg[],
  },
})

type EgoLedgerInitArgs = {
  init_caller: string
}
const egoLedgerCanisterName = "ego_ledger"
export const EgoLedger = (args: EgoLedgerInitArgs): ExtendedCanisterConfiguration => ({
  type: "custom",
  candid: path.resolve(__dirname, `./ego/${egoLedgerCanisterName}/${egoLedgerCanisterName}.did`),
  wasm: path.resolve(__dirname, `./ego/${egoLedgerCanisterName}/${egoLedgerCanisterName}.wasm`),
  build: "",
  _metadata: {
    // standard: "DIP20",
  },
  dfx_js: {
    args: [{ init_caller: Opt(Principal.from(args.init_caller)) }] as EgoLedgerInitArg[],
  },
})

type EgoOpsInitArgs = {
  init_caller: string
}
const egoOpsCanisterName = "ego_ops"
export const EgoOps = (args: EgoOpsInitArgs): ExtendedCanisterConfiguration => ({
  type: "custom",
  candid: path.resolve(__dirname, `./ego/${egoOpsCanisterName}/${egoOpsCanisterName}.did`),
  wasm: path.resolve(__dirname, `./ego/${egoOpsCanisterName}/${egoOpsCanisterName}.wasm`),
  build: "",
  _metadata: {
    // standard: "DIP20",
  },
  dfx_js: {
    args: [{ init_caller: Opt(Principal.from(args.init_caller)) }] as EgoOpsInitArg[],
  },
})

type EgoStoreInitArgs = {
  init_caller: string
}
const egoStoreCanisterName = "ego_store"
export const EgoStore = (args: EgoStoreInitArgs): ExtendedCanisterConfiguration => ({
  type: "custom",
  candid: path.resolve(__dirname, `./ego/${egoStoreCanisterName}/${egoStoreCanisterName}.did`),
  wasm: path.resolve(__dirname, `./ego/${egoStoreCanisterName}/${egoStoreCanisterName}.wasm`),
  build: "",
  _metadata: {
    // standard: "DIP20",
  },
  dfx_js: {
    args: [{ init_caller: Opt(Principal.from(args.init_caller)) }] as EgoStoreInitArg[],
  },
})

type EgoTenantInitArgs = {
  init_caller: string
}
const egoTenantCanisterName = "ego_tenant"
export const EgoTenant = (args: EgoTenantInitArgs): ExtendedCanisterConfiguration => ({
  type: "custom",
  candid: path.resolve(__dirname, `./ego/${egoTenantCanisterName}/${egoTenantCanisterName}.did`),
  wasm: path.resolve(__dirname, `./ego/${egoTenantCanisterName}/${egoTenantCanisterName}.wasm`),
  build: "",
  _metadata: {
    // standard: "DIP20",
  },
  dfx_js: {
    args: [{ init_caller: Opt(Principal.from(args.init_caller)) }] as EgoTenantInitArg[],
  },
})

export const EgoCanisters = (init_caller) => ({
  // TODO: how to depend on previous canisters/scripts?
  ego_ops: { config: EgoOps({ init_caller }) },
  ego_assets: { config: EgoAssets({ init_caller }) },
  ego_dev: { config: EgoDev({ init_caller }) },
  ego_file: { config: EgoFile({ init_caller }) },
  ego_store: { config: EgoStore({ init_caller }) },
  ego_tenant: { config: EgoTenant({ init_caller }) },
  ego_ledger: { config: EgoLedger({ init_caller }) },
})

// TODO: ?
EgoCanisters.setup = {
  dependencies: [
    "canisters:ego_ops",
    "canisters:ego_assets",
    "canisters:ego_dev",
    "canisters:ego_file",
    "canisters:ego_store",
    "canisters:ego_tenant",
    "canisters:ego_ledger",
  ],
  fn: async (deps) => {
    console.log("EgoCanisters.setup", deps)
    const { ego_ops, ego_dev, ego_file, ego_store, ego_tenant, ego_ledger }: {
      ego_ops: {
        actor: import("./ego_ops/ego_ops")._SERVICE,
        canisterId: string
      },
      ego_dev: {
        actor: import("./ego_dev/ego_dev")._SERVICE,
        canisterId: string
      },
      ego_file: {
        actor: import("./ego_file/ego_file")._SERVICE,
        canisterId: string
      },
      ego_store: {
        actor: import("./ego_store/ego_store")._SERVICE,
        canisterId: string
      },
      ego_tenant: {
        actor: import("./ego_tenant/ego_tenant")._SERVICE,
        canisterId: string
      },
      ego_ledger: {
        actor: import("./ego_ledger/ego_ledger")._SERVICE,
        canisterId: string
      },
    } = deps
    const ego_ops_id = ego_ops.canisterId

    const egoCanisters = [
      { canisterId: ego_file.canisterId, canisterName: "ego_file" },
      { canisterId: ego_store.canisterId, canisterName: "ego_store" },
      { canisterId: ego_tenant.canisterId, canisterName: "ego_tenant" },
      { canisterId: ego_ledger.canisterId, canisterName: "ego_ledger" },
      { canisterId: ego_dev.canisterId, canisterName: "ego_dev" },
    ]
    console.log(`1. register canisters\n`)
    for await(const { canisterId, canisterName } of egoCanisters) {
      console.log(`==> a. add ego_ops as ${canisterId} owner\n`)
      let resp1 = await ego_ops.actor.ego_owner_add(Principal.from(ego_ops_id))
      console.log(resp1)
      console.log(`==> b. register ${canisterId} to ego_ops\n`)
      let resp2 = await ego_ops.actor.ego_canister_add(canisterName, Principal.from(canisterId))
      console.log(resp2)
    }
    console.log(`2. canister_relation_update\n`)
    for await(const { canisterId, canisterName } of egoCanisters) {
      await ego_ops.actor.canister_relation_update(canisterName)
    }

    console.log(`3. canister_main_track\n`)
    await ego_ops.actor.canister_main_track()
  },
}