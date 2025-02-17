import path from "node:path"
import type { TaskCtxShape } from "@crystal/runner"
import { customCanister, Opt } from "@crystal/runner"
import type {
  _SERVICE,
  InitArgList,
  InitArgList__1,
  InitArgs,
  InitArgs__1,
} from "./icrc7_nft.types"
// import type { _SERVICE } from "./icrc7_nft.did.js"
import * as url from "node:url"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))
const canisterName = "icrc7_nft"

type ICRC7NFTInitArgs = {
  icrc3_args: InitArgs
  icrc37_args: [] | [InitArgList]
  icrc7_args: [] | [InitArgList__1]
}

type WrapperInitArgs = {
  canisterId?: string
}

// TODO: implement this
export const ICRC7NFT = (
  initArgsOrFn: WrapperInitArgs | ((args: { ctx: TaskCtxShape }) => WrapperInitArgs),
) => {
  return customCanister<[ICRC7NFTInitArgs], _SERVICE>(({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn({ ctx }) : initArgsOrFn
    return {
      canisterId: initArgs.canisterId,
      wasm: path.resolve(__dirname, `./${canisterName}/${canisterName}.wasm`),
      candid: path.resolve(__dirname, `./${canisterName}/${canisterName}.did`),
    }
  }).installArgs(async ({ ctx, mode }) => {
    const initArgs =
      typeof initArgsOrFn === "function" ? initArgsOrFn({ ctx }) : initArgsOrFn
    //   return [
    //     IDL.Record({
    //       'icrc3_args' : InitArgs,
    //       'icrc37_args' : IDL.Opt(InitArgList),
    //       'icrc7_args' : IDL.Opt(InitArgList__1),
    //     }),
    //   ];
    return [
      {
        icrc3_args: [
          {
            maxRecordsToArchive: 0n,
            archiveIndexType: {
              Stable: null,
            },
            maxArchivePages: 0n,
            settleToRecords: 0n,
            archiveCycles: 0n,
            maxActiveRecords: 0n,
            maxRecordsInArchiveInstance: 0n,
            archiveControllers: [
              // Array<Principal>
              // []
            ],
            supportedBlocks: [],
          } satisfies InitArgs__1,
        ],
        icrc37_args: [
          //     {
          //     'deployer' : ctx.users.default.principal,
          //     'max_approvals' : [0n],
          //     'max_approvals_per_token_or_collection' : [0n],
          //     'settle_to_approvals' : [0n],
          //     'max_revoke_approvals' : [0n],
          //     'collection_approval_requires_token' : [false],
          // }
        ],
        icrc7_args: [
        //   {
        //     deployer: ctx.users.default.principal,
        //     max_approvals: [0n],
        //     max_approvals_per_token_or_collection: [0n],
        //   },
        ],
      },
    ]
  })
}
