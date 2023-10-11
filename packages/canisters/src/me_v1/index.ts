import * as url from "url"
import path from "path"
// import { InitArg as EgoOpsInitArg } from "./me_e2e/me_e2e"
// import { InitArg as EgoLedgerInitArg } from "./ego_ledger/ego_ledger"
// import { InitArg as EgoStoreInitArg } from "./ego_store/ego_store"
// import { InitArg as EgoDevInitArg } from "./ego_dev/ego_dev"
// import { InitArg as EgoAssetsInitArg } from "./ego_assets/ego_assets"
// import { InitArg as EgoTenantInitArg } from "./ego_tenant/ego_tenant"
// import { InitArg as EgoFileInitArg } from "./ego_file/ego_file"
import type { ExtendedCanisterConfiguration } from "@dfx-js/core"
import { Principal } from "@dfinity/principal"


const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

type MeE2EInitArgs = {}
const meE2ECanisterName = "me_e2e"
const MeE2EIds = {
  "ic": "xys2p-nyaaa-aaaah-ac6uq-cai",
  "local": "xys2p-nyaaa-aaaah-ac6uq-cai",
}
// "me_e2e": {
//   "ic": "xys2p-nyaaa-aaaah-ac6uq-cai"
// },
export const MeE2E = (args: MeE2EInitArgs): ExtendedCanisterConfiguration => ({
  type: "custom",
  candid: path.resolve(__dirname, `./me_v1/${meE2ECanisterName}/${meE2ECanisterName}.did`),
  wasm: path.resolve(__dirname, `./me_v1/${meE2ECanisterName}/${meE2ECanisterName}_opt.wasm`),
  build: "",
  _metadata: {
    // standard: "DIP20",
  },
  // remote: {
  //   candid: path.resolve(__dirname, `./me_v1/${meE2ECanisterName}/${meE2ECanisterName}.did`),
  //   id: MeE2EIds,
  // },
  dfx_js: {
    canister_id: MeE2EIds,
    args: [] as MeE2EInitArgs[],
  },
})

type MeRecordInitArgs = {}
const meRecordCanisterName = "me_record"
const MeRecordIds = {
  "ic": "xrrrt-3qaaa-aaaah-ac6va-cai",
  "local": "xrrrt-3qaaa-aaaah-ac6va-cai",
}
// "me_record": {
//   "ic": "xrrrt-3qaaa-aaaah-ac6va-cai"
// },
export const MeRecord = (args: MeRecordInitArgs): ExtendedCanisterConfiguration => ({
  type: "custom",
  candid: path.resolve(__dirname, `./me_v1/${meRecordCanisterName}/${meRecordCanisterName}.did`),
  wasm: path.resolve(__dirname, `./me_v1/${meRecordCanisterName}/${meRecordCanisterName}_opt.wasm`),
  build: "",
  _metadata: {
    // standard: "DIP20",
  },
  // remote: {
  //   candid: path.resolve(__dirname, `./me_v1/${meRecordCanisterName}/${meRecordCanisterName}.did`),
  //   id: MeRecordIds,
  // },
  dfx_js: {
    canister_id: MeRecordIds,
    args: [] as MeRecordInitArgs[],
  },
})

type MeResolverArgs = {}
const meResolverCanisterName = "me_resolver"
const MeResolverIds = {
  "ic": "ws5yv-piaaa-aaaah-ac6tq-cai",
  "local": "ws5yv-piaaa-aaaah-ac6tq-cai",
}
// "me_resolver": {
//   "ic": "ws5yv-piaaa-aaaah-ac6tq-cai"
// },
export const MeResolver = (args: MeResolverArgs): ExtendedCanisterConfiguration => ({
  type: "custom",
  candid: path.resolve(__dirname, `./me_v1/${meResolverCanisterName}/${meResolverCanisterName}.did`),
  wasm: path.resolve(__dirname, `./me_v1/${meResolverCanisterName}/${meResolverCanisterName}_opt.wasm`),
  build: "",
  _metadata: {
    // standard: "DIP20",
  },
  // remote: {
  //   candid: path.resolve(__dirname, `./me_v1/${meResolverCanisterName}/${meResolverCanisterName}.did`),
  //   id: MeResolverIds,
  // },
  dfx_js: {
    canister_id: MeResolverIds,
    args: [] as MeResolverArgs[],
  },
})

