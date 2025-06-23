import type { Task } from "../types/types.js"
import { Config, Effect, Option, Record } from "effect"
import { getTaskByPath, getNodeByPath, TaskCtx } from "../tasks/lib.js"
import { DependencyResults, runTask, TaskInfo } from "../tasks/run.js"
import { CanisterIdsService } from "../services/canisterIds.js"
import { Principal } from "@dfinity/principal"
import type { TaskCtxShape } from "../tasks/lib.js"
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
import {
	makeCreateTask,
	makeCustomBuildTask,
	makeCustomBindingsTask,
} from "./custom.js"

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
export function hashCallback(fn: Function): string {
	// 1. grab the transpiled source
	let txt = fn.toString()

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

// TODO: use Scope type
export type CanisterScope<
	_SERVICE = unknown,
	I = unknown,
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
		create: ReturnType<typeof makeCreateTask>
		bindings: ReturnType<typeof makeCustomBindingsTask>
		build: ReturnType<typeof makeCustomBuildTask>
		install_args: Task<
			{
				args: I
				encodedArgs: Uint8Array<ArrayBufferLike>
			},
			D,
			P
		>
		// install_args: ReturnType<typeof makeInstallArgsTask>
		install: Task<{
			canisterId: string
			canisterName: string
			actor: ActorSubclass<_SERVICE>
		}>
		// D,
		// P
		stop: Task<void>
		remove: Task<void>
		// TODO: same as install?
		deploy: Task<void>
		status: Task<{
			canisterName: string
			canisterId: string | undefined
			status: CanisterStatus | { not_installed: null }
		}>
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

type CanisterStatus = "not_installed" | "stopped" | "running" | "stopping"

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
		? T["children"]["install_args"] extends Task
			? T["children"]["install_args"]
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
			? Deps[K]["children"]["install_args"]
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

export const makeCanisterStatusTask = (
	tags: string[],
): Task<{
	canisterName: string
	canisterId: string | undefined
	status: CanisterStatus
}> => {
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
					status: "not_installed",
				}
			}
			const canisterId = canisterIds[currentNetwork]
			if (!canisterId) {
				// TODO: fix format
				return { canisterName, canisterId, status: "not_installed" }
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
			return { canisterName, canisterId, status }
		}),
		description: "Get canister status",
		tags: [Tags.CANISTER, Tags.STATUS, ...tags],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies Task<{
		canisterName: string
		canisterId: string | undefined
		status: CanisterStatus
	}>
}

