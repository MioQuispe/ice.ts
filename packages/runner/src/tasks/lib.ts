import {
	Chunk,
	ConfigProvider,
	Context,
	Data,
	Deferred,
	Effect,
	Match,
	Option,
} from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import type { ICEConfig, TaskTree } from "../types/types.js"
import type { Scope } from "../types/types.js"
import type { TaskTreeNode } from "../types/types.js"
import type { Task } from "../types/types.js"
import type { ConfigNetwork } from "../types/schema.js"
import { HttpAgent } from "@dfinity/agent"
import type { SignIdentity } from "@dfinity/agent"
import type { Principal } from "@dfinity/principal"
import type { Identity } from "@dfinity/agent"
import { DependencyResults, runTaskByPath, runTask, TaskInfo } from "./run.js"
import { principalToAccountId } from "../utils/utils.js"
import { Layer } from "effect"
import { Stream } from "effect"
import { configMap, Ids } from "../index.js"
import { runtime } from "../index.js"
import { NodeContext } from "@effect/platform-node"
import { DefaultReplica, type ReplicaService } from "../services/replica.js"
import { PocketICService } from "src/services/pic.js"
import { DfxReplica } from "src/services/dfx.js"

const asyncRunTask = async <A>(task: Task): Promise<A> => {
	// @ts-ignore
	const result = runtime.runPromise(runTask(task))
	return result as A
}

export type TaskCtxShape = {
	// readonly network: string
	// networks?: {
	// 	[k: string]: ConfigNetwork
	// } | null
	// readonly subnet: string
	readonly users: {
		[name: string]: {
			identity: SignIdentity
			// agent: HttpAgent
			principal: string
			accountId: string
			// TODO: neurons?
		}
	}
	readonly roles: {
		[name: string]: {
			identity: SignIdentity
			principal: string
			accountId: string
			agent: HttpAgent
		}
	}
	readonly replica: ReplicaService
	readonly runTask: typeof asyncRunTask
}

export class TaskCtx extends Context.Tag("TaskCtx")<TaskCtx, TaskCtxShape>() {}

export class TaskNotFoundError extends Data.TaggedError("TaskNotFoundError")<{
	path: string[]
	reason: string
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
				reason: "Task not found by id",
				path: [""],
			}),
		)
	})

export const collectDependencies = (
	rootTasks: Task[],
	collected: Map<symbol, Task> = new Map(),
): Map<symbol, Task> => {
	for (const rootTask of rootTasks) {
		if (collected.has(rootTask.id)) continue
		collected.set(rootTask.id, rootTask)
		for (const key in rootTask.provide) {
			const dependency = rootTask.provide[key]
			collectDependencies([dependency], collected)
		}
	}
	return collected
}

/**
 * Topologically sorts tasks based on the "provide" field dependencies.
 * The tasks Map now uses symbols as keys.
 *
 * @param tasks A map of tasks keyed by their id (as symbol).
 * @returns An array of tasks sorted in execution order.
 * @throws Error if a cycle is detected.
 */
