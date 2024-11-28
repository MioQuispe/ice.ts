import path from "node:path"
import { idlFactory as capBucketIdlFactory } from "./cap-bucket/cap-bucket.did.js"
import { idlFactory as capRootIdlFactory } from "./cap-root/cap-root.did.js"
import { idlFactory as capRouterIdlFactory } from "./cap-router/cap-router.did.js"
import { idlFactory as capRouterTestIdlFactory } from "./cap-router-test/cap-router-test.did.js"
import type { ExtendedCanisterConfiguration } from "../types"

import { Principal } from "@dfinity/principal"
import * as url from "node:url"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

const CapBucketIds = {
  local: "r7inp-6aaaa-aaaaa-aaabq-cai",
  ic: "r7inp-6aaaa-aaaaa-aaabq-cai",
}

export type CapBucketActor = import("@dfinity/agent").ActorSubclass<import("./cap-bucket/types")._SERVICE>

type CapBucketInitArgs = {
  // offset: number
  // next_canisters: Array<number>
  // contract: Principal
}

export const CapBucket = (args: CapBucketInitArgs): ExtendedCanisterConfiguration => {
  // const {
  //   contract,  // Id   // Principal probably?
  //   offset = 0, // u64,
  //   next_canisters = [0], // Vec<BucketId>,
  // } = args
  return {
    type: "custom",
    candid: path.resolve(__dirname, "./cap/cap-bucket/cap-bucket.did"),
    wasm: path.resolve(__dirname, "./cap/cap-bucket/cap-bucket.wasm"),
    build: "",
    // args: [{
    //   contract, // TokenContractId,
    //   offset, // u64
    //   next_canisters, // Vec<BucketId>
    // }],
    // TODO:?
    // remote: {
    //   id: CapBucketIds,
    // },
    dfx_js: {
      canister_id: CapBucketIds,
      args: [],
    },
  }
}

CapBucket.id = CapBucketIds

CapBucket.idlFactory = capBucketIdlFactory

CapBucket.scripts = {}

///////////////////////

const CapRootIds = {
  local: "rrkah-fqaaa-aaaaa-aaaaq-cai",
  ic: "rrkah-fqaaa-aaaaa-aaaaq-cai",
}

export type CapRootActor = import("@dfinity/agent").ActorSubclass<import("./cap-root/types")._SERVICE>

type CapRootInitArgs = {
  // contract: Principal
  // writers: Array<Principal>
}

export const CapRoot = (args: CapRootInitArgs): ExtendedCanisterConfiguration => {
  // const {
  //   contract,
  //   writers,
  // } = args
  return {
    type: "custom",
    candid: path.resolve(__dirname, "./cap/cap-root/cap-root.did"),
    wasm: path.resolve(__dirname, "./cap/cap-root/cap-root.wasm"),
    build: "",
    // args: [
    //   contract, // Principal,
    //   writers, // BTreeSet<Principal>
    // ],
    // TODO: ?
    // remote: {
    //   id: CapRootIds,
    // },
    dfx_js: {
      canister_id: CapRootIds,
      args: [],
    },
  }
}

CapRoot.id = CapRootIds

CapRoot.idlFactory = capRootIdlFactory

CapRoot.scripts = {}

///////////////////////////////

const CapRouterIds = {
  local: "lj532-6iaaa-aaaah-qcc7a-cai",
  ic: "lj532-6iaaa-aaaah-qcc7a-cai",
}
export type CapRouterActor = import("@dfinity/agent").ActorSubclass<import("./cap-router/types")._SERVICE>

type CapRouterInitArgs = {}

export const CapRouter = (args?: CapRouterInitArgs, override = {}): ExtendedCanisterConfiguration => {
  return {
    type: "custom",
    candid: path.resolve(__dirname, "./cap/cap-router/cap-router.did"),
    wasm: path.resolve(__dirname, "./cap/cap-router/cap-router.wasm"),
    build: "",
    // remote: {
    //   id: CapRouterIds,
    // },
    dfx_js: {
      canister_id: CapRouterIds,
      // args: [],
    },
    ...override,
  }
}

CapRouter.id = CapRouterIds

CapRouter.idlFactory = capRouterIdlFactory

CapRouter.scripts = {}

//////////////////////////

const CapRouterTestIds = {
  local: "lhtux-ciaaa-aaaag-qakpa-cai",
  ic: "lhtux-ciaaa-aaaag-qakpa-cai",
}

type CapRouterTestInitArgs = {}

export const CapRouterTest = (args: CapRouterTestInitArgs): ExtendedCanisterConfiguration => {
  return {
    type: "custom",
    candid: path.resolve(__dirname, "./cap/cap-router-test/cap-router-test.did"),
    wasm: path.resolve(__dirname, "./cap/cap-router-test/cap-router-test.wasm"),
    build: "",
    // remote: {
    //   id: CapRouterTestIds,
    // },
    dfx_js: {
      canister_id: CapRouterTestIds,
      args: [],
    },
  }
}

CapRouterTest.id = CapRouterTestIds

CapRouterTest.idlFactory = capRouterTestIdlFactory

CapRouterTest.scripts = {}

export type CapRouterTestActor = import("@dfinity/agent").ActorSubclass<import("./cap-router-test/types")._SERVICE>
