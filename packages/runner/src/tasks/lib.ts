import type { SignIdentity } from "@dfinity/agent"
import { StandardSchemaV1 } from "@standard-schema/spec"
import { match, type } from "arktype"
import {
	Config,
	Context,
	Data,
	Deferred,
	Effect,
	Array as EffectArray,
	Layer,
	ManagedRuntime,
	Match,
	Metric,
	Option,
} from "effect"
import { makeRuntime } from "../index.js"
import { CLIFlags } from "../services/cliFlags.js"
import {
	DefaultConfig,
	InitializedDefaultConfig,
} from "../services/defaultConfig.js"
import { ICEConfigService } from "../services/iceConfig.js"
import { type ReplicaService } from "../services/replica.js"
import { TaskArgsService } from "../services/taskArgs.js"
import { TaskCtxService } from "../services/taskCtx.js"
import { TaskRegistry } from "../services/taskRegistry.js"
import type {
	CachedTask,
	ICEUser,
	NamedParam,
	PositionalParam,
	Scope,
	Task,
	TaskParam,
	TaskTree,
	TaskTreeNode,
} from "../types/types.js"
import { CanisterIdsService } from "../services/canisterIds.js"

export type ParamsToArgs<
	P extends Record<string, NamedParam | PositionalParam>,
> = {
	[K in keyof P as P[K] extends { isOptional: false } | { default: unknown }
		? K
		: never]: P[K] extends TaskParam
		? StandardSchemaV1.InferOutput<P[K]["type"]>
		: never
} & {
	[K in keyof P as P[K] extends { isOptional: false } | { default: unknown }
		? never
		: K]?: P[K] extends TaskParam
		? StandardSchemaV1.InferOutput<P[K]["type"]>
		: never
}

export type TaskParamsToArgs<T extends Task> = {
	[K in keyof T["params"] as T["params"][K] extends
		| { isOptional: false }
		| { default: unknown }
		? K
		: never]: T["params"][K] extends TaskParam
		? StandardSchemaV1.InferOutput<T["params"][K]["type"]>
		: never
} & {
	[K in keyof T["params"] as T["params"][K] extends
		| { isOptional: false }
		| { default: unknown }
		? never
		: K]?: T["params"][K] extends TaskParam
		? StandardSchemaV1.InferOutput<T["params"][K]["type"]>
		: never
}

export type TaskSuccess<T extends Task> = [T] extends [
	Task<infer _A, infer _D, infer _P>,
]
	? _A
	: never

export type CanisterIds = Record<string, Record<string, string>>
export interface TaskCtxShape<A extends Record<string, unknown> = {}> {
    readonly taskTree: TaskTree
	readonly users: {
		[name: string]: {
			identity: SignIdentity
			// agent: HttpAgent
			principal: string
			accountId: string
			// TODO: neurons?
		}
	}
    // TODO: async / await
    // convert later.
	// readonly canisterIds: {
	// 	// readonly canisterIds: CanisterIds
	// 	/**
	// 	 * Retrieves the current in-memory canister IDs.
	// 	 */
	// 	getCanisterIds: () => Effect.Effect<CanisterIds>
	// 	/**
	// 	 * Updates the canister ID for a specific canister and network.
	// 	 */
	// 	setCanisterId: (params: {
	// 		canisterName: string
	// 		network: string
	// 		canisterId: string
	// 	}) => Effect.Effect<void>
	// 	/**
	// 	 * Removes the canister ID for the given canister name.
	// 	 */
	// 	removeCanisterId: (canisterName: string) => Effect.Effect<void>
	// 	/**
	// 	 * Flushes the in-memory canister IDs to the canister_ids.json file.
	// 	 */
	// 	flush: () => Effect.Effect<void>
	// }

	readonly roles: {
		deployer: ICEUser
		minter: ICEUser
		controller: ICEUser
		treasury: ICEUser
		[name: string]: {
			identity: SignIdentity
			principal: string
			accountId: string
		}
	}
	readonly replica: ReplicaService