export const makeDeployTask = (tags: string[]): Task<void> => {
	return {
		_tag: "task",
		// TODO: change
		id: Symbol("canister/deploy"),
		dependsOn: {},
		// TODO: we only want to warn at a type level?
		// TODO: type Task
		dependencies: {},
		effect: Effect.gen(function* () {
			const { taskPath } = yield* TaskInfo
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			const parentScope = (yield* getNodeByPath(canisterName)) as CanisterScope
			// const [canisterId] = yield* Effect.all(
			// 	[
			// 		Effect.gen(function* () {
			// 			const canisterId = (yield* runTask(
			// 				parentScope.children.create,
			// 			)) as unknown as string
			// 			return canisterId
			// 		}),
			// 		Effect.gen(function* () {
			// 			if (parentScope.tags.includes(Tags.MOTOKO)) {
			// 				// Moc generates candid and wasm files in the same phase
			// 				yield* Effect.logDebug("Now running build task")
			// 				yield* runTask(parentScope.children.build)
			// 				yield* Effect.logDebug("Now running bindings task")
			// 				yield* runTask(parentScope.children.bindings)
			// 				yield* Effect.logDebug(
			// 					"Finished running build and bindings tasks",
			// 				)
			// 			} else {
			// 				yield* Effect.all(
			// 					[
			// 						runTask(parentScope.children.build),
			// 						runTask(parentScope.children.bindings),
			// 					],
			// 					{
			// 						concurrency: "unbounded",
			// 					},
			// 				)
			// 			}
			// 		}),
			// 	],
			// 	{
			// 		concurrency: "unbounded",
			// 	},
			// )
			yield* Effect.logDebug("Now running install task")
			const result = yield* runTask(parentScope.children.install)
			yield* Effect.logDebug("Canister deployed successfully")
			// return canisterId
		}),
		description: "Deploy canister code",
		tags: [Tags.CANISTER, Tags.DEPLOY, ...tags],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies Task<void>
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
			dependsOn: Record.map(t.dependsOn, (v, key) => key in linked ? linked[key as keyof A] : v),
			dependencies: Record.map(t.dependencies, (v, key) => key in linked ? linked[key as keyof A] : v),
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
	P extends Record<string, unknown>,
	_SERVICE,
>(
	installArgsFn: (args: {
		ctx: TaskCtxShape
		mode: string
		deps: P
	}) => Promise<A> | A,
	// TODO: add deps
	dependencies: {
		bindings: Task<{
			didJS: string
			didJSPath: string
			didTSPath: string
		}>
	},
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
): Task<{
	args: A
	encodedArgs: Uint8Array<ArrayBufferLike>
}> => {
	type InstallArgsInput = {
		installArgsFn: Function
		depCacheKeys: Record<string, string | undefined>
	}
	return {
		_tag: "task",
		id: Symbol("canister/installArgs"),
		// TODO: do we need this?
		dependsOn: {},
		dependencies,
		effect: Effect.gen(function* () {
			yield* Effect.logDebug("Starting install args generation")
			const taskCtx = yield* TaskCtx
			const { dependencies } = yield* DependencyResults
			const deps = Record.map(dependencies, (dep) => dep.result)
			const { taskPath } = yield* TaskInfo
			const path = yield* Path.Path
			const appDir = yield* Config.string("APP_DIR")
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			const iceDirName = yield* Config.string("ICE_DIR_NAME")

			let installArgs = [] as unknown as A
			if (installArgsFn) {
				yield* Effect.logDebug("Executing install args function")

				const installFn = installArgsFn as (args: {
					ctx: TaskCtxShape
					mode: string
					deps: P
				}) => Promise<A> | A
				// TODO: should it catch errors?
				// TODO: handle different modes
				const installResult = installFn({
					mode: "install",
					ctx: taskCtx,
					deps: deps as P,
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
			// TODO: this is not working!
			yield* Effect.logDebug("installArgsFn effect:", {
				installArgsFn: installArgsFn.toString(),
			})
			yield* Effect.logDebug("Install args generated", { args: installArgs })

			// const didJSPath = path.join(
			// 	appDir,
			// 	iceDirName,
			// 	"canisters",
			// 	canisterName,
			// 	`${canisterName}.did.js`,
			// )
			// // TODO: can we type it somehow?
			// const canisterDID = yield* Effect.tryPromise({
			// 	try: () => import(didJSPath) as Promise<CanisterDidModule>,
			// 	catch: Effect.fail,
			// })
			const { result: bindingsResult } = dependencies.bindings
			// @ts-ignore
			const { didJS, didJSPath, didTSPath } = bindingsResult
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

			return { args: installArgs, encodedArgs }
		}),
		description: "Generate install args",
		tags: [Tags.CANISTER, Tags.CUSTOM, Tags.INSTALL_ARGS, Tags.HIDDEN],
		namedParams: {},
		positionalParams: [],
		params: {},
		// TODO: add network?
		computeCacheKey: (task, input: InstallArgsInput) => {
			// const installArgsInput = {
			// 	argFnHash: input.argFnHash,
			// 	depsHash: input.depsHash,
			// }
			const installArgsInput = {
				argFnHash: hashCallback(input.installArgsFn),
				depsHash: hashJson(input.depCacheKeys),
			}
			const cacheKey = hashJson(installArgsInput)
			return cacheKey
		},
		input: (task) =>
			Effect.gen(function* () {
				const { dependencies } = yield* DependencyResults
				const depCacheKeys = Record.map(dependencies, (dep) => dep.cacheKey)
				yield* Effect.logDebug(
					"hashing installArgsFn:",
					installArgsFn.toString(),
				)
				const input = {
					installArgsFn,
					depCacheKeys,
				} satisfies InstallArgsInput
				yield* Effect.logDebug("input:", input)
				return input
			}),
		encodingFormat: customEncode ? "string" : "uint8array",
		encode: (result: {
			args: A
			encodedArgs: Uint8Array<ArrayBufferLike>
		}) =>
			Effect.gen(function* () {
				if (customEncode) {
					// TODO: stringify? or uint8array?
					return JSON.stringify(result.args)
				}
				yield* Effect.logDebug("encoded:", result.encodedArgs)
				return result.encodedArgs
			}),
		// TODO: noEncodeArgs messes this up
		decode: (prev) =>
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
					}
				}

				// TODO: can we type it somehow?
				const canisterDID = yield* Effect.tryPromise({
					try: () => import(didJSPath) as Promise<CanisterDidModule>,
					catch: Effect.fail,
				})

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
