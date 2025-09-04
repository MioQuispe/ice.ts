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
	pipe,
} from "effect"
import {
	DefaultConfig,
	InitializedDefaultConfig,
} from "../services/defaultConfig.js"
import { ICEConfigService } from "../services/iceConfig.js"
import { type ReplicaService } from "../services/replica.js"
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
import { makeTaskCtx, type TaskCtxShape } from "../services/taskCtx.js"
import { InFlight } from "../services/inFlight.js"

export type ParamsToArgs<
	Params extends Record<string, NamedParam | PositionalParam>,
> = {
	[K in keyof Params as Params[K] extends
		| { isOptional: false }
		| { default: unknown }
		? K
		: never]: Params[K] extends TaskParam
		? StandardSchemaV1.InferOutput<Params[K]["type"]>
		: never
} & {
	[K in keyof Params as Params[K] extends
		| { isOptional: false }
		| { default: unknown }
		? never
		: K]?: Params[K] extends TaskParam
		? StandardSchemaV1.InferOutput<Params[K]["type"]>
		: never
}

// value type for a TaskParam
type ParamOutput<P> = P extends TaskParam
	? StandardSchemaV1.InferOutput<P["type"]>
	: never

// required vs optional (your rules)
type RequiredKeys<P> = {
	[K in keyof P]: P[K] extends { isOptional: false } | { default: unknown }
		? K
		: never
}[keyof P]

type OptionalKeys<P> = Exclude<keyof P, RequiredKeys<P>>

// build args; empty params => forbid any keys via Record<string, never>
type BuildArgs<P extends object> = [keyof P] extends [never]
	? Record<string, never>
	: { [K in RequiredKeys<P>]: ParamOutput<P[K]> } & {
			[K in OptionalKeys<P>]?: ParamOutput<P[K]>
		}

// Final: exact args for a Task's params
export type TaskParamsToArgs<T extends Task> = BuildArgs<
	NonNullable<T["params"]>
> // NonNullable in case params can be undefined

// export type TaskParamsToArgs<T extends Task> = {
// 	[K in keyof T["params"] as T["params"][K] extends
// 		| { isOptional: false }
// 		| { default: unknown }
// 		? K
// 		: never]: T["params"][K] extends TaskParam
// 		? StandardSchemaV1.InferOutput<T["params"][K]["type"]>
// 		: never
// } & {
// 	[K in keyof T["params"] as T["params"][K] extends
// 		| { isOptional: false }
// 		| { default: unknown }
// 		? never
// 		: K]?: T["params"][K] extends TaskParam
// 		? StandardSchemaV1.InferOutput<T["params"][K]["type"]>
// 		: never
// }

export type TaskSuccess<T extends Task> = [T] extends [
	Task<infer _A, infer _D, infer _P>,
]
	? _A
	: never

export type CanisterIds = Record<string, Record<string, string>>

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
	rootTasks: (Task & { args: Record<string, unknown> })[],
	collected: Map<
		symbol,
		Task & { args: Record<string, unknown> }
	> = new Map(),
): Map<symbol, Task & { args: Record<string, unknown> }> => {
	for (const rootTask of rootTasks) {
		if (collected.has(rootTask.id)) continue
		collected.set(rootTask.id, rootTask)
		for (const key in rootTask.dependencies) {
			// TODO: fix? Task dependencies are {}, cant be indexed.
			// But Record<string, Task> as default is circular. not allowed
			const dependency = (
				rootTask.dependencies as Record<
					string,
					Task & { args: Record<string, unknown> }
				>
			)[key]
			if (!dependency) continue
			collectDependencies([dependency], collected)
		}
	}
	return collected
}

export class TaskArgsParseError extends Data.TaggedError("TaskArgsParseError")<{
	message: string
	arg?: unknown
	param?: PositionalParam<unknown> | NamedParam<unknown>
}> {}

