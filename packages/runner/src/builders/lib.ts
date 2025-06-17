import type { Task } from "../types/types.js"
import { Effect, Option } from "effect"
import { getTaskByPath, getNodeByPath, TaskCtx } from "../tasks/lib.js"
import { runTask, TaskInfo } from "../tasks/run.js"
import { CanisterIdsService } from "../services/canisterIds.js"
import { Principal } from "@dfinity/principal"
import type { TaskCtxShape } from "../tasks/lib.js"
import type { ActorSubclass } from "../types/actor.js"
export type { TaskCtxShape }
import { sha256 } from "@noble/hashes/sha2";
import { utf8ToBytes, bytesToHex } from "@noble/hashes/utils";
import { readFileSync, statSync } from "node:fs";

export function hashUint8(data: Uint8Array): string {
  // noble/sha256 is universal (no Buffer, no crypto module)
  return bytesToHex(sha256(data));
}

export function hashJson(value: unknown): string {
  // ensure deterministic key order
  const ordered = JSON.stringify(value, Object.keys(value as any).sort());
  return hashUint8(utf8ToBytes(ordered));
}

export type FileDigest = {
	path: string
	mtimeMs: number
	sha256: string
}

export function digestFile(path: string): FileDigest {
	const buf = readFileSync(path);
	return {
	  path,
	  mtimeMs: statSync(path).mtimeMs,
	  sha256: bytesToHex(sha256(buf))
	};
  }

export type MergeTaskDependsOn<T extends Task, ND extends Record<string, Task>> = {
	[K in keyof T]: K extends "dependsOn" ? T[K] & ND : T[K]
} & Partial<Pick<Task, "computeCacheKey" | "input" | "decode" | "encode">>

export type MergeTaskDependencies<
	T extends Task,
	NP extends Record<string, Task>,
> = {
	[K in keyof T]: K extends "dependencies" ? T[K] & NP : T[K]
} & Partial<Pick<Task, "computeCacheKey" | "input" | "decode" | "encode">>

// export type MergeScopeDependsOn<S extends CanisterScope, D extends Record<string, Task>> = Omit<S, 'children'> & {
//     children: Omit<S['children'], 'install'> & {
//         install: Omit<S['children']['install'], 'dependsOn'> & {
//             dependsOn: D
//         }
//     }
// }

// export type MergeScopeDependsOn<S extends CanisterScope, D extends Record<string, Task>> = Omit<S, 'children'> & {
//     children: Omit<S['children'], 'install'> & {
// 		install: MergeTaskDependsOn<S['children']['install'], D>
//     }
// }
export type MergeScopeDependsOn<S extends CanisterScope, D extends Record<string, Task>> = Omit<S, 'children'> & {
    children: Omit<S['children'], 'install'> & {
		install: MergeTaskDependsOn<S['children']['install'], D>
    }
}

// export type MergeScopeDependencies<
// 	S extends CanisterScope,
// 	NP extends Record<string, Task>,
// > = Omit<S, "children"> & {
// 	children: MergeAllChildrenDependencies<S["children"], NP>
// }

export type MergeScopeDependencies<S extends CanisterScope, D extends Record<string, Task>> = Omit<S, 'children'> & {
    children: Omit<S['children'], 'install'> & {
		install: MergeTaskDependencies<S['children']['install'], D>
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
		create: Task<string>
		bindings: Task<void>
		build: Task<void>
		install: Task<{
			canisterId: string
			canisterName: string
			actor: ActorSubclass<_SERVICE>
		}, D, P>
		stop: Task<void>
		remove: Task<void>
		deploy: Task<void>
		status: Task<{
			canisterName: string
			canisterId: string | undefined
			status: CanisterStatus | { not_installed: null }
		}>
	}
}

export const Tags = {
	CANISTER: "$$ice/canister",
	CUSTOM: "$$ice/canister/custom",
	MOTOKO: "$$ice/canister/motoko",
	RUST: "$$ice/canister/rust",
	AZLE: "$$ice/canister/azle",
	KYBRA: "$$ice/canister/kybra",

	CREATE: "$$ice/create",
	STATUS: "$$ice/status",
	BUILD: "$$ice/build",
	INSTALL: "$$ice/install",
	BINDINGS: "$$ice/bindings",
	DEPLOY: "$$ice/deploy",
	STOP: "$$ice/stop",
	REMOVE: "$$ice/remove",
	UI: "$$ice/ui",
	// TODO: hmm do we need this?
	SCRIPT: "$$ice/script",
}

type CanisterStatus = "not_installed" | "stopped" | "running"

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
		install: infer C
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

export const makeCanisterStatusTask = (tags: string[]): Task<{
	canisterName: string
	canisterId: string | undefined
	status: CanisterStatus | { not_installed: null }
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
			const canisterInfo = canisterIdsMap[canisterName]
			if (!canisterInfo) {
				return {
					canisterName,
					canisterId: undefined,
					status: { not_installed: null },
				}
			}
			const canisterId = canisterInfo[currentNetwork]
			if (!canisterId) {
				// TODO: fix format
				return { canisterName, canisterId, status: { not_installed: null } }
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
			const { roles: { deployer: { identity } } } = yield* TaskCtx
			const status = yield* replica.getCanisterStatus({
				canisterId,
				identity,
			})
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
		status: CanisterStatus | { not_installed: null }
	}>
}

export const makeDeployTask = (tags: string[]): Task<string> => {
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
			const [canisterId] = yield* Effect.all(
				[
					Effect.gen(function* () {
						const canisterId = (yield* runTask(
							parentScope.children.create,
						)) as unknown as string
						return canisterId
					}),
					Effect.gen(function* () {
						if (parentScope.tags.includes(Tags.MOTOKO)) {
							// Moc generates candid and wasm files in the same phase
							yield* runTask(parentScope.children.build)
							yield* runTask(parentScope.children.bindings)
						} else {
							yield* Effect.all(
								[
									runTask(parentScope.children.build),
									runTask(parentScope.children.bindings),
								],
								{
									concurrency: "unbounded",
								},
							)
						}
					}),
				],
				{
					concurrency: "unbounded",
				},
			)
			yield* runTask(parentScope.children.install)
			yield* Effect.logDebug("Canister deployed successfully")
			return canisterId
		}),
		description: "Deploy canister code",
		tags: [Tags.CANISTER, Tags.DEPLOY, ...tags],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies Task<string>
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