	readonly runTask: {
		<T extends Task>(
			task: T,
		): Promise<{
			result: TaskSuccess<T>
			taskId: symbol
			taskPath: string
		}>
		<T extends Task>(
			task: T,
			args: TaskParamsToArgs<T>,
		): Promise<{
			result: TaskSuccess<T>
			taskId: symbol
			taskPath: string
		}>
	}

	readonly currentNetwork: string
	readonly networks: {
		[key: string]: {
			replica: ReplicaService
			host: string
			port: number
			// subnet: Subnet?
		}
	}
	readonly args: A
	readonly taskPath: string
	readonly appDir: string
	readonly iceDir: string
	readonly depResults: Record<
		string,
		{
			cacheKey: string | undefined
			result: unknown
		}
	>
}
export class TaskCtx extends Context.Tag("TaskCtx")<TaskCtx, TaskCtxShape>() {}

export class TaskNotFoundError extends Data.TaggedError("TaskNotFoundError")<{
	message: string
}> {}

// TODO: do we need to get by id? will symbol work?
export const getTaskPathById = (id: Symbol) =>
	Effect.gen(function* () {
		const { taskTree } = yield* ICEConfigService
		const result = yield* filterNodes(
			taskTree,
			(node) => node._tag === "task" && node.id === id,
		)
		// TODO: use effect Option?
		if (result?.[0]) {
			return result[0].path.join(":")
		}
		// return undefined
		return yield* Effect.fail(
			new TaskNotFoundError({
				message: `Task not found by id`,
			}),
		)
	})

export const collectDependencies = (
	rootTasks: Task[],
	collected: Map<symbol, Task> = new Map(),
): Map<symbol, Task | (Task & { args: Record<string, unknown> })> => {
	for (const rootTask of rootTasks) {
		if (collected.has(rootTask.id)) continue
		collected.set(rootTask.id, rootTask)
		for (const key in rootTask.dependencies) {
			// TODO: fix? Task dependencies are {}, cant be indexed.
			// But Record<string, Task> as default is circular. not allowed
			const dependency = (rootTask.dependencies as Record<string, Task>)[
				key
			]
			if (!dependency) continue
			collectDependencies([dependency], collected)
		}
	}
	return collected
}

export class TaskArgsParseError extends Data.TaggedError("TaskArgsParseError")<{
	message: string
}> {}

// Helper function to validate a single parameter
const resolveArg = <T = unknown>(
	param: PositionalParam<T> | NamedParam<T>, // Adjust type as per your actual schema structure
	arg: string | undefined,
): Effect.Effect<T | undefined, TaskArgsParseError> => {
	// TODO: arg might be undefined
	if (!arg) {
		if (param.isOptional) {
			return Effect.succeed(param.default)
		}
		return Effect.fail(
			new TaskArgsParseError({
				message: `Missing argument for ${param.name}`,
			}),
		)
	}
	const value = param.parse(arg) ?? param.default
	const outputType = param.type["~standard"].types?.output
	const result = param.type["~standard"].validate(value)

	if (result instanceof Promise) {
		return Effect.fail(
			new TaskArgsParseError({
				message: `Async validation not implemented for ${param.name ?? "positional parameter"}`,
			}),
		)
	}
	if (result.issues) {
		return Effect.fail(
			new TaskArgsParseError({
				message: `Validation failed for ${param.name ?? "positional parameter"}: ${JSON.stringify(result.issues, null, 2)}`,
			}),
		)
	}
	return Effect.succeed(result.value)
}

export const resolveTaskArgs = (
	task: Task,
	taskArgs: { positionalArgs: string[]; namedArgs: Record<string, string> },
) =>
	Effect.gen(function* () {
		const { positionalArgs, namedArgs } = taskArgs

		const named: Record<
			string,
			{
				arg: unknown
				param: NamedParam
			}
		> = {}
		for (const [name, param] of Object.entries(task.namedParams)) {
			const namedArg = namedArgs[name]
			const arg = yield* resolveArg(param, namedArg)
			named[name] = {
				arg,
				param,
			}
		}
		const positional: Record<
			string,
			{
				arg: unknown
				param: PositionalParam
			}
		> = {}
		for (const index in task.positionalParams) {
			const param = task.positionalParams[index]
			const positionalArg = positionalArgs[index]
			if (!param) {
				return yield* Effect.fail(
					new TaskArgsParseError({
						message: `Missing positional argument: ${index}`,
					}),
				)
			}
			const arg = yield* resolveArg(param, positionalArg)
			positional[param.name] = {
				arg,
				param,
			}
		}

		return {
			positional,
			named,
		}
	})

