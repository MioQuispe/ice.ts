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