type MeV1Args = {}
const meV1CanisterName = "me_v1"
const MeV1Ids = {
  "ic": "o3hfl-tiaaa-aaaah-abmda-cai",
  "local": "o3hfl-tiaaa-aaaah-abmda-cai",
}
// "me_v1": {
//   "ic": "o3hfl-tiaaa-aaaah-abmda-cai"
// },
export const MeV1 = (args: MeV1Args): ExtendedCanisterConfiguration => ({
  type: "custom",
  candid: path.resolve(__dirname, `./me_v1/${meV1CanisterName}/${meV1CanisterName}.did`),
  wasm: path.resolve(__dirname, `./me_v1/${meV1CanisterName}/${meV1CanisterName}_opt.wasm`),
  build: "",
  _metadata: {
    // standard: "DIP20",
  },
  // remote: {
  //   candid: path.resolve(__dirname, `./me_v1/${meV1CanisterName}/${meV1CanisterName}.did`),
  //   id: MeV1Ids,
  // },
  dfx_js: {
    canister_id: MeV1Ids,
    args: [] as MeV1Args[],
  },
})
MeV1.setup = async (deps) => {
  const { me_v1, me_e2e, me_resolver, me_record }: {
    me_v1: {
      actor: import("./me_v1/me_v1")._SERVICE,
      canisterId: string
    },
    me_e2e: {
      actor: import("./me_e2e/me_e2e")._SERVICE,
      canisterId: string
    },
    me_resolver: {
      actor: import("./me_resolver/me_resolver")._SERVICE,
      canisterId: string
    },
    me_record: {
      actor: import("./me_record/me_record")._SERVICE,
      canisterId: string
    },
  } = deps
  console.log("add me_resolver to me_v1");
  await me_v1.actor.ego_canister_add("me_resolver", Principal.from(MeResolverIds.local))
  // TODO: ego_user_add or ego_owner_add me_v1 to me_e2e?
  console.log("add me_e2e to me_v1");
  await me_v1.actor.ego_canister_add("me_e2e", Principal.from(MeE2EIds.local))
  console.log("add me_record to me_v1");
  await me_v1.actor.ego_canister_add("me_record", Principal.from(MeRecordIds.local))
  console.log("add me_v1 to me_e2e");
  await me_e2e.actor.ego_owner_add(Principal.from(me_v1.canisterId))
  console.log("add me_v1 to me_resolver");
  await me_resolver.actor.ego_owner_add(Principal.from(me_v1.canisterId))
  // await me_record.actor.ego_owner_add(Principal.from(me_v1.canisterId))
}

type MeWalletInitArgs = {}
const meWalletCanisterName = "me_wallet"
const MeWalletIds = {
  "ic": "xwqxh-wiaaa-aaaah-ac6vq-cai",
  "local": "xwqxh-wiaaa-aaaah-ac6vq-cai",
}
// "me_wallet": {
//   "ic": "xwqxh-wiaaa-aaaah-ac6vq-cai"
// },
export const MeWallet = (args: MeWalletInitArgs): ExtendedCanisterConfiguration => ({
  type: "custom",
  candid: path.resolve(__dirname, `./me_v1/${meWalletCanisterName}/${meWalletCanisterName}.did`),
  wasm: path.resolve(__dirname, `./me_v1/${meWalletCanisterName}/${meWalletCanisterName}_opt.wasm`),
  build: "",
  _metadata: {
    // standard: "DIP20",
  },
  // remote: {
  //   candid: path.resolve(__dirname, `./me_v1/${meWalletCanisterName}/${meWalletCanisterName}.did`),
  //   id: MeWalletIds,
  // },
  dfx_js: {
    canister_id: MeWalletIds,
    args: [] as MeWalletInitArgs[],
  },
})

