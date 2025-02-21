import path from "node:path"
import type { ExtendedCanisterConfiguration } from "../types"
import { Opt } from "../types"
import * as url from "node:url"
import { Actor, HttpAgent } from "@dfinity/agent"
import { idlFactory } from "./assets.did"
import { CreateProps } from "../types"


const __filename = url.fileURLToPath(import.meta.url)
const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

type InitArgs = {
  owner: string
}

const AssetsIds = {
  // local: "rdmx6-jaaaa-aaaaa-aaadq-cai",
  // ic: "rdmx6-jaaaa-aaaaa-aaadq-cai",
}

export const Assets = ({ owner }: InitArgs): ExtendedCanisterConfiguration => {
  // TODO: init args

  // TODO: return config
  // - get paths
  return {
    type: "custom",
    candid: path.resolve(__dirname, "./assets/assets.did"),
    wasm: path.resolve(__dirname, "./assets/assets.wasm.gz"),
    build: "",
    // remote: {
    //   id: AssetsIds,
    // },

    // TODO:
    dfx_js: {
      // opt record {assigned_user_number_range:record {nat64; nat64}}
      args: [Opt(null)],
      // mode: "reinstall"
    },
  }
}

Assets.id = AssetsIds

Assets.idlFactory = idlFactory

Assets.scripts = {}

export type AssetsActor = import("@dfinity/agent").ActorSubclass<import("./assets.types")._SERVICE>
