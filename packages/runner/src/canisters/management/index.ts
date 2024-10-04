import path from "path"
import { Opt } from "../types"
import * as url from "url"
import { Actor, HttpAgent } from "@dfinity/agent"
import { idlFactory } from "./management.did"
import { CreateProps } from "../types"
import type { ExtendedCanisterConfiguration } from "@hydra.icp/runner"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

type InitArgs = {
  owner: string
}

const ManagementIds = {
  local: "aaaaa-aa",
  ic: "aaaaa-aa",
}

// TODO: Not needed?
export const Management = ({ owner }: InitArgs): ExtendedCanisterConfiguration => {
  return {
    type: "custom",
    candid: path.resolve(__dirname, "./management/management.did"),
    wasm: path.resolve(__dirname, "./management/management.wasm"),
    build: "",
    remote: {
      id: ManagementIds,
    },

    dfx_js: {
      args: [Opt(null)],
      // mode: "reinstall"
    },
  }
}

Management.id = ManagementIds

Management.idlFactory = idlFactory

Management.scripts = {}

export type ManagementActor = import("@dfinity/agent").ActorSubclass<import("./management.types")._SERVICE>
