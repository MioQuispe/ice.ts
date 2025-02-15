import type { Effect, Option } from "effect"
import type { ActorSubclass, Agent, Identity } from "@dfinity/agent"
import type { Principal } from "@dfinity/principal"

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

// TODO: create service? dependencies?
export type CrystalContext = {
  // dfxConfig: DfxConfig
  // currentUser: {
  //   identity: Identity
  //   principal: Principal
  //   accountId: string
  //   agent: Agent
  // }
  users: {
    [key: string]: {
      identity: Identity
      principal: Principal
      accountId: string
      agent: Agent
    }
  }
  // TODO: networks / envs
  networks: {
    [key: string]: {
      agent: Agent
      identity: Identity
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
  input?: I // optional input
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
  defaultTask?: string
}

export type BuilderResult = {
  _tag: "builder"
  _scope: Scope
  [key: string]: any
}

export type TaskTreeNode = Task | Scope | BuilderResult

export type TaskTree = Record<string, TaskTreeNode>

// export type Plugin = {
//   _tag: "plugin"
//   transform: (ctx: CrystalContext) => PreTaskTree;
//   children: PreTaskTree | ((args: any) => PreTaskTree)
// }

// TODO: fix
export type CrystalConfig = CrystalContext
export type CrystalConfigFile = {
  default: CrystalContext
} & {
  [key: string]: TaskTreeNode
}

export type CanisterConstructor = {
  // _tag: "canister-constructor"
  provides: Task
}

export type CanisterScope = {
  _tag: "scope"
  tags: Array<string | symbol>
  description: string
  // only limited to tasks
  children: Record<string, Task>
}