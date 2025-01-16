import type { Effect } from "effect"
import type { ActorSubclass } from "@dfinity/agent"

export type TaskContext = {
  runTask: <T>(taskName: string) => Promise<T>
}

export type TaskScriptConfiguration<T = unknown> = (ctx: TaskContext) => T | Promise<T>

export type TaskCanisterConfiguration = {
  candid: string
  wasm: string
  dfx_js?: {
    args?: unknown[]
    canister_id?: {
      [network: string]: string
    }
  }
  _metadata?: { 
    standard?: string 
  }
}

export type TaskConfiguration<T = unknown> = 
  | TaskCanisterConfiguration 
  | TaskScriptConfiguration<T>

export type TaskFullName = `${"canisters" | "scripts"}:${string}`

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

export interface Task<A, E, R> {
  task: Effect.Effect<A, E, R>
  description: string
  tags: Array<string>
  // TODO: hmm? is this needed?
  // flags: {
  //   [key: `--${string}`]: any
  // }
  // transformArgs?: (args: string[]) => any[]
}

// TODO: how do we nest them infinitely?
// The whole module is a TaskGroup?
export type Scope = {
  // TODO: do we need this? is this just unnecessary inheritance?
  tags: Array<string | symbol>
  description: string
  tasks: {
    [key: string]: Task<any, any, any> | Scope
  }
}