// export const resolveArgsMap = (
// 	task: Task,
// 	args: Record<string, unknown>,
// ): {
// 	positional: Record<string, {
// 		arg: unknown
// 		param: PositionalParam
// 	}>
// 	named: Record<string, {
// 		arg: unknown
// 		param: NamedParam
// 	}>
// } => {
// 	const argsArray = Object.entries(args)
// 	const positional = argsArray.filter(([key]) => task.positionalParams.find((p) => p.name === key))
// 	// TODO: fix
// 	const named = argsArray.filter(([key]) => task.namedParams[key])
// 	return {
// 		positional,
// 		named,
// 	}
// }

/**
 * Topologically sorts tasks based on the "provide" field dependencies.
 * The tasks Map now uses symbols as keys.
 *
 * @param tasks A map of tasks keyed by their id (as symbol).
 * @returns An array of tasks sorted in execution order.
 * @throws Error if a cycle is detected.
 */
export const topologicalSortTasks = (tasks: Map<symbol, Task>): Task[] => {
	const indegree = new Map<symbol, number>()
	const adjList = new Map<symbol, symbol[]>()

	// Initialize graph nodes.
	for (const [id, task] of tasks.entries()) {
		indegree.set(id, 0)
		adjList.set(id, [])
	}

	// Build the graph using the "provide" field.
	for (const [id, task] of tasks.entries()) {
		for (const [key, providedTask] of Object.entries(
			task.dependencies as Record<string, Task>,
		)) {
			const depId = providedTask.id
			// Only consider provided dependencies that are in our tasks map.
			if (tasks.has(depId)) {
				// Add an edge from the dependency to this task.
				adjList.get(depId)?.push(id)
				// Increase the indegree for current task.
				indegree.set(id, (indegree.get(id) ?? 0) + 1)
			}
		}
	}

	// Collect tasks with zero indegree.
	const queue: symbol[] = []
	for (const [id, degree] of indegree.entries()) {
		if (degree === 0) {
			queue.push(id)
		}
	}

	const sortedTasks: Task[] = []
	while (queue.length > 0) {
		const currentId = queue.shift()
		if (!currentId) {
			throw new Error("No task to shift from queue")
		}
		const currentTask = tasks.get(currentId)
		if (!currentTask) {
			throw new Error("No task found in tasks map")
		}
		sortedTasks.push(currentTask)
		const neighbors = adjList.get(currentId) || []
		for (const neighbor of neighbors) {
			indegree.set(neighbor, (indegree.get(neighbor) ?? 0) - 1)
			if (indegree.get(neighbor) === 0) {
				queue.push(neighbor)
			}
		}
	}

	if (sortedTasks.length !== tasks.size) {
		throw new Error(
			`Cycle detected in task dependencies via 'provide' field. ${JSON.stringify(
				sortedTasks,
			)}`,
		)
	}

	return sortedTasks
}

export type ProgressStatus = "starting" | "completed"
export type ProgressUpdate<A> = {
	taskId: symbol
	taskPath: string
	status: ProgressStatus
	result?: A
	error?: unknown
}

export class TaskRuntimeError extends Data.TaggedError("TaskRuntimeError")<{
	message?: string
	error?: unknown
}> {}

export const isCachedTask = match
	.in<Task | CachedTask>()
	.case(
		{
			computeCacheKey: "Function",
			input: "Function",
			encode: "Function",
			decode: "Function",
			encodingFormat: "'string' | 'uint8array'",
		},
		(t) => Option.some(t as CachedTask),
	)
	.default((t) => Option.none())

