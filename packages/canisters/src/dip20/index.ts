import * as url from "node:url"
import path from "node:path"
import { Principal } from "@dfinity/principal"
import { customCanister, type TaskCtxShape } from "@crystal/runner"
import { CapRouter } from "../cap"
// import type { InitArgs } from "./dip20.did"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

// TODO: bigint?
type DIP20InitArgs = [
  logo: string, // logo: String
  name: string, // name: String
  symbol: string, // symbol: String
  decimals: bigint, // decimals: u8,
  totalSupply: bigint, // total_supply: Nat,
  owner: Principal, // owner: Principal,
  fee: bigint, // fee: Nat,
  feeTo: Principal, // fee_to: Principal,
  // TODO: optional dependency:
  capRouterId?: Principal, // cap: Principal,
]

type InitArgs = {
  canisterId?: string
  logo: string // logo: String
  name: string // name: String
  symbol: string // symbol: String
  decimals: number // decimals: u8,
  totalSupply: number // total_supply: Nat,
  owner: string // owner: Principal,
  fee: number // fee: Nat,
  feeTo: string // fee_to: Principal,
  // TODO: optional dependency:
  capRouterId?: string // cap: Principal,
}

const canisterName = "dip20"
export const DIP20 = (
  initArgsOrFn: InitArgs | ((ctx: TaskCtxShape) => InitArgs),
) => {
  return customCanister<DIP20InitArgs>((ctx) => {
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn(ctx) : initArgsOrFn
    return {
      canisterId: initArgs.canisterId,
      wasm: path.resolve(__dirname, `./${canisterName}/${canisterName}.wasm`),
      candid: path.resolve(__dirname, `./${canisterName}/${canisterName}.did`),
    }
  }).install(async ({ ctx, mode }) => {
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn(ctx) : initArgsOrFn
    return [
      initArgs.logo,
      initArgs.name,
      initArgs.symbol,
      BigInt(initArgs.decimals),
      BigInt(initArgs.totalSupply),
      Principal.from(initArgs.owner),
      BigInt(initArgs.fee),
      Principal.from(initArgs.feeTo),
      Principal.from(initArgs.capRouterId ?? CapRouter.id.ic),
    ]
  })
}

// TODO:
// _metadata: {
//   standard: "DIP20",
// },
