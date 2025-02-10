import * as url from "node:url"
import path from "node:path"
import { Principal } from "@dfinity/principal"
import { customCanister, type TaskCtxShape } from "@crystal/runner"
import { CapRouter } from "../cap"
import type { _SERVICE } from "./dip20.did"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

// TODO: bigint?
type CanisterInitArgs = [
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

// type DIP20Builder = ReturnType<typeof customCanister<CanisterInitArgs, _SERVICE>>
export const DIP20 = (
  initArgsOrFn:
    | InitArgs
    | ((ctx: TaskCtxShape) => InitArgs)
    | ((ctx: TaskCtxShape) => Promise<InitArgs>),
) => {
  const result = customCanister<CanisterInitArgs, _SERVICE>(async (ctx) => {
    let initArgs: InitArgs
    const initResult =
      typeof initArgsOrFn === "function" ? initArgsOrFn(ctx) : initArgsOrFn
    if (initResult instanceof Promise) {
      initArgs = await initResult
    } else {
      initArgs = initResult
    }
    return {
      canisterId: initArgs.canisterId,
      wasm: path.resolve(__dirname, `./${canisterName}/${canisterName}.wasm`),
      candid: path.resolve(__dirname, `./${canisterName}/${canisterName}.did`),
    }
  })
  // TODO: support passing in CanisterScopes
  // TODO: Do we just check the return type of the task?
  .deps({ capRouter: CapRouter.shape })
  // .provide({ capRouter: CapRouter.shape })
  // TODO: install ctx should receive the dependencies in its type
  .install(async ({ ctx, mode }) => {
    let initArgs: InitArgs
    const initResult =
      typeof initArgsOrFn === "function" ? initArgsOrFn(ctx) : initArgsOrFn
    if (initResult instanceof Promise) {
      initArgs = await initResult
    } else {
      initArgs = initResult
    }
    const { capRouter: { canisterId: capRouterId, actor } } = ctx.dependencies
    return [
      initArgs.logo,
      initArgs.name,
      initArgs.symbol,
      BigInt(initArgs.decimals),
      BigInt(initArgs.totalSupply),
      Principal.from(initArgs.owner),
      BigInt(initArgs.fee),
      Principal.from(initArgs.feeTo),
      Principal.from(capRouterId),
    ]
  })
  // tests:
  // .provide({ capRouter: CapRouter.failShape }).done().children.install.dependencies.capRouter.effect
  return result
}

// TODO:
// _metadata: {
//   standard: "DIP20",
// },
