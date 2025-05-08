import type { Effect, Option } from "effect"
import type { ActorSubclass, Agent, Identity, SignIdentity } from "@dfinity/agent"
import type { Principal } from "@dfinity/principal"
import type { ReplicaService } from "../services/replica.js"

export type CanisterActor = {
  actor: ActorSubclass<unknown>
  canisterId: string
  getControllers: () => Promise<void>
  addControllers: (controllers: string[]) => Promise<void>
  setControllers: (controllers: string[]) => Promise<void>
}

export type ManagementActor = import("@dfinity/agent").ActorSubclass<
  import("../canisters/management_latest/management.types.js")._SERVICE
>

export type ReplicaConfig = {
  subnet: "system" | "application" | "verified_application"
  // type?: "ephemeral" | "persistent"
  bitcoin?: boolean
  canister_http?: boolean
  type: "pocketic" | "dfx"
}

type ICEUser = {
  identity: SignIdentity
  principal: string
  accountId: string
  // agent: Agent
}

// TODO: create service? dependencies?
export type ICEConfig = {
  users: {
    [key: string]: ICEUser
  }
  roles: {
    [key: string]: string
  }
  networks: {
    [key: string]: {
      replica: ReplicaService
      host: string
      port: number
    }
  }
}

export type InitializedICEConfig = {
  users: {
    [key: string]: ICEUser
  }
  roles: {
    [key: string]: ICEUser
  }
  networks: {
    [key: string]: {
      replica: ReplicaService
      host: string
      port: number
    }
  }
}

export interface Task<
  A = unknown,
  E = unknown,
  R = unknown,
  I = unknown,
> {
  _tag: "task"
  // TODO: how do we define args? do we just pass them in or inject into context?
  // task: (args: any) => Effect.Effect<A, E, R>
  readonly id: symbol // assigned by the builder
  effect: Effect.Effect<A, E, R>
  description: string
  tags: Array<string | symbol>
  // TODO: we only want the shape of the task here
  dependencies: Record<string, Task>
  provide: Record<string, Task>
  // TODO: hmm? is this needed? hardhat has them but not sure if we need them
  // flags: {
  //   [key: `--${string}`]: any
  // }
  // TODO: not sure if we need this
  // transformArgs?: (args: string[]) => any[]
  // for caching
  input: Option.Option<I> // optional input
  // TODO: causes type issues in builders
  // computeCacheKey?: (task: Task<A, E, R, I>) => string
  computeCacheKey: Option.Option<
    (task: Task<A, E, R, I>) => string
  >
}

export type Scope = {
  _tag: "scope"
  // TODO: hmm do we need this?
  tags: Array<string | symbol>
  description: string
  children: Record<string, TaskTreeNode>
  // TODO:
  defaultTask: Option.Option<string>
}

export type BuilderResult = {
  _tag: "builder"
  done: () => Task | Scope
  [key: string]: any
}

export type TaskTreeNode = Task | Scope | BuilderResult

export type TaskTree = Record<string, TaskTreeNode>

// export type Plugin = {
//   _tag: "plugin"
//   transform: (ctx: ICEContext) => PreTaskTree;
//   children: PreTaskTree | ((args: any) => PreTaskTree)
// }

// TODO: come up with a better name
export type ICECtx = {
	network: string
}
// TODO: fix
export type ICEConfigFile = {
  default: Partial<ICEConfig> | ((ctx: ICECtx) => Promise<Partial<ICEConfig>> | Partial<ICEConfig>)
} & {
  [key: string]: TaskTreeNode
}

export type CanisterConstructor = {
  // _tag: "canister-constructor"
  provides: Task
}

// TODO: fix?
export type CanisterScope = {
  _tag: "scope"
  tags: Array<string | symbol>
  description: string
  defaultTask: Option.Option<string>
  // only limited to tasks
  children: Record<string, Task>
}