// Helper function to validate a single parameter
export const resolveArg = <T = unknown>(
	param: PositionalParam<T> | NamedParam<T>, // Adjust type as per your actual schema structure
	arg: unknown | undefined,
): Effect.Effect<T | undefined, TaskArgsParseError> => {
	// TODO: arg might be undefined
	if (!arg) {
		if (param.isOptional) {
			return Effect.succeed(param.default)
		}
		return Effect.fail(
			new TaskArgsParseError({
				message: `Missing argument for ${param.name}, arg: ${arg}, param: ${JSON.stringify(param)}`,
			}),
		)
	}
	const value = arg ?? param.default
	const outputType = param.type["~standard"].types?.output
	const result = param.type["~standard"].validate(value)

	if (result instanceof Promise) {
		return Effect.fail(
			new TaskArgsParseError({
				message: `Async validation not implemented for ${param.name ?? "positional parameter"}, arg: ${arg}, param: ${param}`,
			}),
		)
	}
	if (result.issues) {
		return Effect.fail(
			new TaskArgsParseError({
				message: `Validation failed for ${param.name ?? "positional parameter"}: ${JSON.stringify(result.issues, null, 2)}, arg: ${arg}, param: ${param}`,
			}),
		)
	}
	return Effect.succeed(result.value)
}

// const resolveCliArg = <T = unknown>(
// 	param: NamedParam<T> | PositionalParam<T>,
// 	arg: string | undefined,
// ): Effect.Effect<T | undefined, TaskArgsParseError> => {
// 	if (arg === undefined && param.isOptional) {
// 		return Effect.succeed(param.default)
// 	}
// 	if (arg === undefined) {
// 		return Effect.fail(
// 			new TaskArgsParseError({
// 				message: `Missing argument for ${param.name}, arg: ${arg}, param: ${JSON.stringify(param)}`,
// 			}),
// 		)
// 	}
// 	const parsedArg = param.parse(arg)
// 	// return Effect.succeed(arg)
// 	return resolveArg<T>(param, parsedArg)
// }

export const resolveArgsMap = (
	task: Task & { args?: Record<string, unknown> },
) =>
	Effect.gen(function* () {
		let argsMap: Record<string, unknown> = {}
		// breaks if dynamic call with empty args

		// const hasCliTaskArgs =
		// 	Boolean(Object.keys(cliTaskArgs.namedArgs).length) ||
		// 	Boolean(cliTaskArgs.positionalArgs.length)

		// if (isRootTask && hasCliTaskArgs) {
		//     // TODO: check params. not args.

		// 	// convert cliTaskArgs to argsMap
		// 	for (const [argName, arg] of Object.entries(
		// 		cliTaskArgs.namedArgs,
		// 	)) {
		// 		const param = task.namedParams[argName]
		// 		if (!param) {
		// 			return yield* Effect.fail(
		// 				new TaskArgsParseError({
		// 					message: `Missing parameter: ${argName}`,
		// 				}),
		// 			)
		// 		}
		// 		const resolvedArg = yield* resolveArg(param, arg)
		// 		argsMap[argName] = resolvedArg
		// 	}
		// 	for (const [index, arg] of cliTaskArgs.positionalArgs.entries()) {
		// 		const param = task.positionalParams[index]
		// 		if (!param) {
		// 			return yield* Effect.fail(
		// 				new TaskArgsParseError({
		// 					message: `Missing positional parameter: ${index}`,
		// 				}),
		// 			)
		// 		}
		// 		const resolvedArg = yield* resolveArg(param, arg)
		// 		argsMap[param.name] = resolvedArg
		// 	}
		// } else {
		// 	// TODO: we need to check all params. not args. because they may be empty
		// 	// and we still want the default values
		// 	// dynamic calls from other tasks
		// 	const argsArray = Object.entries(task.args)
		// 	for (const [argName, arg] of argsArray) {
		// 		const param = task.params[argName]
		// 		if (!param) {
		// 			return yield* Effect.fail(
		// 				new TaskArgsParseError({
		// 					message: `Missing parameter: ${argName}`,
		// 				}),
		// 			)
		// 		}
		// 		const resolvedArg = yield* resolveArg(param, arg)
		// 		argsMap[argName] = resolvedArg
		// 	}
		// }

		// if (isRootTask && hasCliTaskArgs) {
		// 	// TODO: check params. not args.

		// 	// convert cliTaskArgs to argsMap
		// 	for (const [paramName, param] of Object.entries(task.namedParams)) {
		// 		const arg = cliTaskArgs.namedArgs[paramName]

		// 		if (!arg && !param.isOptional) {
		// 			return yield* Effect.fail(
		// 				new TaskArgsParseError({
		// 					message: `Missing parameter: ${paramName}`,
		// 				}),
		// 			)
		// 		}
		// 		const resolvedArg = yield* resolveCliArg(param, arg)
		// 		argsMap[paramName] = resolvedArg
		// 	}
		// 	for (const [index, param] of task.positionalParams.entries()) {
		// 		const arg = cliTaskArgs.positionalArgs[index]
		// 		if (!arg && !param.isOptional) {
		// 			return yield* Effect.fail(
		// 				new TaskArgsParseError({
		// 					message: `Missing positional parameter: ${index}`,
		// 				}),
		// 			)
		// 		}
		// 		const resolvedArg = yield* resolveCliArg(param, arg)
		// 		argsMap[param.name] = resolvedArg
		// 	}
		// } else {
		// 	// TODO: we need to check all params. not args. because they may be empty
		// 	// and we still want the default values
		// 	// dynamic calls from other tasks
		// 	const paramsArray = Object.entries(task.params)
		// 	for (const [paramName, param] of paramsArray) {
		// 		const arg = task.args?.[paramName]
		// 		if (!arg && !param.isOptional) {
		// 			return yield* Effect.fail(
		// 				new TaskArgsParseError({
		// 					message: `Missing parameter: ${paramName}`,
		// 				}),
		// 			)
		// 		}
		// 		const resolvedArg = yield* resolveArg(param, arg)
		// 		argsMap[paramName] = resolvedArg
		// 	}
		// }
		// TODO: we need to check all params. not args. because they may be empty
		// and we still want the default values
		// dynamic calls from other tasks
		const paramsArray = Object.entries(task.params)
		for (const [paramName, param] of paramsArray) {
			const arg = task.args?.[paramName]
			if (!arg && !param.isOptional) {
				return yield* Effect.fail(
					new TaskArgsParseError({
						message: `Missing parameter: ${paramName}`,
					}),
				)
			}
			const resolvedArg = yield* resolveArg(param, arg)
			argsMap[paramName] = resolvedArg
		}

		return argsMap
	})

