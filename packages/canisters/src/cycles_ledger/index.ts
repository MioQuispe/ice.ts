import path from "node:path"
import * as url from "node:url"
import { customCanister, Opt, type TaskCtxShape } from "@crystal/runner"
import type { _SERVICE, LedgerArgs } from "./cycles_ledger.types"
import type { Principal } from "@dfinity/principal"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

type InitArgs = []
type WrapperInitArgs = {
  canisterId?: string
}

const CyclesLedgerIds = {
  local: "ul4oc-4iaaa-aaaaq-qaabq-cai",
  ic: "ul4oc-4iaaa-aaaaq-qaabq-cai",
}

export const CyclesLedger = (
  initArgsOrFn: WrapperInitArgs | ((args: { ctx: TaskCtxShape }) => WrapperInitArgs),
) => {
  // TODO: init args
  return customCanister<[LedgerArgs], _SERVICE>(({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn({ ctx }) : initArgsOrFn
    return {
      canisterId: initArgs?.canisterId ?? CyclesLedgerIds.ic,
      type: "custom",
      candid: path.resolve(__dirname, "./cycles_ledger/cycles_ledger.did"),
      wasm: path.resolve(__dirname, "./cycles_ledger/cycles_ledger.wasm.gz"),
    }
  }).install(async ({ ctx, mode }) => {
    return [
      {
        Init: {
          index_id: Opt<Principal>(),
          max_blocks_per_request: 1000n,
        },
      },
    ]
  })
}
