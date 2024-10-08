import path from "path"
import { Opt } from "../types"
import * as url from "url"
import { idlFactory } from "./astrox_wallet.did"
import { CreateProps } from "../types"
import type { ExtendedCanisterConfiguration } from "@crystal/runner"


const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

type AstroXWalletInitArgs = {}

const AstroXWalletIds = {
  // local: "rdmx6-jaaaa-aaaaa-aaadq-cai",
  // TODO: get real ids/
  // ic: "rdmx6-jaaaa-aaaaa-aaadq-cai",
}

export const AstroXWallet = ({}: AstroXWalletInitArgs): ExtendedCanisterConfiguration => {
  // - get paths
  return {
    type: "custom",
    candid: path.resolve(__dirname, "./astrox_wallet.did"),
    wasm: path.resolve(__dirname, "./astrox_wallet.wasm"),
    build: "",
    // remote: {
    //   id: AstroXWalletIds,
    // },

    // TODO:
    dfx_js: {
      // canister_id: AstroXWalletIds,
      args: [],
      // mode: "reinstall"
    },
  }
}

AstroXWallet.id = AstroXWalletIds

AstroXWallet.idlFactory = idlFactory

AstroXWallet.scripts = {}


type AstroXControllerInitArgs = {}

const AstroXControllerIds = {
  // local: "rdmx6-jaaaa-aaaaa-aaadq-cai",
  // TODO: get real ids/
  ic: "rdmx6-jaaaa-aaaaa-aaadq-cai",
}

export const AstroXController = ({}: AstroXControllerInitArgs): ExtendedCanisterConfiguration => {
  // - get paths
  return {
    type: "custom",
    candid: path.resolve(__dirname, "./me_plus/astrox_controller.did"),
    wasm: path.resolve(__dirname, "./me_plus/astrox_controller.wasm"),
    build: "",
    // remote: {
    //   id: AstroXControllerIds,
    // },

    // TODO:
    dfx_js: {
      args: [],
      // mode: "reinstall"
    },
  }
}

AstroXController.id = AstroXControllerIds

AstroXController.idlFactory = idlFactory

AstroXController.scripts = {}


type OmniWalletInitArgs = {}

export const OmniWallet = ({}: OmniWalletInitArgs): ExtendedCanisterConfiguration => {
  // - get paths
  return {
    type: "custom",
    candid: path.resolve(__dirname, "./me_plus/omni_wallet.did"),
    wasm: path.resolve(__dirname, "./me_plus/omni_wallet.wasm"),
    build: "",
    remote: {
      id: AstroXWalletIds,
    },

    // TODO:
    dfx_js: {
      args: [],
      // mode: "reinstall"
    },
  }
}

OmniWallet.id = AstroXWalletIds

OmniWallet.idlFactory = idlFactory

OmniWallet.scripts = {}

export type OmniWalletActor = import("@dfinity/agent").ActorSubclass<import("./omni_wallet.types")._SERVICE>
