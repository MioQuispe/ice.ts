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
		agent: HttpAgent
		// TODO: progress callback?
	}) => Effect.Effect<void, CanisterInstallError>
	// uninstallCode: (canisterId: string) => Effect.Effect<void, unknown, unknown>
	getCanisterStatus: (params: {
		canisterId: string
		agent: HttpAgent
	}) => Effect.Effect<CanisterStatus, CanisterStatusError>
	getCanisterInfo: (params: {
		canisterId: string
		agent: HttpAgent
	}) => Effect.Effect<CanisterInfo, CanisterStatusError>
	stopCanister: (params: {
		canisterId: string
		agent: HttpAgent
	}) => Effect.Effect<void, CanisterStopError>
	removeCanister: (params: {
		canisterId: string
		agent: HttpAgent
	}) => Effect.Effect<void, CanisterDeleteError>
	createCanister: (params: {
		canisterId: string | undefined
		agent: HttpAgent
	}) => Effect.Effect<string, CanisterCreateError | CanisterStatusError> // returns canister id
}

export class Replica extends Context.Tag("Replica")<
	Replica,
	ReplicaService
>() {}

export class DefaultReplica extends Context.Tag("DefaultReplica")<
	DefaultReplica,
	ReplicaService
>() {}