export const logDetailedError = (
	error: unknown,
	taskCtx: TaskCtxShape,
	operation: string,
) =>
	Effect.gen(function* () {
		const stack = new Error().stack

		// Get task context safely
		const getTaskContext = Effect.gen(function* () {
			return {
				canisterName: taskCtx.taskPath
					.split(":")
					.slice(0, -1)
					.join(":"),
				appDir: taskCtx.appDir,
				iceDir: taskCtx.iceDir,
				currentNetwork: taskCtx.currentNetwork,
				dependencies: Object.keys(taskCtx.depResults),
			}
		}).pipe(
			Effect.orElse(() =>
				Effect.succeed({ error: "TaskCtx unavailable" }),
			),
		)

		const taskContext = yield* getTaskContext

		// Enhanced Effect error inspection
		const isEffectError = error && typeof error === "object"
		const effectErrorDetails = isEffectError
			? {
					tag: "_tag" in error ? error._tag : undefined,
					message: "message" in error ? error.message : undefined,
					span: "span" in error ? error.span : undefined,
					// For SystemError specifically
					syscall: "syscall" in error ? error.syscall : undefined,
					pathOrDescriptor:
						"pathOrDescriptor" in error
							? error.pathOrDescriptor
							: undefined,
					reason: "reason" in error ? error.reason : undefined,
					module: "module" in error ? error.module : undefined,
					method: "method" in error ? error.method : undefined,
				}
			: {}

		yield* Effect.logError(`Error in ${operation || "operation"}`, {
			taskPath: taskCtx.taskPath,
			operation: operation,
			taskContext,
			effectErrorDetails,
			rawError:
				error instanceof Error
					? {
							name: error.name,
							message: error.message,
							stack: error.stack?.split("\n").slice(0, 5),
						}
					: { value: String(error) },
			callTrace: stack?.split("\n").slice(1, 4),
		})

		return yield* Effect.fail(
			new TaskRuntimeError({ message: "Task runtime error", error }),
		)
	})

export const totalTaskCount = Metric.counter("total_task_count", {
	description: "Number of tasks executed",
	// labelNames: ["task_name"],
}).pipe(Metric.withConstantInput(1))
export const cachedTaskCount = Metric.counter("cached_task_count", {
	description: "Number of cached tasks executed",
	// labelNames: ["task_name"],
}).pipe(Metric.withConstantInput(1))
export const cacheHitCount = Metric.counter("cache_hit_count", {
	description: "Number of cache hits",
	// labelNames: ["task_name"],
}).pipe(Metric.withConstantInput(1))
export const uncachedTaskCount = Metric.counter("uncached_task_count", {
	description: "Number of uncached tasks executed",
	// labelNames: ["task_name"],
}).pipe(Metric.withConstantInput(1))