export const topologicalSortTasks = <A, E, R, I>(
	tasks: Map<symbol, Task<A, E, R, I>>,
): Task<A, E, R, I>[] => {
	const indegree = new Map<symbol, number>()
	const adjList = new Map<symbol, symbol[]>()

	// Initialize graph nodes.
	for (const [id, task] of tasks.entries()) {
		indegree.set(id, 0)
		adjList.set(id, [])
	}

	// Build the graph using the "provide" field.
	for (const [id, task] of tasks.entries()) {
		for (const key in task.provide) {
			const providedTask = task.provide[key]
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

	const sortedTasks: Task<A, E, R, I>[] = []
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
		throw new Error("Cycle detected in task dependencies via 'provide' field.")
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

export const executeTasks = <A, E, R, I>(
	tasks: Task<A, E, R, I>[],
	progressCb: (update: ProgressUpdate<A>) => void = () => {},
) =>
	Effect.gen(function* () {
		const defaultReplica = yield* DefaultReplica
		// TODO: yield* DefaultConfig?
		const defaultUser = yield* Effect.tryPromise(() => Ids.fromDfx("default"))
		const defaultConfig: ICEConfig = {
			replica: defaultReplica,
			users: {
				default: defaultUser,
			},
			roles: {
				deployer: "default",
				minter: "default",
				controller: "default",
				treasury: "default",
			},
		}
		// Create a deferred for every task to hold its eventual result.
		const deferredMap = new Map<symbol, Deferred.Deferred<E | unknown, R>>()
		for (const task of tasks) {
			const deferred = yield* Deferred.make<E | unknown, R>()
			deferredMap.set(task.id, deferred)
		}
		const results = new Map<symbol, unknown>()
		const taskEffects = tasks.map((task) =>
			Effect.gen(function* () {
				const dependencyResults: Record<string, unknown> = {}
				for (const dependencyName in task.provide) {
					const providedTask = task.provide[dependencyName]
					const depDeferred = deferredMap.get(providedTask.id)
					if (depDeferred) {
						const depResult = yield* Deferred.await(depDeferred)
						dependencyResults[dependencyName] = depResult
					}
				}
				const taskPath = yield* getTaskPathById(task.id)
				progressCb({ taskId: task.id, taskPath, status: "starting" })
				const { config } = yield* ICEConfigService
				const currentReplica = config?.replica ?? defaultReplica
				const currentRoles = config?.roles ?? defaultConfig.roles
				const currentUsers = config?.users ?? defaultConfig.users
				// TODO: pre-initialize agents? this is repeated for each task now
				const rolesResult = yield* Effect.all(
					// TODO: default roles?
					Object.entries(currentRoles).map(([name, role]) =>
						Effect.gen(function* () {
							const agent = yield* Effect.tryPromise(() =>
								HttpAgent.create({
									identity: currentUsers[role].identity,
									host: `${currentReplica.host}:${currentReplica.port}`,
								}),
							)
							yield* Effect.tryPromise(() => agent.fetchRootKey())
							return {
								[name]: {
									identity: currentUsers[role].identity,
									principal: currentUsers[role].principal,
									accountId: currentUsers[role].accountId,
									agent,
								},
							}
						}),
					),
					{
						concurrency: "unbounded",
					},
				)

				const roles = rolesResult.reduce((acc, role) => {
					return Object.assign(acc, role)
				}, {})

				const taskLayer = Layer.mergeAll(
					Layer.succeed(TaskInfo, {
						taskPath,
						// TODO: provide more?
					}),
					Layer.succeed(TaskCtx, {
						...defaultConfig,
						// TODO: wrap with proxy?
						runTask: asyncRunTask,
						replica: currentReplica,
						users: {
							default: defaultUser,
							...currentUsers,
						},
						roles,
					}),
					Layer.succeed(DependencyResults, {
						dependencies: dependencyResults,
					}),
					Layer.setConfigProvider(
						ConfigProvider.fromMap(
							new Map([...Array.from(configMap.entries())]),
						),
					),
				)
				// TODO: updates from the task effect? pass in cb?
				const result = yield* task.effect.pipe(Effect.provide(taskLayer))

				const currentDeferred = deferredMap.get(task.id)
				if (currentDeferred) {
					yield* Deferred.succeed(currentDeferred, result)
				}

				progressCb({
					taskId: task.id,
					taskPath,
					status: "completed",
					result,
				})
				results.set(task.id, result)
			}),
		)
		yield* Effect.all(taskEffects, { concurrency: "unbounded" })
		return results
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
export const getTaskByPath = (taskPathString: TaskFullName) =>
	Effect.gen(function* () {
		const taskPath: string[] = taskPathString.split(":")
		const { taskTree, config } = yield* ICEConfigService
		const task = yield* findTaskInTaskTree(taskTree, taskPath)
		return { task, config }
	})

export const getNodeByPath = (taskPathString: TaskFullName) =>
	Effect.gen(function* () {
		const taskPath: string[] = taskPathString.split(":")
		const { taskTree } = yield* ICEConfigService
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
				if (!(segment in current)) {
					yield* Effect.fail(
						new TaskNotFoundError({
							path,
							reason: `Segment "${segment}" not found in tree.`,
						}),
					)
				}
				current = current[segment]
			} else if (current._tag === "scope") {
				if (!(segment in current.children)) {
					yield* Effect.fail(
						new TaskNotFoundError({
							path,
							reason: `Segment "${segment}" not found in scope children.`,
						}),
					)
				}
				current = current.children[segment] as TaskTreeNode
			} else {
				yield* Effect.fail(
					new TaskNotFoundError({
						path,
						reason: `Cannot traverse into node with tag "${current._tag}" at segment "${segment}".`,
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
					const taskTree = node as TaskTree
					node = taskTree[key]

					if (node._tag === "task") {
						return node as Task
					} else if (node._tag === "scope") {
						if (Option.isSome((node as Scope).defaultTask)) {
							// TODO: fix
							// @ts-ignore
							const taskName = node.defaultTask.value
							return node.children[taskName] as Task
						}
					}

					return yield* Effect.fail(
						new TaskNotFoundError({
							path: keys,
							reason: `Invalid node type encountered at key "${key}"`,
						}),
					)
				} else {
					node = node[key]
				}
			} else if (node._tag === "task") {
				if (isLastKey) {
					return node
				}
				return yield* Effect.fail(
					new TaskNotFoundError({
						path: keys,
						reason: `Invalid node type encountered at key "${key}"`,
					}),
				)
			} else if (node._tag === "scope") {
				if (isLastKey) {
					node = node.children[key]

					if (node._tag === "task") {
						return node
					}
					if (Option.isSome(node.defaultTask)) {
						const taskName = node.defaultTask.value
						// @ts-ignore
						return node.children[taskName] as Task
					}
					return yield* Effect.fail(
						new TaskNotFoundError({
							path: keys,
							reason: "No default task found for scope",
						}),
					)
				}
				node = node.children[key] as TaskTreeNode
			}
		}

		return yield* Effect.fail(
			new TaskNotFoundError({
				path: keys,
				reason: "Path traversal completed without finding a task",
			}),
		)
	})
}
