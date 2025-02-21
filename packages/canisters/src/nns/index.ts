import * as url from "node:url"
import path from "node:path"
import { customCanister, Opt, scope, type TaskCtxShape } from "@ice/runner"
import type { _SERVICE as NNSDappService } from "./nns-ui/nns.did.types.ts"
import type {
  _SERVICE as NNSSNSWasmService,
  SnsInitPayload as NNSSNSWasmInitArgs,
  SnsWasmCanisterInitPayload,
  NeuronBasketConstructionParameters,
  InitialTokenDistribution,
  Countries,
  DappCanisters,
  NeuronsFundParticipationConstraints,
  NeuronsFundParticipants,
} from "./nns-sns-wasm/nns-sns-wasm.types.ts"
import type { _SERVICE as NNSRootService } from "./nns-root/nns-root.types.ts"
import type { _SERVICE as NNSRegistryService } from "./nns-registry/nns-registry.types.ts"
import type {
  _SERVICE as NNSGovernanceService,
  Governance as GovernanceInitArgs,
  NeuronStakeTransfer,
} from "./nns-governance/nns-governance.types.ts"
import type {
  _SERVICE as NNSLedgerService,
  LedgerCanisterPayload as LedgerInitArgs,
} from "./nns-ledger/nns-ledger.types.ts"
import type { _SERVICE as NNSGenesisTokenService } from "./nns-genesis-token/nns-genesis-token.types.ts"
import type {
  _SERVICE as NNSCyclesMintingService,
  CyclesCanisterInitPayload as NNSCyclesInitArgs,
} from "./nns-cycles-minting/nns-cycles-minting.types.ts"
import type { _SERVICE as NNSLifelineService } from "./nns-lifeline/nns-lifeline.types.ts"
// import type { _SERVICE as NNSICCKBTCMinterService } from "./nns-ic-ckbtc-minter/nns-ic-ckbtc-minter.types"
import { InternetIdentity, Ledger } from "@ice/canisters"
import { serializeGtc, type Gtc } from "./nns-genesis-token/encodeArgs.js"
import { Principal } from "@dfinity/principal"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

// export type {
//   SnsInitPayload,
//   NeuronBasketConstructionParameters,
//   NeuronsFundParticipationConstraints,
//   CfNeuron,
//   CfParticipant,
//   LinearScalingCoefficient,
//   NeuronsFundParticipants,
//   DappCanisters,
// } from "./nns-sns-wasm/nns-sns-wasm.types"

const NNSDappIds = {
  local: "qoctq-giaaa-aaaaa-aaaea-cai",
  ic: "qoctq-giaaa-aaaaa-aaaea-cai",
}

type NNSDappInitArgs = []