// TODO: 1 task per time. its used like that anyway
// rename to executeTask
export const executeTasks = Effect.fn("executeTasks")(function* (
	tasks: (Task | (Task & { args: Record<string, unknown> }))[],
	progressCb: (update: ProgressUpdate<unknown>) => void = () => {},
) {
	const defaultConfig = yield* DefaultConfig
	const appDir = yield* Config.string("APP_DIR")
	const iceDir = yield* Config.string("ICE_DIR_NAME")
	const taskRegistry = yield* TaskRegistry
	const { config } = yield* ICEConfigService
	const { globalArgs, taskArgs: cliTaskArgs } = yield* CLIFlags
	const { taskArgs } = yield* TaskArgsService
	const currentNetwork = globalArgs.network ?? "local"
	const currentNetworkConfig =
		config?.networks?.[currentNetwork] ??
		defaultConfig.networks[currentNetwork]
	const currentReplica = currentNetworkConfig?.replica
	if (!currentReplica) {
		return yield* Effect.fail(
			new TaskRuntimeError({
				message: `No replica found for network: ${currentNetwork}`,
			}),
		)
	}
	const currentUsers = config?.users ?? {}
	const networks = config?.networks ?? defaultConfig.networks
	// TODO: merge with defaultConfig.roles

	const initializedRoles: Record<string, ICEUser> = {}
	for (const [name, user] of Object.entries(config?.roles ?? {})) {
		if (!currentUsers[user]) {
			return yield* Effect.fail(
				new TaskRuntimeError({
					message: `User ${user} not found in current users`,
				}),
			)
		}
		initializedRoles[name] = currentUsers[user]
	}

	const resolvedRoles: {
		[key: string]: ICEUser
	} & InitializedDefaultConfig["roles"] = {
		...defaultConfig.roles,
		...initializedRoles,
	}

	// Create a deferred for every task to hold its eventual result.
	const deferredMap = new Map<
		symbol,
		Deferred.Deferred<{
			cacheKey: string | undefined
			result: unknown
		}>
		// unknown
	>()
	for (const task of tasks) {
		const deferred = yield* Deferred.make<{
			cacheKey: string | undefined
			result: unknown
		}>()
		// unknown
		deferredMap.set(task.id, deferred)
	}
	const taskEffects = EffectArray.map(tasks, (task) =>
		Effect.fn("task_execute")(function* () {
			const dependencyResults: Record<
				string,
				{
					cacheKey: string | undefined
					result: unknown
				}
			> = {}
			for (const [dependencyName, providedTask] of Object.entries(
				task.dependencies as Record<string, Task>,
			)) {
				const depDeferred = deferredMap.get(providedTask.id)
				if (depDeferred) {
					const depResult = yield* Deferred.await(depDeferred)
					dependencyResults[dependencyName] = depResult
				}
			}
			const taskPath = yield* getTaskPathById(task.id)
			yield* Effect.annotateCurrentSpan({
				taskPath,
			})
			progressCb({ taskId: task.id, taskPath, status: "starting" })

			// TODO: also handle dynamic calls from other tasks
			// this is purely for the cli
			let argsMap: Record<string, unknown>
			if ("args" in task && Object.keys(task.args).length > 0) {
				yield* Effect.logDebug("task.args found:", task.args, taskPath)
				argsMap = task.args
			} else {
				yield* Effect.logDebug(
					"task.args not found, resolving task args",
					taskPath,
				)
				// TODO: causes issues if task is called programmatically
				const resolvedTaskArgs = yield* resolveTaskArgs(
					task,
					cliTaskArgs,
				)
				// TODO: clean up
				const hasTaskArgs = Object.keys(taskArgs).length > 0
				argsMap = hasTaskArgs
					? taskArgs
					: Object.fromEntries([
							...Object.entries(resolvedTaskArgs.named).map(
								([name, arg]) => [arg.param.name, arg.arg],
							),
							...Object.entries(resolvedTaskArgs.positional).map(
								([index, arg]) => [index, arg.arg],
							),
						])
			}
			yield* Effect.annotateCurrentSpan({
				argsMap,
			})
			const currentContext =
				yield* Effect.context<
					ManagedRuntime.ManagedRuntime.Context<
						ReturnType<typeof makeRuntime>
					>
				>()
			// We have to reuse the service or task references will be different
			// as the task tree gets recreated each time
			const iceConfigService = Context.get(
				currentContext,
				ICEConfigService,
			)
			const iceConfigServiceLayer = Layer.succeed(
				ICEConfigService,
				iceConfigService,
			)
			const taskCtxService = yield* TaskCtxService
			const taskCtx = yield* taskCtxService.make(
				taskPath,
				task,
				argsMap,
				dependencyResults,
				progressCb,
			)
			// const taskLayer = Layer.succeed(TaskCtx, taskCtx)
			// TODO: simplify?
			let result: Option.Option<unknown> = Option.none()
			let cacheKey: Option.Option<string> = Option.none()

			const maybeCachedTask = isCachedTask(task)

			yield* Effect.annotateCurrentSpan({
				isCached: Option.isSome(maybeCachedTask),
			})
			if (Option.isSome(maybeCachedTask)) {
				yield* cachedTaskCount(Effect.succeed(1))
				const cachedTask = maybeCachedTask.value
				const input = yield* Effect.tryPromise({
					try: () => cachedTask.input(taskCtx),
					catch: (error) => {
						return new TaskRuntimeError({
							message: "Error getting cached task input",
							error,
						})
					},
				})

				// TODO: do this in userland
				// .pipe(
				// 	Effect.provide(taskLayer),
				// 	// Effect.option,
				// 	Effect.catchAll((error) =>
				// 		logDetailedError(error, taskCtx, "cached task input()"),
				// 	),
				// )
				// const input = yield* cachedTask.input().pipe(
				// 	Effect.provide(taskLayer),
				// 	// Effect.option,
				// 	Effect.catchAll((error) =>
				// 		logDetailedError(error, taskCtx, "cached task input()"),
				// 	),
				// )
				cacheKey = Option.some(cachedTask.computeCacheKey(input))

				const isCacheValid =
					"revalidate" in cachedTask
						? yield* Effect.tryPromise({
								try: () => cachedTask.revalidate!(taskCtx, { input }),
								catch: (error) => {
									return new TaskRuntimeError({
										message:
											"Error revalidating cached task",
										error,
									})
								},
							})
						: true

				const cacheHit =
					isCacheValid &&
					Option.isSome(cacheKey) &&
					(yield* taskRegistry.has(cacheKey.value))

				yield* Effect.annotateCurrentSpan({
					cacheHit: cacheHit,
				})
				if (
					// stupid typescript cant infer if we dont inline
					isCacheValid &&
					Option.isSome(cacheKey) &&
					(yield* taskRegistry.has(cacheKey.value))
				) {
					yield* cacheHitCount(Effect.succeed(1))
					yield* Effect.logDebug(
						`Cache hit for cacheKey: ${cacheKey}`,
					)
					const encodingFormat = cachedTask.encodingFormat
					const maybeResult = yield* taskRegistry.get(
						cacheKey.value,
						encodingFormat,
					)
					yield* Effect.annotateCurrentSpan({
						decoding: Option.isSome(maybeResult),
					})
					if (Option.isSome(maybeResult)) {
						const encodedResult = maybeResult.value
						yield* Effect.logDebug(
							"decoding result:",
							encodedResult,
						)
						const decodedResult = yield* Effect.tryPromise({
							try: () => cachedTask.decode(taskCtx, encodedResult, input),
							// TODO: do this in userland
							// .pipe(
							// 	Effect.provide(taskLayer),
							// 	Effect.catchAll((error) =>
							// 		logDetailedError(
							// 			error,
							// 			taskCtx,
							// 			"cached task decode()",
							// 		),
							// 	),
							// )
							catch: (error) => {
								return new TaskRuntimeError({
									message: "Error decoding cached task",
									error,
								})
							},
						})
						result = Option.some(decodedResult)
						yield* Effect.logDebug("decoded result:", decodedResult)
					} else {
						// TODO: reading cache failed, why would this happen?
						// get rid of this and just throw?
						return yield* Effect.fail(
							new TaskRuntimeError({
								message: "Cache hit, but failed to read cache",
							}),
						)
						// TODO: this is a problem.
						// we shouldnt be able to get here.
						// we should throw an error.
						// or we shouldnt be able to get here.
						// or we should be able to get here.
						// or we should be able to get here.
						// result = Option.some(
						// 	yield* cachedTask.effect.pipe(
						// 		Effect.provide(taskLayer),
						// 		Effect.catchAll((error) =>
						// 			logDetailedError(
						// 				error,
						// 				taskCtx,
						// 				"cached task effect()",
						// 			),
						// 		),
						// 	),
						// )
					}
				} else {
					result = yield* Effect.tryPromise({
						try: () => cachedTask.effect(taskCtx),
						catch: (error) => {
							return new TaskRuntimeError({
								message: "Error executing cached task",
								error,
							})
						},
					}).pipe(Effect.option)
					// TODO: do this in userland
					//     .pipe(
					// 	Effect.provide(taskLayer),
					// 	Effect.map((result) => Option.some(result)),
					// 	Effect.catchAll((error) =>
					// 		logDetailedError(
					// 			error,
					// 			taskCtx,
					// 			"cached task effect(), skipping cache",
					// 		),
					// 	),
					// )
					if (Option.isNone(result)) {
						yield* Effect.logDebug("No result for task", taskPath)
						return yield* Effect.fail(
							new TaskRuntimeError({
								message: `No result for task ${taskPath}`,
							}),
						)
					}
					// TODO: fix. maybe not json stringify?
					yield* Effect.annotateCurrentSpan({
						encoding: Option.isSome(result),
					})
					if (Option.isSome(cacheKey) && Option.isSome(result)) {
						yield* Effect.logDebug("encoding result:", result.value)
						// stupid typescript cant infer otherwise........
						const value = result.value
						const encodedResult = yield* Effect.tryPromise({
							try: () => cachedTask.encode(taskCtx, value, input),
							catch: (error) => {
								return new TaskRuntimeError({
									message: "Error encoding cached task",
									error,
								})
							},
						})
						// TODO: do this in userland
						// .pipe(
						// 	Effect.provide(taskLayer),
						// 	Effect.catchAll((error) =>
						// 		logDetailedError(
						// 			error,
						// 			taskCtx,
						// 			"cached task encode()",
						// 		),
						// 	),
						// )

						yield* Effect.logDebug(
							"encoded result",
							"with type:",
							typeof encodedResult,
							"with value:",
							encodedResult,
						)
						yield* taskRegistry.set(cacheKey.value, encodedResult)
					} else {
						// ????
						yield* Effect.logDebug(
							"Encoded, but no cache key for task",
							taskPath,
							"so not caching result",
						)
					}
				}
			} else {
				yield* uncachedTaskCount(Effect.succeed(1))
				result = yield* Effect.tryPromise({
					try: () => task.effect(taskCtx),
					catch: (error) => {
						return new TaskRuntimeError({
							message: "Error executing task",
							error,
						})
					},
				}).pipe(Effect.option)
				// TODO: do this in userland
				// .pipe(
				// 	Effect.provide(taskLayer),
				// 	Effect.catchAll((error) =>
				// 		logDetailedError(error, taskCtx, "task effect()"),
				// 	),
				// ),
			}

			if (Option.isNone(result)) {
				yield* Effect.logDebug("No result for task", taskPath)
				return yield* Effect.fail(
					new TaskRuntimeError({
						message: `No result for task ${taskPath}`,
					}),
				)
			}
			if (Option.isNone(cacheKey)) {
				yield* Effect.logDebug(
					"No cache key for task, skipped caching",
					taskPath,
				)
				// TODO: how do we handle this?
				// return yield* Effect.fail(
				// 	new Error(`No cache key for task ${taskPath}`),
				// )
			}

			// TODO: updates from the task effect? pass in cb?
			const currentDeferred = deferredMap.get(task.id)
			if (currentDeferred) {
				yield* Deferred.succeed(currentDeferred, {
					cacheKey: Option.isSome(cacheKey)
						? cacheKey.value
						: undefined,
					result: result.value,
				})
			}

			// TODO: yield instead?
			progressCb({
				taskId: task.id,
				taskPath,
				status: "completed",
				result: result.value,
				// TODO: pass in cacheKey? probably not needed
			})

			yield* Effect.annotateCurrentSpan({
				result: result.value,
			})
			yield* totalTaskCount(Effect.succeed(1))
			return {
				taskId: task.id,
				taskPath,
				result: result.value,
				// TODO: pass in cacheKey? probably not needed
			}
		})(),
	)
	return taskEffects
})

