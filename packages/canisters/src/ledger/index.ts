import path from "node:path"
import { Opt } from "../types"
import { idlFactory } from "./ledger.private.did.js"
// import { idlFactory as ledgerPublicIdlFactory } from "./ledger.public.did.js"
import type { LedgerCanisterInitPayload } from "./ledger.private.types"
import * as url from "node:url"
import type { ExtendedCanisterConfiguration } from "../types"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

type InitArgs = {
  minting_account: string
  // TODO: fix
  initial_values: { [account: string]: number }
}

const LedgerIds = {
  local: "ryjl3-tyaaa-aaaaa-aaaba-cai",
  ic: "ryjl3-tyaaa-aaaaa-aaaba-cai",
}

export const Ledger = ({ minting_account, initial_values = {} }: InitArgs): ExtendedCanisterConfiguration => {
  const transformedValues = Object.keys(initial_values).map(accountId => {
    const val = initial_values[accountId]
    return [
      accountId,
      // BigInt? json serialization fails
      { e8s: val },
    ]
  })
  // initial_values: [
  //   [
  //     // "bf748c9308687512ecf828a0d33a39d487d2399c426f62466bb9a2a4e84c7bd0",
  //     defaultAccountId,
  //     { e8s: 100_000_000_000 },
  //   ],
  // ],

  // TODO: init args

  // TODO: return config
  // - get paths
  return {
    type: "custom",
    // TODO: change from private => public
    candid: path.resolve(__dirname, "./ledger/ledger.private.did"),
    wasm: path.resolve(__dirname, "./ledger/ledger.wasm"),
    build: "",
    // TODO: principal has to be specified
    // remote: {
    //   id: {
    //     ic: "",
    //   },
    // },
    // remote: {
    //   id: LedgerIds,
    // },
    // id: "ryjl3-tyaaa-aaaaa-aaaba-cai",

    // `record {
    //    minting_account = \"60bbbbcf3efc1ae7d97a8392d977ec5e54d065a79eee3bc147f259f02fd252d6\";
    //    initial_values = vec {
    //      record {
    //        \"bf748c9308687512ecf828a0d33a39d487d2399c426f62466bb9a2a4e84c7bd0\";
    //        record { e8s = 100_000_000_000 }
    //      }
    //    };
    //    max_message_size_bytes = null;
    //    transaction_window = null;
    //    archive_options = null;
    //    send_whitelist = vec {}
    //  }`

    _metadata: {
      standard: "ICP",
    },

    // TODO:
    dfx_js: {
      canister_id: LedgerIds,
      args: [{
        minting_account,
        initial_values: transformedValues,
        max_message_size_bytes: Opt(null),
        transaction_window: Opt(null),
        archive_options: Opt(null),
        send_whitelist: [],
      } as LedgerCanisterInitPayload],
    },
  }
}

Ledger.id = LedgerIds

Ledger.idlFactory = idlFactory

Ledger.scripts = {}

//
// {
//   send_whitelist:vec principal;
//   minting_account:text;
//   transaction_window:opt record {
//     secs:nat64;
//     nanos:nat32
//   };
//   max_message_size_bytes:opt nat64;
//   archive_options:opt record {
//     num_blocks_to_archive:nat64;
//     trigger_threshold:nat64;
//     max_message_size_bytes:opt nat64;
//     node_max_memory_size_bytes:opt nat64;
//     controller_id:principal};
//   initial_values: vec record {
//     text;
//     record { e8s:nat64 }
//   }
// }
//
// {
//   "minting_account":"60bbbbcf3efc1ae7d97a8392d977ec5e54d065a79eee3bc147f259f02fd252d6",
//   "initial_values":[
//   {"53n4q-pyz4n-nippq-vo5vh-66g7c-u47ww-gsx4z-oslrd-2v72m-qyh6g-5qe":{"e8s":100000000000}}
// ],
//   "max_message_size_bytes":null,
//   "transaction_window":null,
//   "archive_options":null,
//   "send_whitelist":[]
// }

export type LedgerActor = import("@dfinity/agent").ActorSubclass<import("./ledger.private.types")._SERVICE>

// export const LedgerPublic = (): CanisterConfiguration => {
//   return {
//     type: "custom",
//     candid: path.resolve(__dirname, "./ledger/ledger.public.did"),
//     wasm: path.resolve(__dirname, "./ledger/ledger.wasm"),
//     build: "",
//     remote: {
//       id: LedgerIds,
//     },
//     args: [],
//   }
// }
//
// LedgerPublic.id = LedgerIds
//
// LedgerPublic.idlFactory = idlFactory
//
// LedgerPublic.scripts = {}
