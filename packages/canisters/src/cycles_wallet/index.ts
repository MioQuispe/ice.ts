import path from "node:path"
import { Opt } from "../types"
import * as url from "node:url"
import { Actor, HttpAgent } from "@dfinity/agent"
import { idlFactory } from "./cycles_wallet.did"
import { CreateProps } from "../types"
import type { ExtendedCanisterConfiguration } from "../types"


const __filename = url.fileURLToPath(import.meta.url)
const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

type InitArgs = {}

const CyclesWalletIds = {
  // local: "rdmx6-jaaaa-aaaaa-aaadq-cai",
  ic: "rdmx6-jaaaa-aaaaa-aaadq-cai",
}

export const CyclesWallet = ({}: InitArgs): ExtendedCanisterConfiguration => {
  // TODO: init args
  return {
    type: "custom",
    candid: path.resolve(__dirname, "./cycles_wallet/cycles_wallet.did"),
    wasm: path.resolve(__dirname, "./cycles_wallet/cycles_wallet.wasm"),
    build: "",
    // remote: {
    //   id: CyclesWalletIds,
    // },

    // TODO:
    dfx_js: {
      args: [],
      // mode: "reinstall"
    },
  }
}

CyclesWallet.id = CyclesWalletIds

CyclesWallet.idlFactory = idlFactory

CyclesWallet.scripts = {}

export type CyclesWalletActor = import("@dfinity/agent").ActorSubclass<import("./cycles_wallet.types")._SERVICE>
