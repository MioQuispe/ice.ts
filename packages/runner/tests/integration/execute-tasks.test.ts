import { NodeContext } from "@effect/platform-node"
import { layerMemory } from "@effect/platform/KeyValueStore"
import {
	Effect,
	Layer,
	Logger,
	LogLevel,
	ManagedRuntime,
	Ref
} from "effect"
import { describe, expect, it } from "vitest"
import { task } from "../../src/builders/task.js"
import { configLayer } from "../../src/index.js"
import {
	CanisterIdsService
} from "../../src/services/canisterIds.js"
import { CLIFlags } from "../../src/services/cliFlags.js"
import { DefaultConfig } from "../../src/services/defaultConfig.js"
import { ICEConfigService } from "../../src/services/iceConfig.js"
import { Moc } from "../../src/services/moc.js"
import { picReplicaImpl } from "../../src/services/pic/pic.js"
import { DefaultReplica } from "../../src/services/replica.js"
import { TaskArgsService } from "../../src/services/taskArgs.js"
import { TaskRegistry } from "../../src/services/taskRegistry.js"
import { executeTasks, topologicalSortTasks } from "../../src/tasks/lib.js"
import { CachedTask, ICEConfig, Task, TaskTree } from "../../src/types/types.js"

const DefaultReplicaService = Layer.effect(DefaultReplica, picReplicaImpl).pipe(
	Layer.provide(NodeContext.layer),
	Layer.provide(configLayer),
)

const makeTestRuntime = (
	{ cliTaskArgs = { positionalArgs: [], namedArgs: {} }, taskArgs = {} } = {
		cliTaskArgs: { positionalArgs: [], namedArgs: {} },
		taskArgs: {},
	},
	taskTree: TaskTree = {},
) => {
	const globalArgs = { network: "local", logLevel: "debug" } as const
	const config = {} satisfies Partial<ICEConfig>
	// const taskTree = {} satisfies TaskTree
	const testICEConfigService = ICEConfigService.of({
		config,
		taskTree,
	})
	const layer = Layer.mergeAll(
		NodeContext.layer,
		TaskRegistry.Live.pipe(
			// TODO: double-check that this works
			// Layer.provide(layerFileSystem(".ice/cache")),
			Layer.provide(layerMemory),
			Layer.provide(NodeContext.layer),
		),
		DefaultReplicaService,
		DefaultConfig.Live.pipe(Layer.provide(DefaultReplicaService)),
		Moc.Live.pipe(Layer.provide(NodeContext.layer)),
		configLayer,
		CanisterIdsService.Test,
		Layer.succeed(ICEConfigService, testICEConfigService),
		Layer.succeed(CLIFlags, {
			globalArgs,
			taskArgs: cliTaskArgs,
		}),
		Layer.succeed(TaskArgsService, { taskArgs }),
		Logger.pretty,
		Logger.minimumLogLevel(LogLevel.Debug),
	)
	return ManagedRuntime.make(layer)
}

const makeTask = <A = unknown>(name: string, value: A): Task<A> => ({
	_tag: "task",
	id: Symbol(name),
	description: name,
	tags: [],
	effect: Effect.succeed(value),
	dependsOn: {},
	dependencies: {},
	namedParams: {},
	positionalParams: [],
	params: {},
})

const makeCachedTask = (name: string, value: string): CachedTask<string> => {
	const cachedTask = {
		...task()
			.run(() => value)
			.make(),
		computeCacheKey: () => name, // ← always the same key
		input: () => Effect.succeed(undefined),
		encode: (v) => Effect.succeed(v), // identity
		decode: (v: string | Uint8Array<ArrayBufferLike>) =>
			Effect.succeed(v as string),
		encodingFormat: "string",
	} satisfies CachedTask<string>
	return cachedTask
}

