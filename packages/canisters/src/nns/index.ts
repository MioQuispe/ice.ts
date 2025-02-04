import path from "node:path"
import { Opt } from "../types"
import * as url from "node:url"
import type { ExtendedCanisterConfiguration } from "../types"
import { customCanister, type TaskCtxShape } from "@crystal/runner"

export type {
  SnsInitPayload,
  NeuronBasketConstructionParameters,
  NeuronsFundParticipationConstraints,
  CfNeuron,
  CfParticipant,
  LinearScalingCoefficient,
  NeuronsFundParticipants,
  DappCanisters,
} from "./nns-sns-wasm/nns-sns-wasm.types"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

const NNSDappIds = {
  local: "qoctq-giaaa-aaaaa-aaaea-cai",
  ic: "qoctq-giaaa-aaaaa-aaaea-cai",
}

type NNSDappInitArgs = {}

export const NNSDapp = (
  initArgsOrFn: NNSDappInitArgs | ((ctx: TaskCtxShape) => NNSDappInitArgs) = {},
) => {
  // TODO: init args
  return customCanister<[]>({
    candid: path.resolve(__dirname, "./nns/nns-ui/nns.did"),
    wasm: path.resolve(__dirname, "./nns/nns-ui/nns.wasm"),
    canisterId: NNSDappIds.local,
  })
}

NNSDapp.id = NNSDappIds

export type NNSDappActor = import("@dfinity/agent").ActorSubclass<
  import("./nns-ui/nns.did.types")._SERVICE
>

const NNSSNSWasmIds = {
  local: "qaa6y-5yaaa-aaaaa-aaafa-cai",
  ic: "qaa6y-5yaaa-aaaaa-aaafa-cai",
}

type NNSSNSInitArgs = {}

export const NNSSNSWasm = (
  initArgsOrFn: NNSSNSInitArgs | ((ctx: TaskCtxShape) => NNSSNSInitArgs) = {},
) => {
  // TODO: init args
  return customCanister<[]>({
    candid: path.resolve(__dirname, "./nns/nns-sns-wasm/nns-sns-wasm.did"),
    wasm: path.resolve(__dirname, "./nns/nns-sns-wasm/nns-sns-wasm.wasm"),
    canisterId: NNSSNSWasmIds.local,
  })
}

NNSSNSWasm.id = NNSSNSWasmIds

export type NNSSNSWasmActor = import("@dfinity/agent").ActorSubclass<
  import("./nns-sns-wasm/nns-sns-wasm.types")._SERVICE
>

// nns-registry          rwlgt-iiaaa-aaaaa-aaaaa-cai
// nns-governance        rrkah-fqaaa-aaaaa-aaaaq-cai
// nns-ledger            ryjl3-tyaaa-aaaaa-aaaba-cai
// nns-root              r7inp-6aaaa-aaaaa-aaabq-cai
// nns-cycles-minting    rkp4c-7iaaa-aaaaa-aaaca-cai
// nns-lifeline          rno2w-sqaaa-aaaaa-aaacq-cai
// nns-genesis-token     renrk-eyaaa-aaaaa-aaada-cai
// nns-identity          rdmx6-jaaaa-aaaaa-aaadq-cai
// nns-ui                qoctq-giaaa-aaaaa-aaaea-cai
// nns-sns-wasm          qaa6y-5yaaa-aaaaa-aaafa-cai
// nns-ic-ckbtc-minter   qjdve-lqaaa-aaaaa-aaaeq-cai

const NNSRootIds = {
  local: "r7inp-6aaaa-aaaaa-aaabq-cai",
  ic: "r7inp-6aaaa-aaaaa-aaabq-cai",
}

type NNSRootInitArgs = {}

export const NNSRoot = (
  initArgsOrFn: NNSRootInitArgs | ((ctx: TaskCtxShape) => NNSRootInitArgs) = {},
) => {
  // TODO: init args
  return customCanister<[]>({
    candid: path.resolve(__dirname, "./nns/nns-root/nns-root.did"),
    wasm: path.resolve(__dirname, "./nns/nns-root/nns-root.wasm"),
    canisterId: NNSRootIds.local,
  })
}

NNSRoot.id = NNSRootIds

export type NNSRootActor = import("@dfinity/agent").ActorSubclass<
  import("./nns-root/nns-root.types")._SERVICE
>

// TODO: function?
export const NNSScope = {
  description: "NNS tasks",
  tags: [],
  tasks: {
    NNSDapp,
    NNSSNSWasm,
    NNSRoot,
  },
}