export const filterNodes = (
	taskTree: TaskTree,
	predicate: (task: TaskTreeNode) => boolean,
	path: string[] = [],
): Effect.Effect<Array<{ node: TaskTreeNode; path: string[] }>> =>
	Effect.gen(function* () {
		const matchingNodes: Array<{ node: TaskTreeNode; path: string[] }> = []
		for (const key of Object.keys(taskTree)) {
			const currentNode = taskTree[key]
			const node = Match.value(currentNode).pipe(
				Match.tag("task", (task): Task => task),
				Match.tag("scope", (scope): Scope => scope),
				Match.option,
			)
			if (Option.isSome(node)) {
				const fullPath = [...path, key]
				if (predicate(node.value)) {
					matchingNodes.push({ node: node.value, path: fullPath })
				}
				if (node.value._tag === "scope") {
					const children = Object.keys(node.value.children)
					const filteredChildren = yield* filterNodes(
						node.value.children,
						predicate,
						fullPath,
					)
					matchingNodes.push(...filteredChildren)
				}
			}
		}
		return matchingNodes
	})

// TODO: more accurate type
type TaskFullName = string
// TODO: figure out if multiple tasks are needed

export const getNodeByPath = (taskPathString: TaskFullName) =>
	Effect.gen(function* () {
		const taskPath: string[] = taskPathString.split(":")
		const { taskTree } = yield* TaskCtx
		const node = yield* findNodeInTree(taskTree, taskPath)
		return node
	})