type OmniWalletInitArgs = {}
const omniWalletCanisterName = "omni_wallet"
export const OmniWallet = (args: OmniWalletInitArgs): ExtendedCanisterConfiguration => ({
  type: "custom",
  candid: path.resolve(__dirname, `./me_v1/${omniWalletCanisterName}/${omniWalletCanisterName}.did`),
  wasm: path.resolve(__dirname, `./me_v1/${omniWalletCanisterName}/${omniWalletCanisterName}_opt.wasm`),
  build: "",
  _metadata: {
    // standard: "DIP20",
  },
  dfx_js: {
    args: [] as OmniWalletInitArgs[],
  },
})

// export const MeV1Canisters = (init_caller) => ({
//   // TODO: how to depend on previous canisters/scripts?
//   ego_ops: { config: EgoOps({ init_caller }) },
//   ego_assets: { config: EgoAssets({ init_caller }) },
//   ego_dev: { config: EgoDev({ init_caller }) },
//   ego_file: { config: EgoFile({ init_caller }) },
//   ego_store: { config: EgoStore({ init_caller }) },
//   ego_tenant: { config: EgoTenant({ init_caller }) },
//   ego_ledger: { config: EgoLedger({ init_caller }) },
// })

// // TODO: ?
// EgoCanisters.setup = {
//   dependencies: [
//     "canisters:ego_ops",
//     "canisters:ego_assets",
//     "canisters:ego_dev",
//     "canisters:ego_file",
//     "canisters:ego_store",
//     "canisters:ego_tenant",
//     "canisters:ego_ledger",
//   ],
//   fn: async (deps) => {
//     console.log("EgoCanisters.setup", deps)
//     const { ego_ops, ego_dev, ego_file, ego_store, ego_tenant, ego_ledger }: {
//       ego_ops: {
//         actor: import("./ego_ops/ego_ops")._SERVICE,
//         canisterId: string
//       },
//       ego_dev: {
//         actor: import("./ego_dev/ego_dev")._SERVICE,
//         canisterId: string
//       },
//       ego_file: {
//         actor: import("./ego_file/ego_file")._SERVICE,
//         canisterId: string
//       },
//       ego_store: {
//         actor: import("./ego_store/ego_store")._SERVICE,
//         canisterId: string
//       },
//       ego_tenant: {
//         actor: import("./ego_tenant/ego_tenant")._SERVICE,
//         canisterId: string
//       },
//       ego_ledger: {
//         actor: import("./ego_ledger/ego_ledger")._SERVICE,
//         canisterId: string
//       },
//     } = deps
//     const ego_ops_id = ego_ops.canisterId
//
//     const egoCanisters = [
//       { canisterId: ego_file.canisterId, canisterName: "ego_file" },
//       { canisterId: ego_store.canisterId, canisterName: "ego_store" },
//       { canisterId: ego_tenant.canisterId, canisterName: "ego_tenant" },
//       { canisterId: ego_ledger.canisterId, canisterName: "ego_ledger" },
//       { canisterId: ego_dev.canisterId, canisterName: "ego_dev" },
//     ]
//     console.log(`1. register canisters\n`)
//     for await(const { canisterId, canisterName } of egoCanisters) {
//       console.log(`==> a. add ego_ops as ${canisterId} owner\n`)
//       let resp1 = await ego_ops.actor.ego_owner_add(Principal.from(ego_ops_id))
//       console.log(resp1)
//       console.log(`==> b. register ${canisterId} to ego_ops\n`)
//       let resp2 = await ego_ops.actor.ego_canister_add(canisterName, Principal.from(canisterId))
//       console.log(resp2)
//     }
//     console.log(`2. canister_relation_update\n`)
//     for await(const { canisterId, canisterName } of egoCanisters) {
//       await ego_ops.actor.canister_relation_update(canisterName)
//     }
//
//     console.log(`3. canister_main_track\n`)
//     await ego_ops.actor.canister_main_track()
//   },
// }
