import { Effect, ManagedRuntime, Ref } from "effect"
import { describe, expect, it } from "vitest"
import { layer } from "@effect/vitest"
import { task } from "../../src/builders/task.js"
import { ICEConfigService } from "../../src/services/iceConfig.js"
import { executeTasks, topologicalSortTasks } from "../../src/tasks/lib.js"
import { CachedTask, ICEConfig, Task, TaskTree } from "../../src/types/types.js"
import { makeTestLayer, getTasks, makeCachedTask } from "./setup.js"

describe("executeTasks", () => {
	// const testLayer = (() => {
	// 	const tasks = topologicalSortTasks(
	// 		new Map([
	// 			[a.id, a],
	// 			[b.id, b],
	// 			[c.id, c],
	// 		]),
	// 	)
	// 	// (no replica needed)
	// 	const taskTree = {
	// 		a: a,
	// 		b: b,
	// 		c: c,
	// 	}
	// 	return makeTestLayer({}, taskTree)
	// })()
	layer(
		(() => {
			// Build a small DAG:   C <- A
			//                      C <- B
			const a = task().make()
			const b = task().make()
			const c = task().deps({ one: a, two: b }).make()
			return makeTestLayer(
				{},
				{
					a: a,
					b: b,
					c: c,
				},
			)
		})(),
	)((it) => {
		it.effect("runs tasks after their dependencies", () =>
			Effect.gen(function* () {
				const progress: Array<string> = []
				const tasks = yield* getTasks()
				// TODO: makeRuntime here?
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
				// C must be last, order of A / B does not matter
				console.log(progress)
				expect(progress.at(-1)).toBe("c")
				expect(progress.sort()).toEqual(["a", "b", "c"]) // all ran
			}),
		)
	})

	layer(
		makeTestLayer(
			{},
			{
				cached: makeCachedTask("cached-task", "first"),
			},
		),
	)((it) => {
		it.effect("reads from and writes to the cache only once", () =>
			Effect.gen(function* () {
				const { taskTree } = yield* ICEConfigService
				const tasks = yield* getTasks()
				// 1st run ⇒ miss + store
				const cached = taskTree["cached"] as CachedTask
				const taskEffects = yield* executeTasks(tasks)
				const first = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})

				expect(first.find((r) => r.taskId === cached.id)?.result).toBe(
					"first",
				)

				// change the effect to prove it is *not* evaluated the 2nd time
				// cached.effect = Effect.dieMessage("should not evaluate")
				cached.effect = async () => {
					throw new Error("should not evaluate")
				}

				// 2nd run ⇒ hit, same value
				const taskEffects2 = yield* executeTasks(tasks)
				const second = yield* Effect.all(taskEffects2, {
					concurrency: "unbounded",
				})
				expect(second.find((r) => r.taskId === cached.id)?.result).toBe(
					"first",
				)
			}),
		)
	})

	it("obeys the global concurrency limit", async () => {
		const counter = Ref.unsafeMake(0)
		const maxSeen = Ref.unsafeMake(0)
		const slow = (name: string) => ({
			...task().make(),
			effect: () =>
				Effect.gen(function* (_) {
					const cur = yield* _(
						Ref.updateAndGet(counter, (n) => n + 1),
					)
					yield* _(Ref.update(maxSeen, (m) => Math.max(m, cur)))
					yield* _(Effect.sleep("20 millis"))
					yield* _(Ref.update(counter, (n) => n - 1))
				}).pipe(Effect.runPromise),
		})
		const tasks = ["t1", "t2", "t3", "t4", "t5"].map(slow)
		// // (no replica needed)
		const taskTree = {
			t1: tasks[0]!,
			t2: tasks[1]!,
			t3: tasks[2]!,
			t4: tasks[3]!,
			t5: tasks[4]!,
		}
		const testLayer = makeTestLayer({}, taskTree)
		const runtime = ManagedRuntime.make(testLayer)
		runtime.runPromise(
			Effect.gen(function* () {
				const tasks = yield* getTasks()
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, {
					concurrency: 2,
				})
				// 		return results
				// 	}),
				// )
				const max = runtime.runSync(Ref.get(maxSeen))
				expect(max).toBeLessThanOrEqual(2) // never more than 2 running
			}),
		)
	})

	it("handles deep dependency chains correctly", async () => {
		const executionOrder: Array<string> = []

		// Create a chain: root -> level1 -> level2 -> level3
		// const level3 = makeTask("level3", "L3")
		// const level2 = makeTask("level2", "L2")
		// const level1 = makeTask("level1", "L1")
		// const root = makeTask("root", "ROOT")

		const level3 = task("level3")
			.run(() => "L3")
			.make()
		const level2 = task("level2")
			.run(() => "L2")
			.make()
		const level1 = task("level1")
			.run(() => "L1")
			.make()
		const root = task("root")
			.run(() => "ROOT")
			.make()

		// TODO: use builder instead
		level2.dependencies = { prev: level3 }
		level1.dependencies = { prev: level2 }
		root.dependencies = { prev: level1 }

		// Track execution order
		const trackingTasks = [level3, level2, level1, root].map<Task>(
			(task) => ({
				...task,
				effect: (taskCtx) =>
					Effect.gen(function* () {
						executionOrder.push(task.description)
						const result = yield* Effect.tryPromise(() =>
							task.effect(taskCtx),
						)
						return result
					}).pipe(Effect.runPromise),
			}),
		)

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

		const testLayer = makeTestLayer({}, taskTree)
		const runtime = ManagedRuntime.make(testLayer)
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
		const top = task("top")
			.run(() => "TOP")
			.make()
		const left = task("left")
			.run(() => "LEFT")
			.make()
		const right = task("right")
			.run(() => "RIGHT")
			.make()
		const bottom = task("bottom")
			.run(() => "BOTTOM")
			.make()

		// Set up dependencies
		left.dependencies = { parent: top }
		right.dependencies = { parent: top }
		bottom.dependencies = { leftParent: left, rightParent: right }

		// Track execution order
		const trackingTasks = [top, left, right, bottom].map<Task>((task) => ({
			...task,
			effect: (taskCtx) =>
				Effect.gen(function* () {
					executionOrder.push(task.description)
					const result = yield* Effect.tryPromise(() =>
						task.effect(taskCtx),
					)
					return result
				}).pipe(Effect.runPromise),
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

		const testLayer = makeTestLayer({}, taskTree)
		const runtime = ManagedRuntime.make(testLayer)

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
		const failingTask = task("failing")
			.run(() => "FAIL")
			.make() as Task
		const dependentTask = task("dependent")
			.run(() => "DEPENDENT")
			.make()

		// Make the first task fail
		failingTask.effect = (taskCtx) =>
			Effect.gen(function* () {
				yield* Effect.fail("Task failed")
			}).pipe(Effect.runPromise)
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

		const testLayer = makeTestLayer({}, taskTree)
		const runtime = ManagedRuntime.make(testLayer)

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
			),
		).rejects.toThrow()
	})

	it("handles mixed cached and non-cached tasks with dependencies", async () => {
		const executionOrder: Array<string> = []

		// Create mixed scenario: cached -> non-cached -> cached
		const cachedRoot = makeCachedTask("cached-root", "CACHED_ROOT")
		const nonCachedMiddle = task("non-cached-middle")
			.run(() => "NON_CACHED")
			.make()
		const cachedLeaf = makeCachedTask("cached-leaf", "CACHED_LEAF")

		// Set up dependencies
		nonCachedMiddle.dependencies = { root: cachedRoot }
		cachedLeaf.dependencies = { middle: nonCachedMiddle }

		// Track execution order for the non-cached task
		const trackingNonCached: Task = {
			...nonCachedMiddle,
			effect: (taskCtx) =>
				Effect.gen(function* () {
					executionOrder.push(nonCachedMiddle.description)
					const result = yield* Effect.tryPromise(() =>
						nonCachedMiddle.effect(taskCtx),
					)
					return result
				}).pipe(Effect.runPromise),
		}

		const tasks = topologicalSortTasks(
			new Map<symbol, Task | CachedTask>([
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

		const testLayer = makeTestLayer({}, taskTree)
		const runtime = ManagedRuntime.make(testLayer)

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
				.run(async () => {
					return `result-${cacheKeyCounter}`
				})
				.make(),
			effect: async (taskCtx) => {
				return `result-${cacheKeyCounter}`
			},
			computeCacheKey: () => `dynamic-key-${cacheKeyCounter}`,
			input: () => Effect.succeed(undefined).pipe(Effect.runPromise),
			encode: (taskCtx, v) => Effect.succeed(v).pipe(Effect.runPromise),
			decode: (taskCtx, v) =>
				Effect.succeed(v as string).pipe(Effect.runPromise),
			encodingFormat: "string",
		} satisfies CachedTask<string>

		const taskTree = {
			"dynamic-cached": dynamicCachedTask,
		}

		const testLayer = makeTestLayer({}, taskTree)
		const runtime = ManagedRuntime.make(testLayer)

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

		const createTimedTask = (
			name: string,
			dependencies: Record<string, Task> = {},
		): Task => ({
			...task().make(),
			description: name,
			dependencies,
			effect: (taskCtx) =>
				Effect.gen(function* () {
					const current = yield* Ref.updateAndGet(
						concurrentCounter,
						(n) => n + 1,
					)
					yield* Ref.update(maxConcurrent, (max) =>
						Math.max(max, current),
					)
					yield* Effect.sleep("30 millis")
					yield* Ref.update(concurrentCounter, (n) => n - 1)
					return name
				}).pipe(Effect.runPromise),
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

		const testLayer = makeTestLayer({}, taskTree)
		const runtime = ManagedRuntime.make(testLayer)

		await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, {
					concurrency: 2,
				})
				return results
			}),
		)

		const maxReached = runtime.runSync(Ref.get(maxConcurrent))
		expect(maxReached).toBeLessThanOrEqual(2)
	})

	it("handles independent task groups with concurrency", async () => {
		const executionTimes: Array<{
			task: string
			start: number
			end: number
		}> = []

		const createTrackingTask = (name: string): Task => ({
			...task().make(),
			description: name,
			effect: (taskCtx) =>
				Effect.gen(function* () {
					const start = Date.now()
					yield* Effect.sleep("25 millis")
					const end = Date.now()
					executionTimes.push({ task: name, start, end })
					return name
				}).pipe(Effect.runPromise),
		})

		// Create two independent groups
		const group1 = ["g1t1", "g1t2", "g1t3"].map(createTrackingTask)
		const group2 = ["g2t1", "g2t2", "g2t3"].map(createTrackingTask)

		const allTasks = [...group1, ...group2]
		const tasks = topologicalSortTasks(
			new Map(allTasks.map((task) => [task.id, task])),
		)

		const taskTree = Object.fromEntries(
			allTasks.map((task) => [task.description, task]),
		)

		const testLayer = makeTestLayer({}, taskTree)
		const runtime = ManagedRuntime.make(testLayer)

		await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, {
					concurrency: 3,
				})
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
		const create = task("create")
			.run(() => "CREATED")
			.make()
		const build = task("build")
			.run(() => "BUILT")
			.make()
		const bindings = task("bindings")
			.run(() => "BINDINGS")
			.make()
		const install = task("install")
			.run(() => "INSTALLED")
			.make()
		const deploy = task("deploy")
			.run(() => "DEPLOYED")
			.make()

		// Set up chain dependencies
		build.dependencies = { create }
		bindings.dependencies = { build }
		install.dependencies = { bindings }
		deploy.dependencies = { install }

		// Track execution order
		const trackingTasks = [
			create,
			build,
			bindings,
			install,
			deploy,
		].map<Task>((task) => ({
			...task,
			effect: (taskCtx) =>
				Effect.gen(function* () {
					executionOrder.push(task.description)
					const result = yield* Effect.tryPromise(() =>
						task.effect(taskCtx),
					)
					return result
				}).pipe(Effect.runPromise),
		}))

		const tasks = topologicalSortTasks(
			new Map(trackingTasks.map((task) => [task.id, task])),
		)

		const taskTree = Object.fromEntries(
			trackingTasks.map((task) => [task.description, task]),
		)

		const testLayer = makeTestLayer({}, taskTree)
		const runtime = ManagedRuntime.make(testLayer)

		await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)

		// TODO: this might be wrong because we changed the order of the tasks
		// fix the test, double check
		// Should execute in strict order
		expect(executionOrder).toEqual([
			"create",
			"build",
			"bindings",
			"install",
			"deploy",
		])
	})

	it("handles parameterized tasks with dynamic values", async () => {
		const executionResults: Array<{ task: string; params: any }> = []

		const createParameterizedTask = (name: string): Task => {
			const baseTask = task(name)
				.run(() => "PARAM_RESULT")
				.make()
			return {
				...baseTask,
				effect: (taskCtx) =>
					Effect.gen(function* () {
						const params = { amount: 50, mode: "reinstall" } // Simulate runtime params
						executionResults.push({ task: name, params })
						return `${name}_executed_with_params`
					}).pipe(Effect.runPromise),
			}
		}

		const paramTask1 = createParameterizedTask("param_task_1")
		const paramTask2 = createParameterizedTask("param_task_2")
		const dependentTask = task("dependent_task")
			.run(() => "DEPENDENT")
			.make()

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

		const testLayer = makeTestLayer({}, taskTree)
		const runtime = ManagedRuntime.make(testLayer)

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
		const baseTask = task("base_task")
			.run(() => "BASE")
			.make()
		const dynamicTask: Task = {
			...task().make(),
			description: "dynamic_caller",
			effect: (taskCtx) =>
				Effect.gen(function* () {
					executionOrder.push("dynamic_caller_start")
					// Simulate calling another task
					const baseResult = yield* Effect.tryPromise(() =>
						baseTask.effect(taskCtx),
					)
					executionOrder.push("dynamic_caller_end")
					return `called_${baseResult}`
				}).pipe(Effect.runPromise),
		}

		// Track base task execution
		const trackingBaseTask: Task = {
			...baseTask,
			effect: (taskCtx) =>
				Effect.gen(function* () {
					executionOrder.push("base_task")
					const result = yield* Effect.tryPromise(() =>
						baseTask.effect(taskCtx),
					)
					return result
				}).pipe(Effect.runPromise),
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

		const testLayer = makeTestLayer({}, taskTree)
		const runtime = ManagedRuntime.make(testLayer)

		const results = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)

		expect(executionOrder).toEqual([
			"base_task",
			"dynamic_caller_start",
			"dynamic_caller_end",
		])
		expect(results.find((r) => r.taskId === dynamicTask.id)?.result).toBe(
			"called_BASE",
		)
	})

	it("handles cache behavior with different encoding formats", async () => {
		const stringCachedTask = {
			...task()
				.run(() => "string_result")
				.make(),
			computeCacheKey: () => "string_task_key",
			effect: (taskCtx) =>
				Effect.gen(function* () {
					return "string_result"
				}).pipe(Effect.runPromise),
			input: () => Effect.succeed(undefined).pipe(Effect.runPromise),
			encode: (taskCtx, v) =>
				Effect.succeed(v as string).pipe(Effect.runPromise),
			decode: (taskCtx, v) =>
				Effect.succeed(v as string).pipe(Effect.runPromise),
			encodingFormat: "string",
		} satisfies CachedTask<string>

		const binaryCachedTask = {
			...task()
				.run(() => new Uint8Array([1, 2, 3, 4]))
				.make(),
			effect: async (taskCtx) => new Uint8Array([1, 2, 3, 4]),
			computeCacheKey: () => "binary_task_key",
			input: () => Effect.succeed(undefined).pipe(Effect.runPromise),
			encode: (taskCtx, v) => Effect.succeed(v).pipe(Effect.runPromise),
			decode: (taskCtx, v) =>
				Effect.succeed(v as Uint8Array).pipe(Effect.runPromise),
			encodingFormat: "uint8array",
		} satisfies CachedTask<Uint8Array>

		const taskTree = {
			string_cached: stringCachedTask,
			binary_cached: binaryCachedTask,
		}

		const testLayer = makeTestLayer({}, taskTree)
		const runtime = ManagedRuntime.make(testLayer)

		// First run - should cache both
		const firstResults = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks([
					stringCachedTask,
					binaryCachedTask,
				])
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)

		expect(firstResults[0]?.result).toBe("string_result")
		expect(firstResults[1]?.result).toEqual(new Uint8Array([1, 2, 3, 4]))

		// Modify effects to verify cache is used
		stringCachedTask.effect = (taskCtx) => Effect.gen(function* () {
			return "modified_string"
		}).pipe(Effect.runPromise)
		binaryCachedTask.effect = (taskCtx) => Effect.gen(function* () {
			return new Uint8Array([5, 6, 7, 8])
		}).pipe(Effect.runPromise)

		// Second run - should use cache
		const secondResults = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks([
					stringCachedTask,
					binaryCachedTask,
				])
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
		const level1 = task("level1")
			.run(() => "L1")
			.make()
		const level2 = task("level2")
			.run(() => "L2")
			.make()
		const level3 = task("level3")
			.run(() => "L3")
			.make()
		const level4 = task("level4")
			.run(() => "L4")
			.make() as Task // This will fail
		const level5 = task("level5")
			.run(() => "L5")
			.make()
		const level6 = task("level6")
			.run(() => "L6")
			.make()

		// Set up dependencies
		level2.dependencies = { prev: level1 }
		level3.dependencies = { prev: level2 }
		level4.dependencies = { prev: level3 }
		level5.dependencies = { prev: level4 }
		level6.dependencies = { prev: level5 }

		// Make level4 fail
		level4.effect = (taskCtx) => Effect.gen(function* () {
			yield* Effect.fail("Deep chain failure")
		}).pipe(Effect.runPromise)

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
			level1,
			level2,
			level3,
			level4,
			level5,
			level6,
		}

		const testLayer = makeTestLayer({}, taskTree)
		const runtime = ManagedRuntime.make(testLayer)

		await expect(
			runtime.runPromise(
				Effect.gen(function* () {
					const taskEffects = yield* executeTasks(tasks)
					const results = yield* Effect.all(taskEffects, {
						concurrency: "unbounded",
					})
					return results
				}),
			),
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

		const allTasks = [
			chain1Root,
			chain1Middle,
			chain1Leaf,
			chain2Root,
			chain2Middle,
			chain2Leaf,
		]
		const tasks = topologicalSortTasks(
			new Map(allTasks.map((task) => [task.id, task])),
		)

		const taskTree = Object.fromEntries(
			allTasks.map((task) => [task.computeCacheKey(undefined), task]),
		)

		const testLayer = makeTestLayer({}, taskTree)
		const runtime = ManagedRuntime.make(testLayer)

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
		allTasks.forEach((task) => {
			task.effect = async (taskCtx) => {
				throw new Error("Should not execute")
			}
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
		const resultValues = secondResults.map((r) => r.result).sort()
		expect(resultValues).toEqual([
			"C1_LEAF",
			"C1_MIDDLE",
			"C1_ROOT",
			"C2_LEAF",
			"C2_MIDDLE",
			"C2_ROOT",
		])

		// Verify dependency ordering within each chain
		const resultsByTask = new Map(secondResults.map((r) => [r.result, r]))
		const chain1Tasks = ["C1_ROOT", "C1_MIDDLE", "C1_LEAF"]
		const chain2Tasks = ["C2_ROOT", "C2_MIDDLE", "C2_LEAF"]

		// Check that within each chain, tasks completed in dependency order
		// (We can't check exact timing, but we can verify the results are all present)
		chain1Tasks.forEach((task) =>
			expect(resultsByTask.has(task)).toBe(true),
		)
		chain2Tasks.forEach((task) =>
			expect(resultsByTask.has(task)).toBe(true),
		)
	})

	it("handles complex branching with mixed execution times", async () => {
		const executionOrder: Array<string> = []

		// Create complex branching: root -> [fast, slow] -> convergence
		const root = task("root")
			.run(() => "ROOT")
			.make()
		const fastBranch = task("fast")
			.run(() => "FAST")
			.make()
		const slowBranch = task("slow")
			.run(() => "SLOW")
			.make()
		const convergence = task("convergence")
			.run(() => "CONVERGENCE")
			.make()

		// Set up dependencies
		fastBranch.dependencies = { parent: root }
		slowBranch.dependencies = { parent: root }
		convergence.dependencies = { fast: fastBranch, slow: slowBranch }

		// Create tracking tasks with different execution times
		const trackingTasks: Task[] = [
			{
				...root,
				effect: (taskCtx) => Effect.gen(function* () {
					executionOrder.push("root")
					yield* Effect.tryPromise(() => root.effect(taskCtx))
				}).pipe(Effect.runPromise),
			},
			{
				...fastBranch,
				effect: (taskCtx) => Effect.gen(function* () {
					yield* Effect.sleep("10 millis")
					executionOrder.push("fast")
					yield* Effect.tryPromise(() => fastBranch.effect(taskCtx))
				}).pipe(Effect.runPromise),
			},
			{
				...slowBranch,
				effect: (taskCtx) => Effect.gen(function* () {
					yield* Effect.sleep("50 millis")
					executionOrder.push("slow")
					yield* Effect.tryPromise(() => slowBranch.effect(taskCtx))
				}).pipe(Effect.runPromise),
			},
			{
				...convergence,
				effect: (taskCtx) => Effect.gen(function* () {
					executionOrder.push("convergence")
					yield* Effect.tryPromise(() => convergence.effect(taskCtx))
				}).pipe(Effect.runPromise),
			},
		]

		const tasks = topologicalSortTasks(
			new Map(trackingTasks.map((task) => [task.id, task])),
		)

		const taskTree = Object.fromEntries(
			trackingTasks.map((task) => [task.description, task]),
		)

		const testLayer = makeTestLayer({}, taskTree)
		const runtime = ManagedRuntime.make(testLayer)

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
		expect(executionOrder.indexOf("fast")).toBeLessThan(
			executionOrder.indexOf("slow"),
		)
	})
})
