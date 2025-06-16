import path from "node:path"
import { Opt } from "../types"
import { idlFactory } from "./ledger.private.did.js"
// import { idlFactory as ledgerPublicIdlFactory } from "./ledger.public.did.js"
import type { ICPTs, LedgerCanisterInitPayload, _SERVICE } from "./ledger.private.types"
import * as url from "node:url"
import { customCanister, type TaskCtxShape } from "@ice.ts/runner"

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

const canisterName = "ledger"
export const Ledger = (
  initArgsOrFn?: InitArgs | ((args: { ctx: TaskCtxShape }) => InitArgs),
) => {
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
  return customCanister<_SERVICE, [LedgerCanisterInitPayload]>({
    canisterId: LedgerIds.local,
    // TODO: change from private => public
    candid: path.resolve(__dirname, `${canisterName}/${canisterName}.private.did`),
    wasm: path.resolve(__dirname, `${canisterName}/${canisterName}.wasm.gz`),
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
  }).installArgs(async ({ mode, ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function"
        ? initArgsOrFn({ ctx })
        : initArgsOrFn
    const transformedValues = Object.keys(initArgs.initial_values).map(
      (accountId) => {
        const val = initArgs.initial_values[accountId]
        return [
          accountId,
          // BigInt? json serialization fails
          { e8s: BigInt(val) },
        ] as [string, ICPTs]
      },
    )
    return [{
      minting_account: initArgs.minting_account, // TODO: this is accountID
      initial_values: transformedValues, // and this too
      // initial_values: "",
      max_message_size_bytes: Opt(null),
      transaction_window: Opt(null),
      archive_options: Opt(null),
      send_whitelist: [],
      // hello: "world",
    }]
  })
}

// TODO:
// _metadata: {
//   standard: "ICP",
// },

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

export type LedgerActor = import("@dfinity/agent").ActorSubclass<
  import("./ledger.private.types")._SERVICE
>

// export const LedgerPublic = (): CanisterConfiguration => {
//   return {
//     type: "custom",
//     candid: path.resolve(__dirname, "./ledger/ledger.public.did"),
//     wasm: path.resolve(__dirname, "./ledger/ledger.wasm.gz"),
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