export const NNSDapp = (
  initArgsOrFn:
    | NNSDappInitArgs
    | ((args: { ctx: TaskCtxShape }) => NNSDappInitArgs)
    | ((args: { ctx: TaskCtxShape }) => Promise<NNSDappInitArgs>),
) => {
  return customCanister<[], NNSDappService>(async ({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function"
        ? await initArgsOrFn({ ctx })
        : initArgsOrFn
    return {
      canisterId: NNSDappIds.local,
      wasm: path.resolve(__dirname, "./nns/nns-ui/nns.wasm.gz"),
      candid: path.resolve(__dirname, "./nns/nns-ui/nns.did"),
    }
  }).installArgs(async ({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function"
        ? await initArgsOrFn({ ctx })
        : initArgsOrFn
    // Here we return an empty installation argument list.
    return []
  })
}

NNSDapp.id = NNSDappIds

/////////////////////////////////////////

const NNSSNSWasmIds = {
  local: "qaa6y-5yaaa-aaaaa-aaafa-cai",
  ic: "qaa6y-5yaaa-aaaaa-aaafa-cai",
}

// type NNSSNSInitArgs = []

export const NNSSNSWasm = (
  // TODO: fix
  initArgsOrFn?:
    | SnsWasmCanisterInitPayload
    | ((args: { ctx: TaskCtxShape }) => SnsWasmCanisterInitPayload)
    | ((args: { ctx: TaskCtxShape }) => Promise<SnsWasmCanisterInitPayload>),
) => {
  return customCanister<[SnsWasmCanisterInitPayload], NNSSNSWasmService>(
    async ({ ctx }) => {
      const initArgs =
        typeof initArgsOrFn === "function"
          ? await initArgsOrFn({ ctx })
          : initArgsOrFn
      return {
        canisterId: NNSSNSWasmIds.local,
        wasm: path.resolve(__dirname, "./nns/nns-sns-wasm/nns-sns-wasm.wasm.gz"),
        candid: path.resolve(__dirname, "./nns/nns-sns-wasm/nns-sns-wasm.did"),
      }
    },
  ).installArgs(async ({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function"
        ? await initArgsOrFn({ ctx })
        : initArgsOrFn

    return [
      {
        allowed_principals: [],
        access_controls_enabled: false,
        sns_subnet_ids: [],
      },
    ]
    // this is SnsInitPayload
    // return [{
    //   url: Opt(), // string
    //   max_dissolve_delay_seconds: Opt(0n),
    //   max_dissolve_delay_bonus_percentage: Opt(0n),
    //   nns_proposal_id: Opt(0n),
    //   min_participant_icp_e8s: Opt(0n),
    //   neuron_basket_construction_parameters:[{
    //       dissolve_delay_interval_seconds: 0n,
    //       count: 0n,
    //     }],
    //   fallback_controller_principal_ids: [],
    //   token_symbol: [],
    //   final_reward_rate_basis_points: [],
    //   max_icp_e8s: [],
    //   neuron_minimum_stake_e8s: [],
    //   confirmation_text: [],
    //   logo: [],
    //   name: [],
    //   swap_start_timestamp_seconds: [],
    //   swap_due_timestamp_seconds: [],
    //   initial_voting_period_seconds: [],
    //   neuron_minimum_dissolve_delay_to_vote_seconds: [],
    //   description: [],
    //   max_neuron_age_seconds_for_age_bonus: [],
    //   min_participants: [],
    //   initial_reward_rate_basis_points: [],
    //   wait_for_quiet_deadline_increase_seconds: [],
    //   transaction_fee_e8s: [],
    //   dapp_canisters: [],
    //   neurons_fund_participation_constraints: [],
    //   neurons_fund_participants: [],
    //   max_age_bonus_percentage: [],
    //   initial_token_distribution: [],
    //   reward_rate_transition_duration_seconds: [],
    //   token_logo: [],
    //   token_name: [],
    //   max_participant_icp_e8s: [],
    //   proposal_reject_cost_e8s: [],
    //   restricted_countries: [],
    //   min_icp_e8s: [],
    // }]
  })
}

NNSSNSWasm.id = NNSSNSWasmIds

/////////////////////////////////////////

const NNSRootIds = {
  local: "r7inp-6aaaa-aaaaa-aaabq-cai",
  ic: "r7inp-6aaaa-aaaaa-aaabq-cai",
}

type NNSRootInitArgs = []

export const NNSRoot = (
  initArgsOrFn:
    | NNSRootInitArgs
    | ((args: { ctx: TaskCtxShape }) => NNSRootInitArgs)
    | ((args: { ctx: TaskCtxShape }) => Promise<NNSRootInitArgs>),
) => {
  return customCanister<[], NNSRootService>(async ({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function"
        ? await initArgsOrFn({ ctx })
        : initArgsOrFn
    return {
      canisterId: NNSRootIds.local,
      wasm: path.resolve(__dirname, "./nns/nns-root/nns-root.wasm.gz"),
      candid: path.resolve(__dirname, "./nns/nns-root/nns-root.did"),
    }
  }).installArgs(async ({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function"
        ? await initArgsOrFn({ ctx })
        : initArgsOrFn
    return []
  })
}

NNSRoot.id = NNSRootIds

/////////////////////////////////////////

const NNSRegistryIds = {
  local: "rwlgt-iiaaa-aaaaa-aaaaa-cai",
  ic: "rwlgt-iiaaa-aaaaa-aaaaa-cai",
}

/**
 * Represents a precondition for a registry mutation.
 */
export interface RegistryMutationPrecondition {
  /**
   * A vector of nat8 (bytes) representing the key.
   */
  // key: Uint8Array
  key: Array<number>
  /**
   * The expected version as a nat64 (bigint).
   */
  expected_version: bigint
}

/**
 * Represents a registry mutation operation.
 */
export interface RegistryMutationOperation {
  /**
   * A vector of nat8 (bytes) representing the key.
   */
  // key: Uint8Array
  key: Array<number>
  /**
   * The mutation type as an int32.
   */
  mutation_type: number
  /**
   * A vector of nat8 (bytes) representing the new value for the mutation.
   */
  // value: Uint8Array
  value: Array<number>
}

/**
 * Represents a registry mutation containing both preconditions and mutation operations.
 */
export interface RegistryMutation {
  /**
   * A vector of preconditions which must be met before applying mutations.
   */
  preconditions: RegistryMutationPrecondition[]
  /**
   * A vector of mutation operations.
   */
  mutations: RegistryMutationOperation[]
}

/**
 * Represents the initialization payload for a registry canister.
 *
 * This type is "custom" as there are no optional, reserved, or null values on the wire.
 */
export interface RegistryCanisterInitPayload {
  /**
   * A vector (array) of registry mutations.
   */
  mutations: RegistryMutation[]
}

type NNSRegistryInitArgs = []

export const NNSRegistry = (
  initArgsOrFn:
    | NNSRegistryInitArgs
    | ((args: { ctx: TaskCtxShape }) => NNSRegistryInitArgs)
    | ((args: { ctx: TaskCtxShape }) => Promise<NNSRegistryInitArgs>),
) => {
  return customCanister<[RegistryCanisterInitPayload], NNSRegistryService>(
    async ({ ctx }) => {
      const initArgs =
        typeof initArgsOrFn === "function"
          ? await initArgsOrFn({ ctx })
          : initArgsOrFn
      return {
        canisterId: NNSRegistryIds.local,
        // For some reason the init args are not working with a gzipped wasm
        wasm: path.resolve(__dirname, "./nns/nns-registry/nns-registry.wasm"),
        candid: path.resolve(__dirname, "./nns/nns-registry/nns-registry.did"),
      }
    },
  ).installArgs(async ({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function"
        ? await initArgsOrFn({ ctx })
        : initArgsOrFn
    // return undefined
    // return [`
    // (
    //   record {
    //     mutations = vec {
    //       record {
    //         preconditions = vec {
    //           record {
    //             key = vec { 1; 2; 3 };
    //             expected_version = 42
    //           }
    //         };
    //         mutations = vec {
    //           record {
    //             key = vec { 4; 5; 6 };
    //             mutation_type = 1;
    //             value = vec { 7; 8; 9 }
    //           }
    //         }
    //       }
    //     }
    //   }
    // )
    // `]
    // return ""
    return [
      {
        mutations: [
          // {}
          //   {
          //   preconditions: [],
          //   mutations: [],
          // }
        ],
      },
    ]
  })
}

NNSRegistry.id = NNSRegistryIds

/////////////////////////////////////////

const NNSGovernanceIds = {
  local: "rrkah-fqaaa-aaaaa-aaaaq-cai",
  ic: "rrkah-fqaaa-aaaaa-aaaaq-cai",
}

type NNSGovernanceInitArgs = []

export const NNSGovernance = (
  initArgsOrFn:
    | NNSGovernanceInitArgs
    | ((args: { ctx: TaskCtxShape }) => NNSGovernanceInitArgs)
    | ((args: { ctx: TaskCtxShape }) => Promise<NNSGovernanceInitArgs>),
) => {
  return customCanister<[GovernanceInitArgs], NNSGovernanceService>(
    async ({ ctx }) => {
      const initArgs =
        typeof initArgsOrFn === "function"
          ? await initArgsOrFn({ ctx })
          : initArgsOrFn
      return {
        canisterId: NNSGovernanceIds.local,
        wasm: path.resolve(
          __dirname,
          "./nns/nns-governance/nns-governance-opt.wasm",
        ),
        candid: path.resolve(
          __dirname,
          "./nns/nns-governance/nns-governance.did",
        ),
      }
    },
  ).installArgs(async ({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function"
        ? await initArgsOrFn({ ctx })
        : initArgsOrFn
    // return null
    return [
      {
        default_followees: [],
        making_sns_proposal: [],
        most_recent_monthly_node_provider_rewards: [],
        maturity_modulation_last_updated_at_timestamp_seconds: [],
        wait_for_quiet_threshold_seconds: BigInt(60 * 60 * 24 * 4), // 4 days
        metrics: [],
        neuron_management_voting_period_seconds: [BigInt(60 * 60 * 48)], // 48 hours
        node_providers: [],
        cached_daily_maturity_modulation_basis_points: [],
        economics: [
          {
            neuron_minimum_stake_e8s: 0n,
            voting_power_economics: [
              {
                start_reducing_voting_power_after_seconds: [BigInt(0)],
                clear_following_after_seconds: [BigInt(0)],
              },
            ],
            max_proposals_to_keep_per_topic: 0,
            neuron_management_fee_per_proposal_e8s: 0n,
            reject_cost_e8s: 0n,
            transaction_fee_e8s: 0n,
            neuron_spawn_dissolve_delay_seconds: 0n,
            minimum_icp_xdr_rate: 0n,
            maximum_node_provider_rewards_e8s: 0n,
            neurons_fund_economics: [
              {
                maximum_icp_xdr_rate: [
                  {
                    human_readable: ["0"],
                    basis_points: [0n],
                  },
                ],
                neurons_fund_matched_funding_curve_coefficients: [
                  {
                    contribution_threshold_xdr: [
                      {
                        human_readable: ["0"],
                        basis_points: [0n],
                      },
                    ],
                    one_third_participation_milestone_xdr: [
                      {
                        human_readable: ["0"],
                        basis_points: [0n],
                      },
                    ],
                    full_participation_milestone_xdr: [
                      {
                        human_readable: ["0"],
                        basis_points: [0n],
                      },
                    ],
                  },
                ],
                max_theoretical_neurons_fund_participation_amount_xdr: [
                  {
                    human_readable: ["0"],
                    basis_points: [0n],
                  },
                ],
                minimum_icp_xdr_rate: [
                  {
                    human_readable: ["0"],
                    basis_points: [0n],
                  },
                ],
              },
            ],
          },
        ],
        restore_aging_summary: [],
        spawning_neurons: [],
        latest_reward_event: [],
        to_claim_transfers: [],
        short_voting_period_seconds: BigInt(60 * 60 * 12), // 12 hours
        topic_followee_index: [],
        migrations: [],
        proposals: [],
        xdr_conversion_rate: [
          {
            xdr_permyriad_per_icp: [0n],
            exchange_rate: [0n],
            timestamp_seconds: [0n],
          },
        ],
        in_flight_commands: [],
        neurons: [],
        genesis_timestamp_seconds: 0n,
      },
    ]
    // type Governance = record {
    //   default_followees : vec record { int32; Followees };
    //   making_sns_proposal : opt MakingSnsProposal;
    //   most_recent_monthly_node_provider_rewards : opt MonthlyNodeProviderRewards;
    //   maturity_modulation_last_updated_at_timestamp_seconds : opt nat64;
    //   wait_for_quiet_threshold_seconds : nat64;
    //   metrics : opt GovernanceCachedMetrics;
    //   neuron_management_voting_period_seconds : opt nat64;
    //   node_providers : vec NodeProvider;
    //   cached_daily_maturity_modulation_basis_points : opt int32;
    //   economics : opt NetworkEconomics;
    //   restore_aging_summary : opt RestoreAgingSummary;
    //   spawning_neurons : opt bool;
    //   latest_reward_event : opt RewardEvent;
    //   to_claim_transfers : vec NeuronStakeTransfer;
    //   short_voting_period_seconds : nat64;
    //   topic_followee_index : vec record { int32; FollowersMap };
    //   migrations : opt Migrations;
    //   proposals : vec record { nat64; ProposalData };
    //   xdr_conversion_rate : opt XdrConversionRate;
    //   in_flight_commands : vec record { nat64; NeuronInFlightCommand };
    //   neurons : vec record { nat64; Neuron };
    //   genesis_timestamp_seconds : nat64;
    // };
  })
}

NNSGovernance.id = NNSGovernanceIds

/////////////////////////////////////////

const NNSLedgerIds = {
  local: "ryjl3-tyaaa-aaaaa-aaaba-cai",
  ic: "ryjl3-tyaaa-aaaaa-aaaba-cai",
}

// type NNSLedgerInitArgs = []

export const NNSLedger = (
  initArgsOrFn:
    | LedgerInitArgs
    | ((args: { ctx: TaskCtxShape }) => LedgerInitArgs)
    | ((args: { ctx: TaskCtxShape }) => Promise<LedgerInitArgs>),
) => {
  return customCanister<[LedgerInitArgs], NNSLedgerService>(async ({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function"
        ? await initArgsOrFn({ ctx })
        : initArgsOrFn
    return {
      canisterId: NNSLedgerIds.local,
      wasm: path.resolve(__dirname, "./nns/nns-ledger/nns-ledger.wasm.gz"),
      candid: path.resolve(__dirname, "./nns/nns-ledger/nns-ledger.did"),
    }
  }).installArgs(async ({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function"
        ? await initArgsOrFn({ ctx })
        : initArgsOrFn
    // TODO:
    return [initArgs]
  })
}

NNSLedger.id = NNSLedgerIds

/////////////////////////////////////////

const NNSGenesisTokenIds = {
  local: "renrk-eyaaa-aaaaa-aaada-cai",
  ic: "renrk-eyaaa-aaaaa-aaada-cai",
}

type NNSGenesisTokenInitArgs = []

export const NNSGenesisToken = (
  initArgsOrFn:
    | NNSGenesisTokenInitArgs
    | ((args: { ctx: TaskCtxShape }) => NNSGenesisTokenInitArgs)
    | ((args: { ctx: TaskCtxShape }) => Promise<NNSGenesisTokenInitArgs>),
) => {
  return customCanister<Uint8Array, NNSGenesisTokenService>(async ({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function"
        ? await initArgsOrFn({ ctx })
        : initArgsOrFn
    return {
      canisterId: NNSGenesisTokenIds.local,
      wasm: path.resolve(
        __dirname,
        "./nns/nns-genesis-token/nns-genesis-token.wasm.gz",
      ),
      candid: path.resolve(
        __dirname,
        "./nns/nns-genesis-token/nns-genesis-token.did",
      ),
      noEncodeArgs: true,
    }
  }).installArgs(async ({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function"
        ? await initArgsOrFn({ ctx })
        : initArgsOrFn
    // We need to serialize it to protobuf format
    const exampleGtc: Gtc = {
      accounts: {
        // address1: { icpts: 150 },
        // address2: { icpts: 250 },
      },
      total_alloc: 400,
      genesis_timestamp_seconds: Math.floor(Date.now() / 1000),
      donate_account_recipient_neuron_id: { id: 123456789 },
      // You can set this to null (or leave undefined) if not used.
      forward_whitelisted_unclaimed_accounts_recipient_neuron_id: null,
      whitelisted_accounts_to_forward: ["address1", "address2"],
    }
    const serialized = serializeGtc(exampleGtc)
    return serialized
  })
}

NNSGenesisToken.id = NNSGenesisTokenIds

/////////////////////////////////////////

const NNSCyclesMintingIds = {
  local: "rkp4c-7iaaa-aaaaa-aaaca-cai",
  ic: "rkp4c-7iaaa-aaaaa-aaaca-cai",
}

type NNSCyclesMintingInitArgs = []

export const NNSCyclesMinting = (
  initArgsOrFn:
    | NNSCyclesMintingInitArgs
    | ((args: { ctx: TaskCtxShape }) => NNSCyclesMintingInitArgs)
    | ((args: { ctx: TaskCtxShape }) => Promise<NNSCyclesMintingInitArgs>),
) => {
  return customCanister<[Opt<NNSCyclesInitArgs>], NNSCyclesMintingService>(
    async ({ ctx }) => {
      const initArgs =
        typeof initArgsOrFn === "function"
          ? await initArgsOrFn({ ctx })
          : initArgsOrFn
      return {
        canisterId: NNSCyclesMintingIds.local,
        wasm: path.resolve(
          __dirname,
          "./nns/nns-cycles-minting/nns-cycles-minting.wasm.gz",
        ),
        candid: path.resolve(
          __dirname,
          "./nns/nns-cycles-minting/nns-cycles-minting.did",
        ),
      }
    },
  )
  // TODO:
  // .dependsOn({
  //   NNSGovernance,
  //   NNSLedger,
  // })
  .installArgs(async ({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function"
        ? await initArgsOrFn({ ctx })
        : initArgsOrFn
    // TODO:
//     export interface AccountIdentifier { 'bytes' : Array<number> }
// export type BlockIndex = bigint;
// export type Cycles = bigint;
// export interface CyclesCanisterInitPayload {
//   'exchange_rate_canister' : [] | [ExchangeRateCanister],
//   'last_purged_notification' : [] | [bigint],
//   'governance_canister_id' : [] | [Principal],
//   'minting_account_id' : [] | [AccountIdentifier],
//   'ledger_canister_id' : [] | [Principal],
// }
// export type ExchangeRateCanister = { 'Set' : Principal } |
//   { 'Unset' : null };
    return [Opt({
      // 'exchange_rate_canister' : [] | [ExchangeRateCanister],
      // 'last_purged_notification' : [] | [bigint],
      // 'governance_canister_id' : [] | [Principal],
      // 'minting_account_id' : [] | [AccountIdentifier],
      // 'ledger_canister_id' : [] | [Principal],
      // TODO:
      exchange_rate_canister: [
        // { Unset: null }
      ],
      last_purged_notification: Opt<bigint>(),
      // TODO: get from dependencies instead?
      governance_canister_id: [Principal.fromText(NNSGovernanceIds.ic)],
      minting_account_id: [
        // TODO: ...? also how to handle when tasks require users?
        // Use context somehow?
        // Maybe scopes can declare requirements?
        // Or do we need some concept of contexts?
        // {
        //   bytes: [ctx.users.default.accountId.toBytes()],
        // },
      ],
      ledger_canister_id: [Principal.fromText(NNSLedgerIds.ic)],
    })]
  })
}

NNSCyclesMinting.id = NNSCyclesMintingIds

/////////////////////////////////////////

const NNSLifelineIds = {
  local: "rno2w-sqaaa-aaaaa-aaacq-cai",
  ic: "rno2w-sqaaa-aaaaa-aaacq-cai",
}

type NNSLifelineInitArgs = []

export const NNSLifeline = (
  initArgsOrFn:
    | NNSLifelineInitArgs
    | ((args: { ctx: TaskCtxShape }) => NNSLifelineInitArgs)
    | ((args: { ctx: TaskCtxShape }) => Promise<NNSLifelineInitArgs>),
) => {
  return customCanister<[], NNSLifelineService>(async ({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function"
        ? await initArgsOrFn({ ctx })
        : initArgsOrFn
    return {
      canisterId: NNSLifelineIds.local,
      wasm: path.resolve(__dirname, "./nns/nns-lifeline/nns-lifeline.wasm.gz"),
      candid: path.resolve(__dirname, "./nns/nns-lifeline/nns-lifeline.did"),
    }
  }).installArgs(async ({ ctx }) => {
    const initArgs =
      typeof initArgsOrFn === "function"
        ? await initArgsOrFn({ ctx })
        : initArgsOrFn
    return []
  })
}

NNSLifeline.id = NNSLifelineIds

// TODO: init args
// Define an overall scope that groups these NNS tasks
export const NNSScope = () => scope("NNS tasks", {
  NNSDapp: NNSDapp([]).done(),
  NNSSNSWasm: NNSSNSWasm().done(),
  NNSRoot: NNSRoot([]).done(),
  NNSRegistry: NNSRegistry([]).done(),
  NNSGovernance: NNSGovernance([]).done(),
  // NNSLedger: NNSLedger([]),
  NNSGenesisToken: NNSGenesisToken([]).done(),
  NNSCyclesMinting: NNSCyclesMinting([]).done(),
  NNSLifeline: NNSLifeline([]).done(),
})

// nns-registry          rwlgt-iiaaa-aaaaa-aaaaa-cai
// nns-governance        rrkah-fqaaa-aaaaa-aaaaq-cai
// nns-ledger            ryjl3-tyaaa-aaaaa-aaaba-cai
// nns-root              r7inp-6aaaa-aaaaa-aaabq-cai
// nns-cycles-minting    rkp4c-7iaaa-aaaaa-aaaca-cai
// nns-lifeline          rno2w-sqaaa-aaaaa-aaacq-cai
// nns-genesis-token     renrk-eyaaa-aaaaa-aaada-cai
// this is just internet-identity
// nns-identity          rdmx6-jaaaa-aaaaa-aaadq-cai
// nns-ui                qoctq-giaaa-aaaaa-aaaea-cai
// nns-sns-wasm          qaa6y-5yaaa-aaaaa-aaafa-cai
// nns-ic-ckbtc-minter   qjdve-lqaaa-aaaaa-aaaeq-cai
