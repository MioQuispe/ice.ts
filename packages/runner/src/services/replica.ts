import { type Effect, Context, Data } from "effect"
import type { HttpAgent, SignIdentity } from "@dfinity/agent"
import type { canister_status_result } from "src/canisters/management_latest/management.types.js"

export type CanisterStatus = "not_installed" | "stopped" | "running"

// TODO: clean this up
export type CanisterInfo = canister_status_result | { status: "not_installed" }

export class CanisterStatusError extends Data.TaggedError("CanisterStatusError")<{
	readonly message: string
}> {}

export class CanisterInstallError extends Data.TaggedError("CanisterInstallError")<{
	readonly message: string
}> {}

export class CanisterCreateError extends Data.TaggedError("CanisterCreateError")<{
	readonly message: string
}> {}

export class CanisterStopError extends Data.TaggedError("CanisterStopError")<{
	readonly message: string
}> {}

export class CanisterDeleteError extends Data.TaggedError("CanisterDeleteError")<{
	readonly message: string
}> {}

export class AgentError extends Data.TaggedError("AgentError")<{
	readonly message: string
}> {}

export type ReplicaService = {
	host: string
	port: number
	// readonly createCanister: (params: {
	//   canisterName: string
	//   args?: any[]
	// }) => Effect.Effect<string, DfxError>
	// readonly installCanister: (params: {
	//   canisterName: string
	//   args?: any[]
	// }) => Effect.Effect<string, DfxError>
	// readonly mgmt: ManagementActor
	installCode: (params: {
		canisterId: string
		wasm: Uint8Array
		encodedArgs: Uint8Array
		identity: SignIdentity
		// TODO: progress callback?
	}) => Effect.Effect<void, CanisterInstallError | AgentError | CanisterStatusError>
	// uninstallCode: (canisterId: string) => Effect.Effect<void, unknown, unknown>
	getCanisterStatus: (params: {
		canisterId: string
		identity: SignIdentity
	}) => Effect.Effect<CanisterStatus, CanisterStatusError | AgentError>
	getCanisterInfo: (params: {
		canisterId: string
		identity: SignIdentity
	}) => Effect.Effect<CanisterInfo, CanisterStatusError | AgentError>
	stopCanister: (params: {
		canisterId: string
		identity: SignIdentity
	}) => Effect.Effect<void, CanisterStopError | AgentError>
	removeCanister: (params: {
		canisterId: string
		identity: SignIdentity
	}) => Effect.Effect<void, CanisterDeleteError | AgentError>
	createCanister: (params: {
		canisterId: string | undefined
		identity: SignIdentity
	}) => Effect.Effect<string, CanisterCreateError | CanisterStatusError | AgentError> // returns canister id
}

export class Replica extends Context.Tag("Replica")<
	Replica,
	ReplicaService
>() {}

export class DefaultReplica extends Context.Tag("DefaultReplica")<
	DefaultReplica,
	ReplicaService
>() {}
