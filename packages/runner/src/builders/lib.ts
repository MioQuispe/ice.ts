import type { Task } from "../types/types.js"
import { Config, Effect, Option, Record } from "effect"
import { FileSystem } from "@effect/platform"
import { getTaskByPath, getNodeByPath, TaskCtx } from "../tasks/lib.js"
import { DependencyResults, runTask, TaskInfo } from "../tasks/run.js"
import { CanisterIdsService } from "../services/canisterIds.js"
import { Principal } from "@dfinity/principal"
import type {
	ExtractArgsFromTaskParams,
	TaskCtxShape,
	TaskParamsToArgs,
} from "../tasks/lib.js"
import type { ActorSubclass } from "../types/actor.js"
export type { TaskCtxShape }
import { sha256 } from "@noble/hashes/sha2"
import { utf8ToBytes, bytesToHex } from "@noble/hashes/utils"
import { readFileSync, statSync } from "node:fs"
import { stat } from "node:fs/promises"
import { Path } from "@effect/platform"
import { TaskRegistry } from "../services/taskRegistry.js"
import { IDL, JsonValue } from "@dfinity/candid"
import { encodeArgs } from "../canister.js"
import { makeCustomBuildTask, makeBindingsTask } from "./custom.js"
import { proxyActor } from "../utils/extension.js"
import {
	CanisterStatus,
	type CanisterStatusResult,
	InstallModes,
} from "../services/replica.js"
import { type } from "arktype"
import { StandardSchemaV1 } from "@standard-schema/spec"

export const loadCanisterId = (taskPath: string) =>
	Effect.gen(function* () {
		const canisterName = taskPath.split(":").slice(0, -1).join(":")
		const canisterIdsService = yield* CanisterIdsService
		const canisterIds = yield* canisterIdsService.getCanisterIds()
		const { currentNetwork } = yield* TaskCtx
		const canisterId = canisterIds[canisterName]?.[currentNetwork]
		if (canisterId) {
			return Option.some(canisterId as string)
		}
		return Option.none()
	})

export const resolveConfig = <T, P extends Record<string, unknown>>(
	configOrFn:
		| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<T>)
		| ((args: { ctx: TaskCtxShape; deps: P }) => T)
		| T,
) =>
	Effect.gen(function* () {
		const taskCtx = yield* TaskCtx
		if (typeof configOrFn === "function") {
			const configFn = configOrFn as (args: {
				ctx: TaskCtxShape
			}) => Promise<T> | T
			const configResult = configFn({ ctx: taskCtx })
			if (configResult instanceof Promise) {
				return yield* Effect.tryPromise({
					try: () => configResult,
					catch: (error) => {
						// TODO: proper error handling
						console.error("Error resolving config function:", error)
						return error instanceof Error ? error : new Error(String(error))
					},
				})
			}
			return configResult
		}
		return configOrFn
	})

