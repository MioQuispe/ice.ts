import {
  CandidUI,
  CapRouter,
  CyclesLedger,
  CyclesWallet,
  DIP20,
  DIP721,
  ICRC1Ledger,
  ICRC7NFT,
  InternetIdentity,
  NNS
} from "@ice.ts/canisters"
import { Ice, Ids, motokoCanister, task } from "@ice.ts/runner"

export const ice_test_backend = motokoCanister({
  src: "canisters/ice_test_backend/main.mo",
}).make()

export const nns = NNS()

export const candid_ui = CandidUI().make()

export const cycles_wallet = CyclesWallet().make()

export const cycles_ledger = CyclesLedger().make()

//////////////////////////////////////////
// Identity providers
//////////////////////////////////////////

export const internet_identity = InternetIdentity(({ ctx }) => ({
  assignedUserNumberRange: [BigInt(0), BigInt(1000)],
  owner: ctx.users.default.principal,
})).make()

// export const nfid = NFID()

//////////////////////////////////////////
// Tokens
//////////////////////////////////////////

// export const ledger = Ledger(({ ctx }) => ({
//   minting_account: ctx.users.default.accountId,
//   initial_values: {
//     [ctx.users.default.accountId]: 1_000_000_000,
//   },
// })).make()

export const icrc1_ledger = ICRC1Ledger(({ ctx }) => ({
  // custodians: [{ owner: ctx.users.default.principal, subaccount: [] }],
  name: "Test ICRC1",
  symbol: "TEST",
  logo: "https://example.com/logo.png",
  minting_account: ctx.users.default.principal,
  controller_id: ctx.users.default.principal,
})).make()

export const icrc7_nft = ICRC7NFT().make()

export const cap_router = CapRouter().make()

export const dip20 = DIP20(({ ctx }) => ({
  name: "Test DIP20",
  symbol: "TEST",
  logo: "https://example.com/logo.png",
  decimals: 18,
  totalSupply: 1_000_000_000,
  owner: ctx.users.default.principal,
  fee: 0,
  feeTo: ctx.users.default.principal,
}))
  .deps({
    CapRouter: cap_router,
  })
  .make()

export const dip721 = DIP721()
  .installArgs(({ ctx, mode }) => {
    return DIP721.makeArgs({
      name: "Test DIP721",
      symbol: "TEST 18",
      logo: "https://example.com/logo.png",
      custodians: [ctx.users.default.principal],
    })
  })
  .make()

//////////////////////////////////////////
// Tasks
//////////////////////////////////////////

export const deploy_mode = task("deploy mode")
  .run(async ({ ctx }) => {
    const status = await ctx.runTask(ice_test_backend.children.install, {
      mode: "reinstall",
      // TODO: ??
      // args: "",
    })
    console.log(status)
  })
  .make()

export default Ice(async () => {
  return {
    users: {
      default: await Ids.fromDfx("default"),
    },
    roles: {
      deployer: "default",
    },
  }
})

export const mint_tokens = task("mint tokens")
  .params({
    amount: {
      // type: type("number"),
      type: z.number(),
      description: "The amount of tokens to mint",
      // default: "100",
      default: 100,
      parse: (value: string) => Number(value),
      isOptional: false,
      isVariadic: false,
      isFlag: false,
      aliases: ["a"],
    },
  })
  .run(async ({ ctx, deps, args }) => {
    const { amount } = ctx.args
    // TODO:
    console.log(amount)
    return amount
  })
  .make()

export const dynamic_task = task("dynamic task")
  .run(async ({ ctx, args }) => {
    const amount = await ctx.runTask(mint_tokens, {
      amount: 12,
    })
    console.log(amount)
  })
  .make()

export const status_task = task("status")
  .run(async ({ ctx }) => {
    // const { canisterId } = await ctx.runTask(icrc1_ledger.children.install)
    // console.log(canisterId)
    await ctx.runTask(icrc1_ledger.children.remove)
    const { status } = await ctx.runTask(icrc1_ledger.children.status)
    console.log(status)
    // await ctx.runTask(icrc1_ledger.children.remove)
    // const { status: status2 } = await ctx.runTask(icrc1_ledger.children.status)
    // console.log(status2)
  })
  .make()

export const greet = task("greet")
  .deps({
    ice_test_backend,
  })
  .run(async (ctx) => {
    const { ice_test_backend } = ctx.deps
    const name = await ice_test_backend.actor.greet()
    console.log(name)
  })
  .make()

export const set_name = task("set name")
  .deps({
    ice_test_backend,
  })
  .run(async (ctx) => {
    const { ice_test_backend } = ctx.deps
    await ice_test_backend.actor.set_name("Dominic Williams")
  })
  .make()