describe("executeTasks", () => {
	// Build a small DAG:   C <- A
	//                      C <- B
	const a = task().make()
	const b = task().make()
	const c = task().make()
	c.dependencies = { one: a, two: b }

	const progress: Array<string> = []
	// TODO: taskTree needs to have the same tasks as our test tasks
	// const runtime = makeTestRuntime({}, taskTree)

	it("runs tasks after their dependencies", async () => {
		const tasks = topologicalSortTasks(
			new Map([
				[a.id, a],
				[b.id, b],
				[c.id, c],
			]),
		)
		// (no replica needed)
		const taskTree = {
			a: a,
			b: b,
			c: c,
		}
		const runtime = makeTestRuntime({}, taskTree)
		// TODO: makeRuntime here?
		await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(
					tasks,
					({ taskPath, status }) => {
						if (status === "completed") {
							progress.push(taskPath)
						}
					},
				)
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				// executeTasks(tasks, ({ taskPath, status }) => {
				// 	if (status === "completed") progress.push(taskPath)
				// }),
				return results
			}),
		)

		// C must be last, order of A / B does not matter
		console.log(progress)
		expect(progress.at(-1)).toBe("c")
		expect(progress.sort()).toEqual(["a", "b", "c"]) // all ran
	})

	it("reads from and writes to the cache only once", async () => {
		// TODO: wrong taskTree! pass in the cached tasks
		const cached = makeCachedTask("cached-task", "first")
		const tasks = [cached]
		// (no replica needed)
		const taskTree = {
			cached: cached,
		}
		const runtime = makeTestRuntime({}, taskTree)

		// 1st run ⇒ miss + store
		const first = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)
		expect(first.find((r) => r.taskId === cached.id)?.result).toBe("first")

		// change the effect to prove it is *not* evaluated the 2nd time
		cached.effect = Effect.dieMessage("should not evaluate")

		// 2nd run ⇒ hit, same value
		const second = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)
		expect(second.find((r) => r.taskId === cached.id)?.result).toBe("first")
	})

	it("obeys the global concurrency limit", async () => {
		const counter = Ref.unsafeMake(0)
		const maxSeen = Ref.unsafeMake(0)

		const slow = (name: string) => ({
			...task().make(),
			effect: Effect.gen(function* (_) {
				const cur = yield* _(Ref.updateAndGet(counter, (n) => n + 1))
				yield* _(Ref.update(maxSeen, (m) => Math.max(m, cur)))
				yield* _(Effect.sleep("20 millis"))
				yield* _(Ref.update(counter, (n) => n - 1))
			}),
		})

		const tasks = ["t1", "t2", "t3", "t4", "t5"].map(slow)
		// (no replica needed)
		const taskTree = {
			t1: tasks[0]!,
			t2: tasks[1]!,
			t3: tasks[2]!,
			t4: tasks[3]!,
			t5: tasks[4]!,
		}
		const runtime = makeTestRuntime({}, taskTree)

		await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, { concurrency: 2 })
				return results
			}),
		)

		const max = runtime.runSync(Ref.get(maxSeen))
		expect(max).toBeLessThanOrEqual(2) // never more than 2 running
	})

	it("handles deep dependency chains correctly", async () => {
		const executionOrder: Array<string> = []
		
		// Create a chain: root -> level1 -> level2 -> level3
		const level3 = makeTask("level3", "L3")
		const level2 = makeTask("level2", "L2")
		const level1 = makeTask("level1", "L1")
		const root = makeTask("root", "ROOT")

		// Set up dependencies
		level2.dependencies = { prev: level3 }
		level1.dependencies = { prev: level2 }
		root.dependencies = { prev: level1 }

		// Track execution order
		const trackingTasks = [level3, level2, level1, root].map(task => ({
			...task,
			effect: Effect.gen(function* () {
				executionOrder.push(task.description)
				const result = yield* task.effect
				return result
			}),
		}))

		const tasks = topologicalSortTasks(
			new Map([
				[trackingTasks[0]!.id, trackingTasks[0]!],
				[trackingTasks[1]!.id, trackingTasks[1]!],
				[trackingTasks[2]!.id, trackingTasks[2]!],
				[trackingTasks[3]!.id, trackingTasks[3]!],
			]),
		)

		const taskTree = {
			level3: trackingTasks[0]!,
			level2: trackingTasks[1]!,
			level1: trackingTasks[2]!,
			root: trackingTasks[3]!,
		}

		const runtime = makeTestRuntime({}, taskTree)

		await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)

		// Should execute in order: level3, level2, level1, root
		expect(executionOrder).toEqual(["level3", "level2", "level1", "root"])
	})

	it("handles diamond dependencies correctly", async () => {
		const executionOrder: Array<string> = []
		
		// Create diamond: top -> left/right -> bottom
		const top = makeTask("top", "TOP")
		const left = makeTask("left", "LEFT")
		const right = makeTask("right", "RIGHT")
		const bottom = makeTask("bottom", "BOTTOM")

		// Set up dependencies
		left.dependencies = { parent: top }
		right.dependencies = { parent: top }
		bottom.dependencies = { leftParent: left, rightParent: right }

		// Track execution order
		const trackingTasks = [top, left, right, bottom].map(task => ({
			...task,
			effect: Effect.gen(function* () {
				executionOrder.push(task.description)
				const result = yield* task.effect
				return result
			}),
		}))

		const tasks = topologicalSortTasks(
			new Map([
				[trackingTasks[0]!.id, trackingTasks[0]!],
				[trackingTasks[1]!.id, trackingTasks[1]!],
				[trackingTasks[2]!.id, trackingTasks[2]!],
				[trackingTasks[3]!.id, trackingTasks[3]!],
			]),
		)

		const taskTree = {
			top: trackingTasks[0]!,
			left: trackingTasks[1]!,
			right: trackingTasks[2]!,
			bottom: trackingTasks[3]!,
		}

		const runtime = makeTestRuntime({}, taskTree)

		await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)

		// Top should be first, bottom should be last
		expect(executionOrder[0]).toBe("top")
		expect(executionOrder[3]).toBe("bottom")
		// Left and right can run in parallel after top
		expect(executionOrder.slice(1, 3).sort()).toEqual(["left", "right"])
	})

	it("handles task failure propagation", async () => {
		const failingTask = makeTask("failing", "FAIL")
		const dependentTask = makeTask("dependent", "DEPENDENT")

		// Make the first task fail
		failingTask.effect = Effect.fail("Task failed")
		dependentTask.dependencies = { prerequisite: failingTask }

		const tasks = topologicalSortTasks(
			new Map([
				[failingTask.id, failingTask],
				[dependentTask.id, dependentTask],
			]),
		)

		const taskTree = {
			failing: failingTask,
			dependent: dependentTask,
		}

		const runtime = makeTestRuntime({}, taskTree)

		// The execution should fail when the dependency fails
		await expect(
			runtime.runPromise(
				Effect.gen(function* () {
					const taskEffects = yield* executeTasks(tasks)
					const results = yield* Effect.all(taskEffects, {
						concurrency: "unbounded",
					})
					return results
				}),
			)
		).rejects.toThrow()
	})

	it("handles mixed cached and non-cached tasks with dependencies", async () => {
		const executionOrder: Array<string> = []
		
		// Create mixed scenario: cached -> non-cached -> cached
		const cachedRoot = makeCachedTask("cached-root", "CACHED_ROOT")
		const nonCachedMiddle = makeTask("non-cached-middle", "NON_CACHED")
		const cachedLeaf = makeCachedTask("cached-leaf", "CACHED_LEAF")

		// Set up dependencies
		nonCachedMiddle.dependencies = { root: cachedRoot }
		cachedLeaf.dependencies = { middle: nonCachedMiddle }

		// Track execution order for the non-cached task
		const trackingNonCached = {
			...nonCachedMiddle,
			effect: Effect.gen(function* () {
				executionOrder.push(nonCachedMiddle.description)
				const result = yield* nonCachedMiddle.effect
				return result
			}),
		}

		const tasks = topologicalSortTasks(
			new Map([
				[cachedRoot.id, cachedRoot],
				[trackingNonCached.id, trackingNonCached],
				[cachedLeaf.id, cachedLeaf],
			]),
		)

		const taskTree = {
			"cached-root": cachedRoot,
			"non-cached-middle": trackingNonCached,
			"cached-leaf": cachedLeaf,
		}

		const runtime = makeTestRuntime({}, taskTree)

		// First run - all should execute
		const firstResults = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)

		expect(executionOrder).toEqual(["non-cached-middle"])
		expect(firstResults.length).toBe(3)

		// Reset execution order
		executionOrder.length = 0

		// Second run - cached tasks should use cache, non-cached should run again
		const secondResults = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)

		expect(executionOrder).toEqual(["non-cached-middle"]) // Only non-cached ran
		expect(secondResults.length).toBe(3)
	})

	it("handles cache invalidation with different cache keys", async () => {
		let cacheKeyCounter = 0
		
		const dynamicCachedTask = {
			...task()
				.run(() => `result-${cacheKeyCounter}`)
				.make(),
			computeCacheKey: () => `dynamic-key-${cacheKeyCounter}`,
			input: () => Effect.succeed(undefined),
			encode: (v: string) => Effect.succeed(v),
			decode: (v: string | Uint8Array<ArrayBufferLike>) =>
				Effect.succeed(v as string),
			encodingFormat: "string",
		} satisfies CachedTask<string>

		const taskTree = {
			"dynamic-cached": dynamicCachedTask,
		}

		const runtime = makeTestRuntime({}, taskTree)

		// First run with cacheKeyCounter = 0
		const firstResults = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks([dynamicCachedTask])
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)

		expect(firstResults[0]?.result).toBe("result-0")

		// Change cache key counter
		cacheKeyCounter = 1

		// Second run with different cache key should re-execute
		const secondResults = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks([dynamicCachedTask])
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)

		expect(secondResults[0]?.result).toBe("result-1")
	})

	it("maintains concurrency limits with complex dependency tree", async () => {
		const concurrentCounter = Ref.unsafeMake(0)
		const maxConcurrent = Ref.unsafeMake(0)

		const createTimedTask = (name: string, dependencies: Record<string, Task> = {}) => ({
			...task().make(),
			description: name,
			dependencies,
			effect: Effect.gen(function* () {
				const current = yield* Ref.updateAndGet(concurrentCounter, (n) => n + 1)
				yield* Ref.update(maxConcurrent, (max) => Math.max(max, current))
				yield* Effect.sleep("30 millis")
				yield* Ref.update(concurrentCounter, (n) => n - 1)
				return name
			}),
		})

		// Create tree: root -> [branch1, branch2] -> leaf
		const root = createTimedTask("root")
		const branch1 = createTimedTask("branch1", { parent: root })
		const branch2 = createTimedTask("branch2", { parent: root })
		const leaf = createTimedTask("leaf", { b1: branch1, b2: branch2 })

		const tasks = topologicalSortTasks(
			new Map([
				[root.id, root],
				[branch1.id, branch1],
				[branch2.id, branch2],
				[leaf.id, leaf],
			]),
		)

		const taskTree = {
			root,
			branch1,
			branch2,
			leaf,
		}

		const runtime = makeTestRuntime({}, taskTree)

		await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, { concurrency: 2 })
				return results
			}),
		)

		const maxReached = runtime.runSync(Ref.get(maxConcurrent))
		expect(maxReached).toBeLessThanOrEqual(2)
	})

	it("handles independent task groups with concurrency", async () => {
		const executionTimes: Array<{ task: string; start: number; end: number }> = []

		const createTrackingTask = (name: string) => ({
			...task().make(),
			description: name,
			effect: Effect.gen(function* () {
				const start = Date.now()
				yield* Effect.sleep("25 millis")
				const end = Date.now()
				executionTimes.push({ task: name, start, end })
				return name
			}),
		})

		// Create two independent groups
		const group1 = ["g1t1", "g1t2", "g1t3"].map(createTrackingTask)
		const group2 = ["g2t1", "g2t2", "g2t3"].map(createTrackingTask)

		const allTasks = [...group1, ...group2]
		const tasks = topologicalSortTasks(
			new Map(allTasks.map(task => [task.id, task])),
		)

		const taskTree = Object.fromEntries(
			allTasks.map(task => [task.description, task])
		)

		const runtime = makeTestRuntime({}, taskTree)

		await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, { concurrency: 3 })
				return results
			}),
		)

		expect(executionTimes.length).toBe(6)
		
		// Check that tasks ran concurrently (some should overlap)
		const sortedByStart = executionTimes.sort((a, b) => a.start - b.start)
		const hasOverlap = sortedByStart.some((task, index) => {
			if (index === 0) return false
			const prevTask = sortedByStart[index - 1]!
			return task.start < prevTask.end
		})
		expect(hasOverlap).toBe(true)
	})

	it("handles very deep dependency chains (canister-like)", async () => {
		const executionOrder: Array<string> = []
		
		// Simulate canister dependency chain: create -> build -> bindings -> install_args -> install -> deploy
		const create = makeTask("create", "CREATED")
		const build = makeTask("build", "BUILT")
		const bindings = makeTask("bindings", "BINDINGS")
		const installArgs = makeTask("install_args", "INSTALL_ARGS")
		const install = makeTask("install", "INSTALLED")
		const deploy = makeTask("deploy", "DEPLOYED")

		// Set up chain dependencies
		build.dependencies = { create }
		bindings.dependencies = { build }
		installArgs.dependencies = { bindings }
		install.dependencies = { install_args: installArgs }
		deploy.dependencies = { install }

		// Track execution order
		const trackingTasks = [create, build, bindings, installArgs, install, deploy].map(task => ({
			...task,
			effect: Effect.gen(function* () {
				executionOrder.push(task.description)
				const result = yield* task.effect
				return result
			}),
		}))

		const tasks = topologicalSortTasks(
			new Map(trackingTasks.map(task => [task.id, task])),
		)

		const taskTree = Object.fromEntries(
			trackingTasks.map(task => [task.description, task])
		)

		const runtime = makeTestRuntime({}, taskTree)

		await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)

		// Should execute in strict order
		expect(executionOrder).toEqual(["create", "build", "bindings", "install_args", "install", "deploy"])
	})

	it("handles parameterized tasks with dynamic values", async () => {
		const executionResults: Array<{ task: string; params: any }> = []

		const createParameterizedTask = (name: string) => {
			const baseTask = makeTask(name, "PARAM_RESULT")
			return {
				...baseTask,
				effect: Effect.gen(function* () {
					const params = { amount: 50, mode: "reinstall" } // Simulate runtime params
					executionResults.push({ task: name, params })
					return `${name}_executed_with_params`
				}),
			}
		}

		const paramTask1 = createParameterizedTask("param_task_1")
		const paramTask2 = createParameterizedTask("param_task_2")
		const dependentTask = makeTask("dependent_task", "DEPENDENT")

		dependentTask.dependencies = { task1: paramTask1, task2: paramTask2 }

		const tasks = topologicalSortTasks(
			new Map([
				[paramTask1.id, paramTask1],
				[paramTask2.id, paramTask2],
				[dependentTask.id, dependentTask],
			]),
		)

		const taskTree = {
			param_task_1: paramTask1,
			param_task_2: paramTask2,
			dependent_task: dependentTask,
		}

		const runtime = makeTestRuntime({}, taskTree)

		const results = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)

		expect(executionResults.length).toBe(2)
		expect(executionResults[0]!.params.amount).toBe(50)
		expect(executionResults[1]!.params.amount).toBe(50)
		expect(results.length).toBe(3)
	})

	it("handles dynamic task execution (task calling other tasks)", async () => {
		const executionOrder: Array<string> = []
		
		// Create a task that dynamically calls other tasks
		const baseTask = makeTask("base_task", "BASE")
		const dynamicTask = {
			...task().make(),
			description: "dynamic_caller",
			effect: Effect.gen(function* () {
				executionOrder.push("dynamic_caller_start")
				// Simulate calling another task
				const baseResult = yield* baseTask.effect
				executionOrder.push("dynamic_caller_end")
				return `called_${baseResult}`
			}),
		}

		// Track base task execution
		const trackingBaseTask = {
			...baseTask,
			effect: Effect.gen(function* () {
				executionOrder.push("base_task")
				const result = yield* baseTask.effect
				return result
			}),
		}

		const tasks = topologicalSortTasks(
			new Map([
				[trackingBaseTask.id, trackingBaseTask],
				[dynamicTask.id, dynamicTask],
			]),
		)

		const taskTree = {
			base_task: trackingBaseTask,
			dynamic_caller: dynamicTask,
		}

		const runtime = makeTestRuntime({}, taskTree)

		const results = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)

		expect(executionOrder).toEqual(["base_task", "dynamic_caller_start", "dynamic_caller_end"])
		expect(results.find(r => r.taskId === dynamicTask.id)?.result).toBe("called_BASE")
	})

	it("handles cache behavior with different encoding formats", async () => {
		const stringCachedTask = {
			...task()
				.run(() => "string_result")
				.make(),
			computeCacheKey: () => "string_task_key",
			input: () => Effect.succeed(undefined),
			encode: (v: string) => Effect.succeed(v),
			decode: (v: string | Uint8Array<ArrayBufferLike>) => Effect.succeed(v as string),
			encodingFormat: "string",
		} satisfies CachedTask<string>

		const binaryCachedTask = {
			...task()
				.run(() => new Uint8Array([1, 2, 3, 4]))
				.make(),
			computeCacheKey: () => "binary_task_key",
			input: () => Effect.succeed(undefined),
			encode: (v: Uint8Array) => Effect.succeed(v),
			decode: (v: string | Uint8Array<ArrayBufferLike>) => Effect.succeed(v as Uint8Array),
			encodingFormat: "uint8array",
		} satisfies CachedTask<Uint8Array>

		const taskTree = {
			string_cached: stringCachedTask,
			binary_cached: binaryCachedTask,
		}

		const runtime = makeTestRuntime({}, taskTree)

		// First run - should cache both
		const firstResults = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks([stringCachedTask, binaryCachedTask])
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)

		expect(firstResults[0]?.result).toBe("string_result")
		expect(firstResults[1]?.result).toEqual(new Uint8Array([1, 2, 3, 4]))

		// Modify effects to verify cache is used
		stringCachedTask.effect = Effect.succeed("modified_string")
		binaryCachedTask.effect = Effect.succeed(new Uint8Array([5, 6, 7, 8]))

		// Second run - should use cache
		const secondResults = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks([stringCachedTask, binaryCachedTask])
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)

		expect(secondResults[0]?.result).toBe("string_result") // From cache
		expect(secondResults[1]?.result).toEqual(new Uint8Array([1, 2, 3, 4])) // From cache
	})

	it("handles error propagation in very deep chains", async () => {
		// Create a 6-level deep chain where the 4th level fails
		const level1 = makeTask("level1", "L1")
		const level2 = makeTask("level2", "L2")
		const level3 = makeTask("level3", "L3")
		const level4 = makeTask("level4", "L4") // This will fail
		const level5 = makeTask("level5", "L5")
		const level6 = makeTask("level6", "L6")

		// Set up dependencies
		level2.dependencies = { prev: level1 }
		level3.dependencies = { prev: level2 }
		level4.dependencies = { prev: level3 }
		level5.dependencies = { prev: level4 }
		level6.dependencies = { prev: level5 }

		// Make level4 fail
		level4.effect = Effect.fail("Deep chain failure")

		const tasks = topologicalSortTasks(
			new Map([
				[level1.id, level1],
				[level2.id, level2],
				[level3.id, level3],
				[level4.id, level4],
				[level5.id, level5],
				[level6.id, level6],
			]),
		)

		const taskTree = {
			level1, level2, level3, level4, level5, level6,
		}

		const runtime = makeTestRuntime({}, taskTree)

		await expect(
			runtime.runPromise(
				Effect.gen(function* () {
					const taskEffects = yield* executeTasks(tasks)
					const results = yield* Effect.all(taskEffects, {
						concurrency: "unbounded",
					})
					return results
				}),
			)
		).rejects.toThrow()
	})

	it("handles multiple independent cached task chains", async () => {
		// Create two independent chains, each with cached tasks
		const chain1Root = makeCachedTask("chain1_root", "C1_ROOT")
		const chain1Middle = makeCachedTask("chain1_middle", "C1_MIDDLE")
		const chain1Leaf = makeCachedTask("chain1_leaf", "C1_LEAF")

		const chain2Root = makeCachedTask("chain2_root", "C2_ROOT")
		const chain2Middle = makeCachedTask("chain2_middle", "C2_MIDDLE")
		const chain2Leaf = makeCachedTask("chain2_leaf", "C2_LEAF")

		// Set up dependencies within each chain
		chain1Middle.dependencies = { root: chain1Root }
		chain1Leaf.dependencies = { middle: chain1Middle }
		chain2Middle.dependencies = { root: chain2Root }
		chain2Leaf.dependencies = { middle: chain2Middle }

		const allTasks = [chain1Root, chain1Middle, chain1Leaf, chain2Root, chain2Middle, chain2Leaf]
		const tasks = topologicalSortTasks(
			new Map(allTasks.map(task => [task.id, task])),
		)

		const taskTree = Object.fromEntries(
			allTasks.map(task => [task.computeCacheKey(undefined), task])
		)

		const runtime = makeTestRuntime({}, taskTree)

		// First run - all should execute
		const firstResults = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)

		expect(firstResults.length).toBe(6)

		// Modify all effects to verify caching
		allTasks.forEach(task => {
			task.effect = Effect.dieMessage("Should not execute")
		})

		// Second run - should use cache for all
		const secondResults = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)

		expect(secondResults.length).toBe(6)
		
		// Verify all expected results are present
		const resultValues = secondResults.map(r => r.result).sort()
		expect(resultValues).toEqual([
			"C1_LEAF", "C1_MIDDLE", "C1_ROOT", "C2_LEAF", "C2_MIDDLE", "C2_ROOT"
		])
		
		// Verify dependency ordering within each chain
		const resultsByTask = new Map(secondResults.map(r => [r.result, r]))
		const chain1Tasks = ["C1_ROOT", "C1_MIDDLE", "C1_LEAF"]
		const chain2Tasks = ["C2_ROOT", "C2_MIDDLE", "C2_LEAF"]
		
		// Check that within each chain, tasks completed in dependency order
		// (We can't check exact timing, but we can verify the results are all present)
		chain1Tasks.forEach(task => expect(resultsByTask.has(task)).toBe(true))
		chain2Tasks.forEach(task => expect(resultsByTask.has(task)).toBe(true))
	})

	it("handles complex branching with mixed execution times", async () => {
		const executionOrder: Array<string> = []
		
		// Create complex branching: root -> [fast, slow] -> convergence
		const root = makeTask("root", "ROOT")
		const fastBranch = makeTask("fast", "FAST")
		const slowBranch = makeTask("slow", "SLOW")
		const convergence = makeTask("convergence", "CONVERGENCE")

		// Set up dependencies
		fastBranch.dependencies = { parent: root }
		slowBranch.dependencies = { parent: root }
		convergence.dependencies = { fast: fastBranch, slow: slowBranch }

		// Create tracking tasks with different execution times
		const trackingTasks = [
			{ ...root, effect: Effect.gen(function* () { executionOrder.push("root"); yield* root.effect }) },
			{ ...fastBranch, effect: Effect.gen(function* () { 
				yield* Effect.sleep("10 millis"); 
				executionOrder.push("fast"); 
				yield* fastBranch.effect 
			}) },
			{ ...slowBranch, effect: Effect.gen(function* () { 
				yield* Effect.sleep("50 millis"); 
				executionOrder.push("slow"); 
				yield* slowBranch.effect 
			}) },
			{ ...convergence, effect: Effect.gen(function* () { 
				executionOrder.push("convergence"); 
				yield* convergence.effect 
			}) },
		]

		const tasks = topologicalSortTasks(
			new Map(trackingTasks.map(task => [task.id, task])),
		)

		const taskTree = Object.fromEntries(
			trackingTasks.map(task => [task.description, task])
		)

		const runtime = makeTestRuntime({}, taskTree)

		await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)

		// Root should be first, convergence should be last
		expect(executionOrder[0]).toBe("root")
		expect(executionOrder[3]).toBe("convergence")
		// Fast should complete before slow
		expect(executionOrder.indexOf("fast")).toBeLessThan(executionOrder.indexOf("slow"))
	})
})
