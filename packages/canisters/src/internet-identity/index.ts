import path from "path"
import { Opt } from "../types"
import * as url from "url"
import { Actor, HttpAgent, ActorSubclass } from "@dfinity/agent"
import { idlFactory } from "./internet_identity.did"
import { CreateProps } from "../types"
import type { ExtendedCanisterConfiguration } from "@crystal/runner"


const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

type InitArgs = {
  owner: string
}

const InternetIdentityIds = {
  local: "rdmx6-jaaaa-aaaaa-aaadq-cai",
  ic: "rdmx6-jaaaa-aaaaa-aaadq-cai",
}

export const InternetIdentity = ({ owner }: InitArgs): ExtendedCanisterConfiguration => {
  // TODO: init args

  // TODO: return config
  // - get paths
  return {
    type: "custom",
    candid: path.resolve(__dirname, "./internet-identity/internet_identity.did"),
    wasm: path.resolve(__dirname, "./internet-identity/internet_identity.wasm"),
    build: "",
    // remote: {
    //   // TODO: get internet identity principalID
    //   id: InternetIdentityIds,
    // },

    // TODO:
    dfx_js: {
      canister_id: InternetIdentityIds,
      // opt record {assigned_user_number_range:record {nat64; nat64}}
      args: [Opt(null)],
      // mode: "reinstall"
    },
  }
}

InternetIdentity.id = InternetIdentityIds

InternetIdentity.idlFactory = idlFactory

InternetIdentity.scripts = {}

export type InternetIdentityActor = ActorSubclass<import("./internet_identity.types")._SERVICE>