/**
 * Topologically sorts tasks based on the "provide" field dependencies.
 * The tasks Map now uses symbols as keys.
 *
 * @param tasks A map of tasks keyed by their id (as symbol).
 * @returns An array of tasks sorted in execution order.
 * @throws Error if a cycle is detected.
 */
export const topologicalSortTasks = (
	tasks: Map<symbol, Task & { args: Record<string, unknown> }>,
): (Task & { args: Record<string, unknown> })[] => {
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
			task.dependencies as Record<
				string,
				Task & { args: Record<string, unknown> }
			>,
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

	const sortedTasks: (Task & { args: Record<string, unknown> })[] = []
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
export const makeTaskEffects = Effect.fn("make_task_effects")(function* (
	tasks: (Task & { args: Record<string, unknown> })[],
	progressCb: (update: ProgressUpdate<unknown>) => void = () => {},
) {
	const taskRegistry = yield* TaskRegistry
	const inflightTasks = yield* InFlight

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
		Effect.fn("task_execute_effect")(function* () {
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

			// TODO: no cliTaskArgs for child tasks
			const argsMap = yield* resolveArgsMap(task)

			yield* Effect.annotateCurrentSpan({
				argsMap,
			})
			const taskCtx = yield* makeTaskCtx(
				taskPath,
				task,
				argsMap,
				dependencyResults,
				progressCb,
			)

			const maybeCachedTask = isCachedTask(task)

			yield* Effect.annotateCurrentSpan({
				isCached: Option.isSome(maybeCachedTask),
			})
			return yield* Option.match(maybeCachedTask, {
				onSome: (cachedTask) =>
					Effect.gen(function* () {
						const input = yield* Effect.tryPromise({
							try: () => cachedTask.input(taskCtx),
							catch: (error) => {
								return new TaskRuntimeError({
									message: "Error getting cached task input",
									error,
								})
							},
						})

						let cacheKey: string = cachedTask.computeCacheKey(input)

						const maybeInflight = yield* inflightTasks.get(cacheKey)

						if (Option.isSome(maybeInflight)) {
							const inflight = maybeInflight.value
							const result = yield* Deferred.await(inflight).pipe(
								Effect.catchAll((error) => {
									return new TaskRuntimeError({
										message: "Error awaiting inflight task",
										error,
									})
								}),
							)
							return {
								cacheKey,
								result,
								taskId: task.id,
								taskPath,
							}
						}

                        // we want to do it after deduping
						yield* cachedTaskCount(Effect.succeed(1))

						const inFlightDef = yield* Deferred.make<
							unknown,
							unknown
						>()
						yield* inflightTasks.set(cacheKey, inFlightDef)

						const revalidate =
							"revalidate" in cachedTask
								? yield* Effect.tryPromise({
										try: () =>
											cachedTask.revalidate!(taskCtx, {
												input,
											}),
										catch: (error) => {
											return new TaskRuntimeError({
												message:
													"Error revalidating cached task",
												error,
											})
										},
									})
								: false

						const cacheHit =
							!revalidate && (yield* taskRegistry.has(cacheKey))

						yield* Effect.annotateCurrentSpan({
							cacheHit: cacheHit,
						})

						if (cacheHit) {
							yield* cacheHitCount(Effect.succeed(1))
							yield* Effect.logDebug(
								`Cache hit for cacheKey: ${cacheKey}`,
							)
							const encodingFormat = cachedTask.encodingFormat
							const maybeResult = yield* taskRegistry.get(
								cacheKey,
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
									try: () =>
										cachedTask.decode(
											taskCtx,
											encodedResult,
											input,
										),
									catch: (error) => {
										return new TaskRuntimeError({
											message:
												"Error decoding cached task",
											error,
										})
									},
								})
								const result = decodedResult
								yield* Effect.logDebug(
									"decoded result:",
									decodedResult,
								)
								yield* Deferred.succeed(inFlightDef, result)
								yield* inflightTasks.remove(cacheKey)
								return {
									cacheKey,
									result,
									taskId: task.id,
									taskPath,
								}
							} else {
								// TODO: reading cache failed, why would this happen?
								// get rid of this and just throw?
								return yield* Effect.fail(
									new TaskRuntimeError({
										message:
											"Cache hit, but failed to read cache",
									}),
								)
							}
						} else {
							const result = yield* Effect.tryPromise({
								try: () => cachedTask.effect(taskCtx),
								catch: (error) => {
									return new TaskRuntimeError({
										message: "Error executing cached task",
										error,
									})
								},
							})
							// TODO: fix. maybe not json stringify?
							yield* Effect.annotateCurrentSpan({
								encoding: result,
							})
							yield* Effect.logDebug("encoding result:", result)
							const encodedResult = yield* Effect.tryPromise({
								try: () =>
									cachedTask.encode(taskCtx, result, input),
								catch: (error) => {
									return new TaskRuntimeError({
										message: "Error encoding cached task",
										error,
									})
								},
							})
							yield* Effect.logDebug(
								"encoded result",
								"with type:",
								typeof encodedResult,
								"with value:",
								encodedResult,
							)
							yield* taskRegistry.set(cacheKey, encodedResult)
							yield* Deferred.succeed(inFlightDef, result)
							yield* inflightTasks.remove(cacheKey)
							return {
								cacheKey,
								result,
								taskId: task.id,
								taskPath,
							}
						}
					}),
				onNone: () =>
					Effect.gen(function* () {
						yield* uncachedTaskCount(Effect.succeed(1))
						const result = yield* Effect.tryPromise({
							try: () => task.effect(taskCtx),
							catch: (error) => {
								return new TaskRuntimeError({
									message: "Error executing task",
									error,
								})
							},
						})
						return {
							cacheKey: undefined,
							result,
							taskId: task.id,
							taskPath,
						}
					}),
			})
		})().pipe(
			Effect.flatMap((taskResult) =>
				Effect.gen(function* () {
					// TODO: updates from the task effect? pass in cb?
					const currentDeferred = deferredMap.get(taskResult.taskId)
					if (currentDeferred) {
						yield* Deferred.succeed(currentDeferred, taskResult)
					}

					// TODO: yield instead?
					progressCb({
						taskId: task.id,
						taskPath: taskResult.taskPath,
						status: "completed",
						result: taskResult.result,
					})

					yield* Effect.annotateCurrentSpan({
						result: taskResult.result,
					})
					// TODO: dont set for deduplicated tasks?
					yield* totalTaskCount(Effect.succeed(1))
					return taskResult
				}),
			),
		),
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

export const getNodeByPath = (
	taskCtx: TaskCtxShape,
	taskPathString: TaskFullName,
) =>
	Effect.gen(function* () {
		const taskPath: string[] = taskPathString.split(":")
		const { taskTree } = taskCtx
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
