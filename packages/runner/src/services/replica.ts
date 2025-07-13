import { type Effect, Context, Data } from "effect"
import type { ActorSubclass, HttpAgent, SignIdentity } from "@dfinity/agent"
import type { canister_status_result } from "src/canisters/management_latest/management.types.js"
import { Principal } from "@dfinity/principal"
import { type } from "arktype"
import { SubnetTopology } from "@dfinity/pic"

export const InstallModes = type("'install' | 'upgrade' | 'reinstall'")
// TODO: this gets a weird type. maybe arktype bug?
// export type InstallModes = typeof InstallModes.infer
export type InstallModes = "install" | "upgrade" | "reinstall"
// import { ActorInterface } from "@dfinity/pic"
/**
 * Typesafe method of a canister.
 *
 * @category Types
 */
export interface ActorMethod<Args extends any[] = any[], Ret = any> {
	(...args: Args): Promise<Ret>
}
/**
 * Candid interface of a canister.
 *
 * @category Types
 */
export type ActorInterface<T = object> = {
	[K in keyof T]: ActorMethod
}

export type CanisterStatus =
	| "not_found"
	// | "not_installed"
	| "stopped"
	| "stopping"
	| "running"

export const CanisterStatus = {
	NOT_FOUND: "not_found",
	// NOT_INSTALLED: "not_installed",
	STOPPED: "stopped",
	STOPPING: "stopping",
	RUNNING: "running",
} as const

type log_visibility =
	| { controllers: null }
	| { public: null }
	| { allowed_viewers: Array<Principal> }

type DefiniteCanisterSettings = {
	freezing_threshold: bigint
	controllers: Array<Principal>
	reserved_cycles_limit: bigint
	log_visibility: log_visibility
	wasm_memory_limit: bigint
	memory_allocation: bigint
	compute_allocation: bigint
}
// TODO: clean this up
export type CanisterStatusResult =
	| {
			status: Exclude<CanisterStatus, typeof CanisterStatus.NOT_FOUND>
			memory_size: bigint
			cycles: bigint
			settings: DefiniteCanisterSettings
			query_stats: {
				response_payload_bytes_total: bigint
				num_instructions_total: bigint
				num_calls_total: bigint
				request_payload_bytes_total: bigint
			}
			idle_cycles_burned_per_day: bigint
			module_hash: [] | [Array<number>]
			reserved_cycles: bigint
	  }
	| { status: typeof CanisterStatus.NOT_FOUND }

export type CanisterInfo = CanisterStatusResult

export class CanisterStatusError extends Data.TaggedError(
	"CanisterStatusError",
)<{
	readonly message: string
}> {}

export class CanisterInstallError extends Data.TaggedError(
	"CanisterInstallError",
)<{
	readonly message: string
}> {}

export class CanisterCreateError extends Data.TaggedError(
	"CanisterCreateError",
)<{
	readonly message: string
	readonly cause?: Error
}> {}

export class CanisterStopError extends Data.TaggedError("CanisterStopError")<{
	readonly message: string
}> {}

export class CanisterDeleteError extends Data.TaggedError(
	"CanisterDeleteError",
)<{
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
		mode: InstallModes
		// TODO: progress callback?
	}) => Effect.Effect<
		void,
		CanisterInstallError | AgentError | CanisterStatusError
	>
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
	}) => Effect.Effect<
		string,
		CanisterCreateError | CanisterStatusError | AgentError
	> // returns canister id
	createActor: <_SERVICE>(params: {
		canisterId: string
		canisterDID: any
		identity: SignIdentity
	}) => Effect.Effect<ActorSubclass<_SERVICE>, AgentError>
	getTopology: () => Effect.Effect<SubnetTopology[], AgentError>
}

export class Replica extends Context.Tag("Replica")<
	Replica,
	ReplicaService
>() {}

export class DefaultReplica extends Context.Tag("DefaultReplica")<
	DefaultReplica,
	ReplicaService
>() {}