type CreateConfig = {
	canisterId?: string
}
export const makeCreateTask = <P extends Record<string, unknown>>(
	canisterConfigOrFn:
		| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<CreateConfig>)
		| ((args: { ctx: TaskCtxShape; deps: P }) => CreateConfig)
		| CreateConfig,
	tags: string[] = [],
): CreateTask => {
	const id = Symbol("canister/create")
	return {
		_tag: "task",
		id,
		dependsOn: {},
		dependencies: {},
		effect: Effect.gen(function* () {
			const path = yield* Path.Path
			const fs = yield* FileSystem.FileSystem
			const canisterIdsService = yield* CanisterIdsService
			const taskCtx = yield* TaskCtx
			const currentNetwork = taskCtx.currentNetwork
			const { taskPath } = yield* TaskInfo
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			const storedCanisterIds = yield* canisterIdsService.getCanisterIds()
			const storedCanisterId: string | undefined =
				storedCanisterIds[canisterName]?.[currentNetwork]
			yield* Effect.logDebug("makeCreateTask", { storedCanisterId })
			const canisterConfig = yield* resolveConfig(canisterConfigOrFn)
			const configCanisterId = canisterConfig?.canisterId
			// TODO: handle all edge cases related to this. what happens
			// if the user provides a new canisterId in the config? and so on
			// and how about mainnet?
			const resolvedCanisterId = storedCanisterId ?? configCanisterId
			const {
				roles: {
					deployer: { identity },
				},
				replica,
			} = yield* TaskCtx
			yield* Effect.logDebug("resolvedCanisterId", { resolvedCanisterId })
			const canisterInfo = yield* replica
				.getCanisterInfo({
					canisterId: resolvedCanisterId,
					identity,
				})
				.pipe(
					Effect.catchTag("CanisterStatusError", (err) => {
						return Effect.succeed({
							status: CanisterStatus.NOT_FOUND,
						})
					}),
				)
			const isAlreadyInstalled =
				resolvedCanisterId && canisterInfo.status !== CanisterStatus.NOT_FOUND

			yield* Effect.logDebug("makeCreateTask", {
				isAlreadyInstalled,
				resolvedCanisterId,
			})

			const canisterId = isAlreadyInstalled
				? resolvedCanisterId
				: yield* replica.createCanister({
						canisterId: resolvedCanisterId,
						identity,
					})
			const appDir = yield* Config.string("APP_DIR")
			const iceDirName = yield* Config.string("ICE_DIR_NAME")
			yield* Effect.logDebug("create Task: setting canisterId", canisterId)
			// TODO: integrate with cache?
			yield* canisterIdsService.setCanisterId({
				canisterName,
				network: taskCtx.currentNetwork,
				canisterId,
			})
			const outDir = path.join(appDir, iceDirName, "canisters", canisterName)
			yield* fs.makeDirectory(outDir, { recursive: true })
			return canisterId
		}),
		description: "Create custom canister",
		// TODO: caching? now task handles it already
		tags: [Tags.CANISTER, Tags.CREATE, ...tags],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies CreateTask
}

export function hashUint8(data: Uint8Array): string {
	// noble/sha256 is universal (no Buffer, no crypto module)
	return bytesToHex(sha256(data))
}

// ensure deterministic key order
function stableStringify(value: unknown): string {
	return JSON.stringify(value, (_key, val) => {
		if (val && typeof val === "object" && !Array.isArray(val)) {
			// sort *all* object keys deterministically
			return Object.keys(val)
				.sort()
				.reduce<Record<string, unknown>>(
					(acc, k) => ((acc[k] = (val as any)[k]), acc),
					{},
				)
		}
		return val // primitives & arrays unchanged
	})
}

export function hashJson(value: unknown): string {
	const ordered = stableStringify(value)
	return hashUint8(utf8ToBytes(ordered))
}

export type FileDigest = {
	path: string
	mtimeMs: number
	sha256: string
}

export function digestFile(path: string): FileDigest {
	const buf = readFileSync(path)
	return {
		path,
		// mtimeMs: statSync(path).mtimeMs,
		// TODO:
		mtimeMs: 0,
		sha256: bytesToHex(sha256(buf)),
	}
}

export async function isArtifactCached(
	path: string,
	prev: FileDigest | undefined, // last run (undefined = cache miss)
): Promise<{ fresh: boolean; digest: FileDigest }> {
	// No previous record – must rebuild
	if (!prev) {
		return { fresh: false, digest: digestFile(path) }
	}

	// 1️⃣ fast-path : stat only
	const currentStat = await stat(path)
	if (currentStat.mtimeMs === prev.mtimeMs) {
		return { fresh: true, digest: prev } // timestamps match ⟹ assume fresh
	}

	// 2️⃣ slow-path : hash check
	const digest = digestFile(path)
	const fresh = digest.sha256 === prev.sha256
	return { fresh, digest }
}

/**
 * Hash the *transpiled* JS produced by tsx/ESBuild,
 * normalising obvious sources of noise (WS, CRLF).
 */
// TODO: support objects as well
export function hashConfig(config: Function | object): string {
	// 1. grab the transpiled source
	let txt =
		typeof config === "function" ? config.toString() : JSON.stringify(config)

	// 2. normalise line-endings and strip leading WS
	txt = txt
		.replace(/\r\n/g, "\n") // CRLF ⇒ LF
		.replace(/^[\s\t]+/gm, "") // leading indent
		.replace(/\s+$/gm, "") // trailing WS

	// 3. hash
	return bytesToHex(sha256(utf8ToBytes(txt)))
}

export type MergeTaskDependsOn<
	T extends Task,
	ND extends Record<string, Task>,
> = {
	[K in keyof T]: K extends "dependsOn" ? T[K] & ND : T[K]
} & Partial<
	Pick<
		Task,
		"computeCacheKey" | "input" | "decode" | "encode" | "encodingFormat"
	>
>

export type MergeTaskDependencies<
	T extends Task,
	NP extends Record<string, Task>,
> = {
	[K in keyof T]: K extends "dependencies" ? T[K] & NP : T[K]
} & Partial<
	Pick<
		Task,
		"computeCacheKey" | "input" | "decode" | "encode" | "encodingFormat"
	>
>

export type MergeScopeDependsOn<
	S extends CanisterScope,
	D extends Record<string, Task>,
> = Omit<S, "children"> & {
	children: Omit<S["children"], "install_args"> & {
		install_args: MergeTaskDependsOn<S["children"]["install_args"], D>
	}
}

// export type MergeScopeDependencies<
// 	S extends CanisterScope,
// 	NP extends Record<string, Task>,
// > = Omit<S, "children"> & {
// 	children: MergeAllChildrenDependencies<S["children"], NP>
// }

export type MergeScopeDependencies<
	S extends CanisterScope,
	D extends Record<string, Task>,
> = Omit<S, "children"> & {
	children: Omit<S["children"], "install_args"> & {
		install_args: MergeTaskDependencies<S["children"]["install_args"], D>
	}
}

/**
 * Extracts the success type of the Effect from each Task in a Record<string, Task>.
 *
 * @template T - A record of tasks.
 */
export type ExtractTaskEffectSuccess<T extends Record<string, Task>> = {
	[K in keyof T]: Effect.Effect.Success<T[K]["effect"]>
}

// TODO: create types
export type CreateTask = Task<string>
export type BindingsTask = Task<{
	didJSPath: string
	didTSPath: string
}>
export type BuildTask = Task<{
	wasmPath: string
	candidPath: string
}>

type InstallArgsInput = {
	installArgsFn: Function
	depCacheKeys: Record<string, string | undefined>
	mode: InstallModes
}
export type InstallArgsTask<
	I,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
> = Task<
	{
		args: I
		encodedArgs: Uint8Array<ArrayBufferLike>
		mode: InstallModes
	},
	D,
	P,
	InstallArgsInput
>
// install_args: ReturnType<typeof makeInstallArgsTask>
export type InstallTask<_SERVICE = unknown> = Omit<
	Task<{
		canisterId: string
		canisterName: string
		actor: ActorSubclass<_SERVICE>
		mode: InstallModes
	}>,
	"params"
> & {
	params: typeof installParams
}

// D,
// P
export type StopTask = Task<void>
export type RemoveTask = Task<void>
// TODO: same as install?
export type DeployTask<_SERVICE = unknown> = InstallTask<_SERVICE>
export type StatusTask = Task<{
	canisterName: string
	canisterId: string | undefined
	status: CanisterStatus
	info: CanisterStatusResult | undefined
}>

// TODO: use Scope type
export type CanisterScope<
	_SERVICE = any,
	I = any,
	D extends Record<string, Task> = Record<string, Task>,
	P extends Record<string, Task> = Record<string, Task>,
> = {
	_tag: "scope"
	id: symbol
	tags: Array<string | symbol>
	description: string
	defaultTask: "deploy"
	// only limited to tasks
	// children: Record<string, Task>
	children: {
		// create: Task<string>
		create: CreateTask
		bindings: BindingsTask
		build: BuildTask
		install_args: InstallArgsTask<I, D, P>
		// install_args: ReturnType<typeof makeInstallArgsTask>
		install: InstallTask<_SERVICE>
		// D,
		// P
		stop: StopTask
		remove: RemoveTask
		// TODO: same as install?
		deploy: DeployTask<_SERVICE>
		status: StatusTask
	}
}

export const Tags = {
	HIDDEN: "$$ice/hidden",

	CANISTER: "$$ice/canister",
	CUSTOM: "$$ice/canister/custom",
	MOTOKO: "$$ice/canister/motoko",
	RUST: "$$ice/canister/rust",
	AZLE: "$$ice/canister/azle",
	KYBRA: "$$ice/canister/kybra",

	CREATE: "$$ice/canister/create",
	STATUS: "$$ice/canister/status",
	BUILD: "$$ice/canister/build",
	INSTALL: "$$ice/canister/install",
	INSTALL_ARGS: "$$ice/canister/installArgs",
	BINDINGS: "$$ice/canister/bindings",
	DEPLOY: "$$ice/canister/deploy",
	STOP: "$$ice/canister/stop",
	REMOVE: "$$ice/canister/remove",
	UI: "$$ice/canister/ui",
}

// TODO: dont pass in tags, just make the effect

export type TaskReturnValue<T extends Task> = T extends {
	effect: Effect.Effect<infer S, any, any>
}
	? S
	: never

export type CompareTaskEffects<
	D extends Record<string, Task>,
	P extends Record<string, Task>,
> = (keyof D extends keyof P ? true : false) extends true
	? {
			[K in keyof D & keyof P]: TaskReturnValue<D[K]> extends TaskReturnValue<
				P[K]
			>
				? never
				: K
		}[keyof D & keyof P] extends never
		? P
		: never
	: never

export type AllowedDep = Task | CanisterScope

/**
 * If T is already a Task, it stays the same.
 * If T is a CanisterScope, returns its provided Task (assumed to be under the "provides" property).
 */
export type NormalizeDep<T> = T extends Task
	? T
	: T extends CanisterScope
		? T["children"]["install"] extends Task
			? T["children"]["install"]
			: never
		: never

/**
 * Normalizes a record of dependencies.
 */
// export type NormalizeDeps<Deps extends Record<string, AllowedDep>> = {
// 	[K in keyof Deps]: NormalizeDep<Deps[K]> extends Task
// 		? NormalizeDep<Deps[K]>
// 		: never
// }

export type NormalizeDeps<Deps extends Record<string, AllowedDep>> = {
	[K in keyof Deps]: Deps[K] extends Task
		? Deps[K]
		: Deps[K] extends CanisterScope
			? Deps[K]["children"]["install"]
			: never
}

export type ValidProvidedDeps<
	D extends Record<string, AllowedDep>,
	NP extends Record<string, AllowedDep>,
> = CompareTaskEffects<NormalizeDeps<D>, NormalizeDeps<NP>> extends never
	? never
	: NP

export type CompareTaskReturnValues<T extends Task> = T extends {
	effect: Effect.Effect<infer S, any, any>
}
	? S
	: never

type DependenciesOf<T> = T extends { dependsOn: infer D } ? D : never
type ProvideOf<T> = T extends { dependencies: infer P } ? P : never

type DependencyReturnValues<T> = DependenciesOf<T> extends Record<string, Task>
	? {
			[K in keyof DependenciesOf<T>]: CompareTaskReturnValues<
				DependenciesOf<T>[K]
			>
		}
	: never

type ProvideReturnValues<T> = ProvideOf<T> extends Record<string, Task>
	? { [K in keyof ProvideOf<T>]: CompareTaskReturnValues<ProvideOf<T>[K]> }
	: never

export type DepBuilder<T> = Exclude<
	Extract<keyof DependencyReturnValues<T>, string>,
	keyof ProvideReturnValues<T>
> extends never
	? DependencyReturnValues<T> extends Pick<
			ProvideReturnValues<T>,
			Extract<keyof DependencyReturnValues<T>, string>
		>
		? T
		: never
	: never

export type DependencyMismatchError<S extends CanisterScope> = {
	// This property key is your custom error message.
	"[ICE-ERROR: Dependency mismatch. Please provide all required dependencies.]": true
}

export type UniformScopeCheck<S extends CanisterScope> = S extends {
	children: {
		install_args: infer C
	}
}
	? C extends DepBuilder<C>
		? S
		: DependencyMismatchError<S>
	: DependencyMismatchError<S>

// Compute a boolean flag from our check.
export type IsValid<S extends CanisterScope> =
	UniformScopeCheck<S> extends DependencyMismatchError<S> ? false : true

//
// Helper Functions
//

// TODO: arktype match?
export function normalizeDep(dep: Task | CanisterScope): Task {
	if ("_tag" in dep && dep._tag === "task") return dep
	if ("_tag" in dep && dep._tag === "scope" && dep.children?.install)
		return dep.children.install as Task
	throw new Error("Invalid dependency type provided to normalizeDep")
}

/**
 * Normalizes a record of dependencies.
 */
export function normalizeDepsMap(
	dependencies: Record<string, AllowedDep>,
): Record<string, Task> {
	return Object.fromEntries(
		Object.entries(dependencies).map(([key, dep]) => [key, normalizeDep(dep)]),
	)
}

export const makeStopTask = (): StopTask => {
	return {
		_tag: "task",
		id: Symbol("customCanister/stop"),
		dependsOn: {},
		dependencies: {},
		// TODO: do we allow a fn as args here?
		effect: Effect.gen(function* () {
			const { taskPath } = yield* TaskInfo
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			// TODO: handle error
			const maybeCanisterId = yield* loadCanisterId(taskPath)
			if (Option.isNone(maybeCanisterId)) {
				yield* Effect.logDebug(
					`Canister ${canisterName} is not installed`,
					maybeCanisterId,
				)
				return
			}
			const canisterId = maybeCanisterId.value
			const {
				roles: {
					deployer: { identity },
				},
				replica,
			} = yield* TaskCtx
			// TODO: check if canister is running / stopped
			// get status first
			const status = yield* replica.getCanisterStatus({
				canisterId,
				identity,
			})
			if (status === CanisterStatus.STOPPED) {
				yield* Effect.logDebug(
					`Canister ${canisterName} is already stopped or not installed`,
					status,
				)
				return
			}
			yield* replica.stopCanister({
				canisterId,
				identity,
			})
			yield* Effect.logDebug(`Stopped canister ${canisterName}`)
		}),
		description: "Stop canister",
		// TODO: no tag custom
		tags: [Tags.CANISTER, Tags.STOP],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies Task<void>
}

export const makeRemoveTask = ({
	stop,
}: {
	stop: Task<void>
}): RemoveTask => {
	return {
		_tag: "task",
		id: Symbol("customCanister/remove"),
		dependsOn: {},
		dependencies: {
			stop,
		},
		// TODO: do we allow a fn as args here?
		effect: Effect.gen(function* () {
			const { taskPath } = yield* TaskInfo
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			// TODO: handle error
			const maybeCanisterId = yield* loadCanisterId(taskPath)
			if (Option.isNone(maybeCanisterId)) {
				yield* Effect.logDebug(
					`Canister ${canisterName} is not installed`,
					maybeCanisterId,
				)
				return
			}
			const canisterId = maybeCanisterId.value
			const {
				roles: {
					deployer: { identity },
				},
				replica,
			} = yield* TaskCtx
			yield* replica.removeCanister({
				canisterId,
				identity,
			})
			const canisterIdsService = yield* CanisterIdsService
			yield* canisterIdsService.removeCanisterId(canisterName)
			yield* Effect.logDebug(`Removed canister ${canisterName}`)
		}),
		description: "Remove canister",
		// TODO: no tag custom
		tags: [Tags.CANISTER, Tags.REMOVE],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies RemoveTask
}

export const makeCanisterStatusTask = (tags: string[]): StatusTask => {
	return {
		_tag: "task",
		// TODO: change
		id: Symbol("canister/status"),
		dependsOn: {},
		// TODO: we only want to warn at a type level?
		// TODO: type Task
		dependencies: {},
		effect: Effect.gen(function* () {
			// TODO:
			const { replica, currentNetwork } = yield* TaskCtx
			const { taskPath } = yield* TaskInfo
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			const canisterIdsService = yield* CanisterIdsService
			const canisterIdsMap = yield* canisterIdsService.getCanisterIds()
			// TODO: if deleted doesnt exist
			const canisterIds = canisterIdsMap[canisterName]
			if (!canisterIds) {
				return {
					canisterName,
					canisterId: undefined,
					status: CanisterStatus.NOT_FOUND,
					info: undefined,
				}
			}
			const canisterId = canisterIds[currentNetwork]
			if (!canisterId) {
				// TODO: fix format
				return {
					canisterName,
					canisterId,
					status: CanisterStatus.NOT_FOUND,
					info: undefined,
				}
			}
			// export interface canister_status_result {
			//   'status' : { 'stopped' : null } |
			//     { 'stopping' : null } |
			//     { 'running' : null },
			//   'memory_size' : bigint,
			//   'cycles' : bigint,
			//   'settings' : definite_canister_settings,
			//   'query_stats' : {
			//     'response_payload_bytes_total' : bigint,
			//     'num_instructions_total' : bigint,
			//     'num_calls_total' : bigint,
			//     'request_payload_bytes_total' : bigint,
			//   },
			//   'idle_cycles_burned_per_day' : bigint,
			//   'module_hash' : [] | [Array<number>],
			//   'reserved_cycles' : bigint,
			// }

			// const status = yield* Effect.tryPromise({
			// 	try: () =>
			// 		mgmt.canister_status({
			// 			canister_id: Principal.fromText(canisterId),
			// 		}),
			// 	catch: (err) =>
			// 		new DeploymentError({
			// 			message: `Failed to get status for ${canisterName}: ${
			// 				err instanceof Error ? err.message : String(err)
			// 			}`,
			// 		}),
			// // })
			const {
				roles: {
					deployer: { identity },
				},
			} = yield* TaskCtx
			const canisterInfo = yield* replica.getCanisterInfo({
				canisterId,
				identity,
			})
			const status = canisterInfo.status
			return { canisterName, canisterId, status, info: canisterInfo }
		}),
		description: "Get canister status",
		tags: [Tags.CANISTER, Tags.STATUS, ...tags],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies StatusTask
}

type Test = StandardSchemaV1.InferOutput<typeof InstallModes>

const installParams = {
	mode: {
		type: InstallModes,
		description: "The mode to install the canister in",
		// default: "install",
		isFlag: true as const,
		isOptional: true as const,
		isVariadic: false as const,
		name: "mode",
		aliases: ["m"],
		parse: (value: string) => value as InstallModes,
	},
	args: {
		type: type("string"),
		description: "The arguments to pass to the canister as a candid string",
		// default: undefined,
		isFlag: true as const,
		isOptional: true as const,
		isVariadic: false as const,
		name: "args",
		aliases: ["a"],
		parse: (value: string) => value as string,
	},
}

const resolveMode = () => {
	return Effect.gen(function* () {
		const {
			replica,
			args,
			currentNetwork,
			roles: {
				deployer: { identity },
			},
		} = yield* TaskCtx
		const { taskPath } = yield* TaskInfo
		const taskArgs = args as {
			mode: InstallModes
		}
		const canisterName = taskPath.split(":").slice(0, -1).join(":")
		const canisterIdsService = yield* CanisterIdsService
		const canisterIdsMap = yield* canisterIdsService.getCanisterIds()
		const canisterExists = canisterName in canisterIdsMap
		// const canisterIds = canisterIdsMap[canisterName]
		// TODO: could be undefined
		// TODO: use Option.Option
		// const canisterId = canisterExists ? canisterIds[currentNetwork] : undefined
		const canisterInfo = canisterExists
			? yield* replica
					.getCanisterInfo({
						canisterId: canisterIdsMap[canisterName][currentNetwork],
						identity,
					})
					.pipe(
						Effect.catchTag("CanisterStatusError", (err) => {
							// TODO: previous canister_ids could exist
							// but canister not even created
							return Effect.succeed({
								status: CanisterStatus.NOT_FOUND,
							})
						}),
					)
			: ({
					status: CanisterStatus.NOT_FOUND,
				} as const)

		// yield* Effect.logDebug("canisterInfo", canisterInfo)
		// TODO: reinstall // user can pass it in?
		// TODO: what happens to stopped / stopping canisters here?

		// TODO: from installArgsTask::::::
		/////////////////////////////
		// const taskArgs = args as {
		// 	// TODO: use option
		// 	// mode: Option.Option<"install" | "upgrade" | "reinstall">
		// 	mode: "install" | "upgrade" | "reinstall"
		// }
		// // TODO: needs to check canister status and other things
		// let mode: "install" | "upgrade" | "reinstall" = "install"
		// if ("mode" in taskArgs) {
		// 	mode = taskArgs.mode
		// } else {
		// 	// TODO: check status and other things
		// 	// const mode = taskArgs.mode ?? "install"
		// 	// const mode = parentArgs?.mode ?? "install"
		// 	// const mode = "install"
		// 	mode = "install"
		// }

		if ("mode" in taskArgs && taskArgs.mode !== undefined) {
			return taskArgs.mode
		}

		const notInstalled =
			canisterInfo.status !== CanisterStatus.NOT_FOUND &&
			canisterInfo.module_hash.length === 0
		// let mode = taskArgs?.mode
		let mode: InstallModes = "install"
		// TODO: taskArgs should override this!!!
		// or throw error???
		if (canisterInfo.status === CanisterStatus.STOPPING) {
			mode = "reinstall"
			if (notInstalled) {
				mode = "install"
			}
		} else if (canisterInfo.status === CanisterStatus.NOT_FOUND) {
			mode = "install"
		} else if (canisterInfo.status === CanisterStatus.STOPPED) {
			mode = "upgrade"
			if (notInstalled) {
				mode = "install"
			}
		} else if (canisterInfo.status === CanisterStatus.RUNNING) {
			mode = "upgrade"
			if (notInstalled) {
				mode = "install"
			}
		}
		return mode
	})
}

export const makeInstallTask = <
	I,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	_SERVICE,
>({
	install_args,
	build,
	bindings,
	create,
}: {
	install_args: InstallArgsTask<I, D, P>
	build: BuildTask
	bindings: BindingsTask
	create: CreateTask
}): InstallTask<_SERVICE> => {
	type InstallInput = {
		network: string
		canisterId: string
		canisterName: string
		taskPath: string
		mode: string
		depCacheKeys: Record<string, string | undefined>
	}
	return {
		_tag: "task",
		id: Symbol("customCanister/install"),
		dependsOn: {},
		dependencies: {
			install_args,
			build,
			bindings,
			create,
		},
		// TODO: allow passing in candid as a string from CLI
		namedParams: installParams,
		positionalParams: [],
		params: installParams,
		effect: Effect.gen(function* () {
			yield* Effect.logDebug("Starting custom canister installation")
			const taskCtx = yield* TaskCtx
			const identity = taskCtx.roles.deployer.identity
			const { replica, args } = taskCtx
			const { dependencies } = yield* DependencyResults
			const taskArgs = args as {
				mode: InstallModes
				args: string
			}

			// TODO: fix. also type should be inferred?
			const argsTaskResult = dependencies.install_args.result as {
				args: I
				encodedArgs: Uint8Array<ArrayBufferLike>
			}
			const { didJSPath, didTSPath } = dependencies.bindings.result as {
				didJSPath: string
				didTSPath: string
			}
			const { wasmPath } = dependencies.build.result as {
				wasmPath: string
				candidPath: string
			}
			const { taskPath } = yield* TaskInfo
			const canisterName = taskPath.split(":").slice(0, -1).join(":")

			const maybeCanisterId = yield* loadCanisterId(taskPath)
			if (Option.isNone(maybeCanisterId)) {
				yield* Effect.logDebug(
					`Canister ${canisterName} is not installed`,
					maybeCanisterId,
				)
				return yield* Effect.fail(
					new Error(`Canister ${canisterName} is not installed`),
				)
			}
			const canisterId = maybeCanisterId.value
			yield* Effect.logDebug("Loaded canister ID", { canisterId })
			const fs = yield* FileSystem.FileSystem

			const canisterInfo = yield* replica.getCanisterInfo({
				canisterId,
				identity,
			})
			yield* Effect.logDebug("canisterInfo", canisterInfo)
			// TODO: reinstall // user can pass it in?
			// TODO: what happens to stopped / stopping canisters here?

			// const notInstalled =
			// 	canisterInfo.status !== CanisterStatus.NOT_FOUND &&
			// 	canisterInfo.module_hash.length === 0
			// let mode = taskArgs.mode
			// if (canisterInfo.status === CanisterStatus.STOPPING) {
			// 	mode = "reinstall"
			// 	if (notInstalled) {
			// 		mode = "install"
			// 	}
			// } else if (canisterInfo.status === CanisterStatus.NOT_FOUND) {
			// 	mode = "install"
			// } else if (canisterInfo.status === CanisterStatus.STOPPED) {
			// 	mode = "upgrade"
			// 	if (notInstalled) {
			// 		mode = "install"
			// 	}
			// } else if (canisterInfo.status === CanisterStatus.RUNNING) {
			// 	mode = "upgrade"
			// 	if (notInstalled) {
			// 		mode = "install"
			// 	}
			// }
			const mode = yield* resolveMode()
			// TODO: "install" doesnt work for certain canisters for some reason

			// TODO:
			// they can return the values we need perhaps? instead of reading from fs
			// we need the wasm blob and candid DIDjs / idlFactory?
			const wasmContent = yield* fs.readFile(wasmPath)
			const wasm = new Uint8Array(wasmContent)
			const maxSize = 3670016
			yield* Effect.logDebug(
				`Installing code for ${canisterId} at ${wasmPath} with mode ${mode}`,
			)
			yield* Effect.logDebug("argsTaskResult", argsTaskResult)
			yield* replica.installCode({
				canisterId,
				wasm,
				encodedArgs: argsTaskResult.encodedArgs,
				identity,
				mode,
			})
			yield* Effect.logDebug(`Code installed for ${canisterId}`)
			yield* Effect.logDebug(`Canister ${canisterName} installed successfully`)
			// TODO: can we type it somehow?
			const canisterDID = yield* Effect.tryPromise({
				try: () => import(didJSPath),
				catch: Effect.fail,
			})
			const actor = yield* replica.createActor<_SERVICE>({
				canisterId,
				canisterDID,
				identity,
			})
			return {
				canisterId,
				canisterName,
				mode,
				actor: proxyActor(canisterName, actor),
			}
		}),
		description: "Install canister code",
		tags: [Tags.CANISTER, Tags.CUSTOM, Tags.INSTALL],
		// TODO: add network?
		computeCacheKey: (input: InstallInput) => {
			// TODO: pocket-ic could be restarted?
			const installInput = {
				canisterId: input.canisterId,
				network: input.network,
				mode: input.mode,
				depsHash: hashJson(input.depCacheKeys),
			}
			const cacheKey = hashJson(installInput)
			return cacheKey
		},
		input: () =>
			Effect.gen(function* () {
				const { taskPath } = yield* TaskInfo
				const { args } = yield* TaskCtx
				const canisterName = taskPath.split(":").slice(0, -1).join(":")
				const { dependencies } = yield* DependencyResults
				const depCacheKeys = Record.map(dependencies, (dep) => dep.cacheKey)
				const maybeCanisterId = yield* loadCanisterId(taskPath)
				if (Option.isNone(maybeCanisterId)) {
					yield* Effect.logDebug(
						`Canister ${canisterName} is not installed`,
						maybeCanisterId,
					)
					return yield* Effect.fail(
						new Error(`Canister ${canisterName} is not installed`),
					)
				}
				const canisterId = maybeCanisterId.value
				const { currentNetwork } = yield* TaskCtx
				// TODO: get from args? what about cliFlags?
				// if its install / reinstall then invalidate the cache?
				// const canisterInfo = yield* replica.getCanisterInfo({
				// 	canisterId,
				// 	identity,
				// })
				// const mode = "upgrade"
				const mode = yield* resolveMode()
				// const mode =
				// 	canisterInfo.status === CanisterStatus.NOT_FOUND ? "install" : taskArgs.mode
				// TODO: input runs before the task is executed
				// so how do we get the install args? from a previous run perhaps?
				const taskRegistry = yield* TaskRegistry
				// TODO: we need a separate cache for this?
				const input = {
					canisterId,
					canisterName,
					network: currentNetwork,
					taskPath,
					mode,
					depCacheKeys,
				} satisfies InstallInput
				return input
			}),
		// TODO: fix generic type? we shouldnt have to type this
		encode: (result, input) =>
			Effect.gen(function* () {
				const encoded = JSON.stringify({
					canisterId: result.canisterId,
					canisterName: result.canisterName,
					mode: result.mode,
				})
				return encoded
			}),
		decode: (value, input) =>
			Effect.gen(function* () {
				const { canisterId, canisterName, mode } = JSON.parse(
					value as string,
				) as {
					canisterId: string
					canisterName: string
					mode: InstallModes
				}
				const {
					replica,
					roles: {
						deployer: { identity },
					},
				} = yield* TaskCtx
				const { dependencies } = yield* DependencyResults
				const { didJSPath } = dependencies.bindings.result as {
					didJSPath: string
				}
				// TODO: can we type it somehow?
				const canisterDID = yield* Effect.tryPromise({
					try: () => import(didJSPath),
					catch: Effect.fail,
				})
				const actor = yield* replica.createActor<_SERVICE>({
					canisterId,
					canisterDID,
					identity,
				})
				const decoded = {
					mode,
					canisterId,
					canisterName,
					actor: proxyActor(canisterName, actor),
				} satisfies {
					mode: InstallModes
					canisterId: string
					canisterName: string
					actor: ActorSubclass<_SERVICE>
				}
				return decoded
			}),
	} satisfies InstallTask<_SERVICE>
}

export const makeDeployTask = <_SERVICE>(
	tags: string[],
): DeployTask<_SERVICE> => {
	return {
		_tag: "task",
		// TODO: change
		id: Symbol("canister/deploy"),
		dependsOn: {},
		// TODO: we only want to warn at a type level?
		// TODO: type Task
		dependencies: {},
		namedParams: installParams,
		params: installParams,
		positionalParams: [],
		effect: Effect.gen(function* () {
			const { taskPath } = yield* TaskInfo
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			const parentScope = (yield* getNodeByPath(
				canisterName,
			)) as CanisterScope<_SERVICE>
			const { args } = yield* TaskCtx
			// TODO: we need to pass in mode to installArgs as well somehow?
			// maybe use some kind of context?
			const result = yield* runTask(parentScope.children.install)
			yield* Effect.logDebug("Canister deployed successfully")
			return result
		}),
		description: "Deploy canister code",
		tags: [Tags.CANISTER, Tags.DEPLOY, ...tags],
	} satisfies DeployTask<_SERVICE>
}

export const linkChildren = <A extends Record<string, Task>>(
	children: A,
): A => {
	// 1️⃣  fresh copies with new ids
	const fresh = Record.map(children, (task) => ({
		...task,
		id: Symbol("task"),
	})) as A

	// 2️⃣  start with fresh, then relink all edges to the final map
	const linked = { ...fresh } as A

	for (const k in linked) {
		const t = linked[k]
		// @ts-ignore
		linked[k] = {
			...t,
			dependsOn: Record.map(t.dependsOn, (v, key) =>
				key in linked ? linked[key as keyof A] : v,
			),
			dependencies: Record.map(t.dependencies, (v, key) =>
				key in linked ? linked[key as keyof A] : v,
			),
		} as Task
	}

	return linked
}

/**
 * Represents the expected structure of a dynamically imported DID module.
 */
export interface CanisterDidModule {
	idlFactory: IDL.InterfaceFactory
	init: (args: { IDL: typeof IDL }) => IDL.Type[]
}

export const makeInstallArgsTask = <
	A,
	_SERVICE,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
>(
	installArgsFn: (args: {
		ctx: TaskCtxShape
		mode: InstallModes
		deps: ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>
	}) => Promise<A> | A,
	dependsOn: D,
	dependencies: P & {
		bindings: BindingsTask
		create: CreateTask
	},
	// canisterTaskDeps: {
	// },
	{
		customEncode,
		// customInitIDL,
	}: {
		customEncode:
			| undefined
			| ((args: A) => Effect.Effect<Uint8Array<ArrayBufferLike>>)
		// customInitIDL: IDL.Type[] | undefined
	} = {
		customEncode: undefined,
		// customInitIDL: undefined,
	},
): InstallArgsTask<A, D, typeof dependencies> => {
	return {
		_tag: "task",
		id: Symbol("canister/installArgs"),
		// TODO: do we need this?
		dependsOn,
		dependencies,
		namedParams: installParams,
		positionalParams: [],
		params: installParams,
		effect: Effect.gen(function* () {
			yield* Effect.logDebug("Starting install args generation")
			const taskCtx = yield* TaskCtx
			const { dependencies: deps } = yield* DependencyResults
			const depResults = Record.map(deps, (dep) => dep.result)
			const { taskPath } = yield* TaskInfo
			// TODO: this is already passed in from outside?
			const { args } = yield* TaskCtx
			yield* Effect.logDebug("makeInstallArgsTask TaskCtx.args", args)

			const mode = yield* resolveMode()

			let installArgs = [] as unknown as A
			if (installArgsFn) {
				yield* Effect.logDebug("Executing install args function")

				const installFn = installArgsFn as (args: {
					ctx: TaskCtxShape
					mode: InstallModes
					deps: ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>
				}) => Promise<A> | A
				// TODO: should it catch errors?
				// TODO: handle different modes
				const installResult = installFn({
					mode,
					ctx: taskCtx,
					deps: depResults as ExtractTaskEffectSuccess<D> &
						ExtractTaskEffectSuccess<P>,
				})
				if (installResult instanceof Promise) {
					installArgs = yield* Effect.tryPromise({
						try: () => installResult,
						catch: (error) => {
							// TODO: proper error handling
							return error instanceof Error ? error : new Error(String(error))
						},
					})
				} else {
					installArgs = installResult
				}
				yield* Effect.logDebug("installArgsFn effect result:", installResult)
			}
			yield* Effect.logDebug("Install args generated", { args: installArgs })

			const { result: bindingsResult } = deps.bindings
			// @ts-ignore
			const { didJSPath, didTSPath } = bindingsResult
			// // TODO: can we type it somehow?
			const canisterDID = yield* Effect.tryPromise({
				try: () => import(didJSPath) as Promise<CanisterDidModule>,
				catch: Effect.fail,
			})
			yield* Effect.logDebug("Loaded canisterDID", { canisterDID })

			yield* Effect.logDebug("Encoding args", { installArgs, canisterDID })
			const encodedArgs = customEncode
				? yield* customEncode(installArgs)
				: yield* Effect.try({
						// TODO: do we accept simple objects as well?
						// @ts-ignore
						try: () => encodeArgs(installArgs, canisterDID),
						catch: (error) => {
							throw new Error(
								`Failed to encode args: ${error instanceof Error ? error.message : String(error)}`,
							)
						},
					})

			return { args: installArgs, encodedArgs, mode }
		}),
		description: "Generate install args",
		tags: [Tags.CANISTER, Tags.CUSTOM, Tags.INSTALL_ARGS, Tags.HIDDEN],
		// TODO: add network?
		computeCacheKey: (input: InstallArgsInput) => {
			// const installArgsInput = {
			// 	argFnHash: input.argFnHash,
			// 	depsHash: input.depsHash,
			// }
			const installArgsInput = {
				argFnHash: hashConfig(input.installArgsFn),
				depsHash: hashJson(input.depCacheKeys),
				mode: input.mode,
			}
			const cacheKey = hashJson(installArgsInput)
			return cacheKey
		},
		input: () =>
			Effect.gen(function* () {
				const { dependencies } = yield* DependencyResults
				const depCacheKeys = Record.map(dependencies, (dep) => dep.cacheKey)
				const { args } = yield* TaskCtx
				// const taskArgs = args as {
				// 	mode: "install" | "upgrade" | "reinstall"
				// }
				// const taskArgs = args as {
				// 	mode: "install" | "upgrade" | "reinstall"
				// }
				// // TODO: needs to check canister status and other things
				// let mode: "install" | "upgrade" | "reinstall" = "install"
				// if ("mode" in taskArgs) {
				// 	mode = taskArgs.mode
				// } else {
				// 	// TODO: check status and other things
				// 	// const mode = taskArgs.mode ?? "install"
				// 	// const mode = parentArgs?.mode ?? "install"
				// 	// const mode = "install"
				// 	mode = "install"
				// }
				const mode = yield* resolveMode()
				yield* Effect.logDebug(
					"hashing installArgsFn:",
					installArgsFn.toString(),
				)
				const input = {
					installArgsFn,
					depCacheKeys,
					mode,
				} satisfies InstallArgsInput
				yield* Effect.logDebug("input:", input)
				return input
			}),
		encodingFormat: customEncode ? "string" : "uint8array",
		encode: (result, input) =>
			Effect.gen(function* () {
				yield* Effect.logDebug("decoding:", result)
				if (customEncode) {
					// TODO: stringify? or uint8array?
					return JSON.stringify(result.args)
				}
				yield* Effect.logDebug("encoded:", result.encodedArgs)
				// TODO: need to encode mode as well?
				return result.encodedArgs
			}),
		// TODO: noEncodeArgs messes this up
		decode: (prev, input) =>
			Effect.gen(function* () {
				// TODO: fix
				const encoded = prev as Uint8Array<ArrayBufferLike>
				// TODO: get from candid / bindings task result instead?
				// this task should depend on that and just get its result
				const { dependencies } = yield* DependencyResults
				// const depCacheKeys = Record.map(dependencies, (dep) => dep.cacheKey)
				// const depResult = dependencies.bindings.result
				const path = yield* Path.Path
				const appDir = yield* Config.string("APP_DIR")
				const { taskPath } = yield* TaskInfo
				const canisterName = taskPath.split(":").slice(0, -1).join(":")
				const iceDirName = yield* Config.string("ICE_DIR_NAME")
				const didJSPath = path.join(
					appDir,
					iceDirName,
					"canisters",
					canisterName,
					`${canisterName}.did.js`,
				)

				if (customEncode) {
					const decoded = JSON.parse(encoded as unknown as string) as A
					// TODO: use customEncode again
					const customEncoded = yield* customEncode(decoded)
					return {
						encodedArgs: customEncoded,
						args: decoded,
						mode: input.mode,
					}
				}

				// TODO: can we type it somehow?
				const canisterDID = yield* Effect.tryPromise({
					try: () => import(didJSPath) as Promise<CanisterDidModule>,
					catch: Effect.fail,
				})

				// TODO: will .init work with upgrades?

				// TODO: custom init IDL. mainly for nns canisters
				// const idl = customInitIDL ?? canisterDID.init({ IDL })
				const idl = canisterDID.init({ IDL })
				yield* Effect.logDebug(
					"decoding value",
					"with type:",
					typeof encoded,
					"with value:",
					encoded,
					"with idl:",
					idl,
				)
				// TODO: customEncode maybe messes this up?
				const decoded = IDL.decode(idl, encoded.slice().buffer) as A

				yield* Effect.logDebug("decoded:", decoded)
				return {
					encodedArgs: encoded,
					args: decoded,
					mode: input.mode,
				}
			}),
	}
}

const testTask = {
	_tag: "task",
	id: Symbol("test"),
	dependsOn: {},
	dependencies: {},
	effect: Effect.gen(function* () {
		return { testTask: "test" }
	}),
	description: "",
	tags: [],
	namedParams: {},
	positionalParams: [],
	params: {},
} satisfies Task

const testTask2 = {
	_tag: "task",
	id: Symbol("test"),
	dependsOn: {},
	dependencies: {},
	effect: Effect.gen(function* () {
		return { testTask2: "test" }
	}),
	description: "",
	tags: [],
	namedParams: {},
	positionalParams: [],
	params: {},
} satisfies Task

const providedTask = {
	_tag: "task",
	id: Symbol("test"),
	effect: Effect.gen(function* () {}),
	description: "",
	tags: [],
	dependsOn: {
		test: testTask,
	},
	dependencies: {
		test: testTask,
	},
	namedParams: {},
	positionalParams: [],
	params: {},
} satisfies Task

const unProvidedTask = {
	_tag: "task",
	id: Symbol("test"),
	effect: Effect.gen(function* () {}),
	description: "",
	tags: [],
	dependsOn: {
		test: testTask,
		test2: testTask,
	},
	dependencies: {
		test: testTask,
		// TODO: does not raise a warning?
		// test2: testTask2,
		// test2: testTask,
		// test3: testTask,
	},
	namedParams: {},
	positionalParams: [],
	params: {},
} satisfies Task

const unProvidedTask2 = {
	_tag: "task",
	id: Symbol("test"),
	effect: Effect.gen(function* () {}),
	description: "",
	tags: [],
	dependsOn: {
		test: testTask,
		// test2: testTask,
	},
	dependencies: {
		// test: testTask,
		// TODO: does not raise a warning?
		// test2: testTask2,
		// test2: testTask,
		// test3: testTask,
	},
	namedParams: {},
	positionalParams: [],
	params: {},
} satisfies Task

const testScope = {
	_tag: "scope",
	tags: [Tags.CANISTER],
	description: "",
	id: Symbol("scope"),
	children: {
		providedTask,
		unProvidedTask,
	},
}

const testScope2 = {
	_tag: "scope",
	tags: [Tags.CANISTER],
	description: "",
	id: Symbol("scope"),
	children: {
		unProvidedTask2,
	},
}

const providedTestScope = {
	_tag: "scope",
	tags: [Tags.CANISTER],
	description: "",
	id: Symbol("scope"),
	children: {
		providedTask,
	},
}

const encodingTask: Task = {
	_tag: "task",
	id: Symbol("test"),
	effect: Effect.gen(function* () {}),
	description: "",
	tags: [],
	dependsOn: {
		test: testTask,
	},
	dependencies: {
		test: testTask,
	},
	namedParams: {},
	positionalParams: [],
	params: {},
	encodingFormat: "string",
	encode: (result, input) =>
		Effect.gen(function* () {
			return JSON.stringify(result)
		}),
	// decode: (prev, input) =>
	// 	Effect.gen(function* () {
	// 		return JSON.parse(prev as unknown as string)
	// 	}),
} satisfies Task