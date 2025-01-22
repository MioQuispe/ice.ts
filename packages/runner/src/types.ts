import type { Effect } from "effect"
import type { ActorSubclass } from "@dfinity/agent"

export type CanisterActor = {
  actor: ActorSubclass<unknown>
  canisterId: string
  getControllers: () => Promise<void>
  addControllers: (controllers: string[]) => Promise<void>
  setControllers: (controllers: string[]) => Promise<void>
} 

export type ManagementActor = import("@dfinity/agent").ActorSubclass<
  import("./canisters/management_new/management.types.js")._SERVICE
>

export interface Task<A = unknown, E = unknown, R = unknown> {
  // TODO: how do we define args? do we just pass them in or inject into context?
  // task: (args: any) => Effect.Effect<A, E, R>
  readonly id: symbol; // assigned by the builder
  effect: Effect.Effect<A, E, R>
  description: string
  tags: Array<string>
  // TODO: hmm? is this needed? hardhat has them but not sure if we need them
  // flags: {
  //   [key: `--${string}`]: any
  // }
  // TODO: not sure if we need this
  // transformArgs?: (args: string[]) => any[]
}

export type Scope = {
  tags: Array<string | symbol>
  description: string
  children: Record<string, Task | Scope>
}