export const findNodeInTree = (tree: TaskTree, path: string[]) =>
	Effect.gen(function* () {
		// If the path is empty, return the entire tree.
		if (path.length === 0) {
			return tree
		}
		let current: TaskTree | TaskTreeNode = tree
		for (const segment of path) {
			if (!("_tag" in current)) {
				if (!current[segment]) {
					return yield* Effect.fail(
						new TaskNotFoundError({
							message: `Segment "${segment}" not found in tree at path: ${path.join(":")}`,
						}),
					)
				}
				current = current[segment]
			} else if (current._tag === "scope") {
				if (!current.children[segment]) {
					return yield* Effect.fail(
						new TaskNotFoundError({
							message: `Segment "${segment}" not found in scope children at path: ${path.join(":")}`,
						}),
					)
				}
				current = current.children[segment] as TaskTreeNode
			} else {
				return yield* Effect.fail(
					new TaskNotFoundError({
						message: `Cannot traverse into node with tag "${current._tag}" at segment "${segment}" at path: ${path.join(":")}`,
					}),
				)
			}
		}
		return current
	})

// TODO: support defaultTask for scope
export const findTaskInTaskTree = (
	obj: TaskTree,
	keys: Array<string>,
): Effect.Effect<Task, TaskNotFoundError> => {
	return Effect.gen(function* () {
		let node: TaskTreeNode | TaskTree = obj
		for (const key of keys) {
			const isLastKey = keys.indexOf(key) === keys.length - 1
			if (!("_tag" in node)) {
				if (isLastKey) {
					// TODO: this is all then
					const taskTree = node
					if (!taskTree[key]) {
						return yield* Effect.fail(
							new TaskNotFoundError({
								message: `Segment "${key}" not found in tree at path: ${keys.join(":")}`,
							}),
						)
					}
					node = taskTree[key]

					if (node._tag === "task") {
						return node as Task
					} else if (node._tag === "scope") {
						if ("defaultTask" in node) {
							const taskName = node.defaultTask
							return node.children[taskName] as Task
						}
					}

					return yield* Effect.fail(
						new TaskNotFoundError({
							message: `Invalid node type encountered at key "${key}" at path: ${keys.join(":")}`,
						}),
					)
				} else {
					if (!node[key]) {
						return yield* Effect.fail(
							new TaskNotFoundError({
								message: `Segment "${key}" not found in tree at path: ${keys.join(":")}`,
							}),
						)
					}
					node = node[key]
				}
			} else if (node._tag === "task") {
				if (isLastKey) {
					return node
				}
				return yield* Effect.fail(
					new TaskNotFoundError({
						message: `Invalid node type encountered at key "${key}" at path: ${keys.join(":")}`,
					}),
				)
			} else if (node._tag === "scope") {
				if (isLastKey) {
					if (!node.children[key]) {
						return yield* Effect.fail(
							new TaskNotFoundError({
								message: `Segment "${key}" not found in scope children at path: ${keys.join(":")}`,
							}),
						)
					}
					node = node.children[key]

					if (node._tag === "task") {
						return node
					}
					if ("defaultTask" in node) {
						const taskName = node.defaultTask
						return node.children[taskName] as Task
					}
					return yield* Effect.fail(
						new TaskNotFoundError({
							message: `No default task found for scope at path: ${keys.join(":")}`,
						}),
					)
				}
				node = node.children[key] as TaskTreeNode
			}
		}

		return yield* Effect.fail(
			new TaskNotFoundError({
				message: `Path traversal completed without finding a task at path: ${keys.join(":")}`,
			}),
		)
	})
}
