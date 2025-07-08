import { NodeContext } from "@effect/platform-node"
import { layerMemory } from "@effect/platform/KeyValueStore"
import { Effect, Layer, Logger, LogLevel, ManagedRuntime, Ref } from "effect"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { configLayer, customCanister } from "../../src/index.js"
import { CanisterIdsService } from "../../src/services/canisterIds.js"
import { CLIFlags } from "../../src/services/cliFlags.js"
import { DefaultConfig } from "../../src/services/defaultConfig.js"
import { ICEConfigService } from "../../src/services/iceConfig.js"
import { Moc } from "../../src/services/moc.js"
import { picReplicaImpl } from "../../src/services/pic/pic.js"
import { DefaultReplica } from "../../src/services/replica.js"
import { TaskArgsService } from "../../src/services/taskArgs.js"
import { TaskRegistry } from "../../src/services/taskRegistry.js"
import { executeTasks, topologicalSortTasks } from "../../src/tasks/lib.js"
import { runTask } from "../../src/tasks/run.js"
import { ICEConfig, TaskTree } from "../../src/types/types.js"

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

describe("custom builder", () => {
	it("deploy should work", async () => {
		const test_canister = customCanister({
			// TODO: no empty strings!
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()
		const taskTree = {
			test_canister,
		}
		const progress: Array<string> = []
		const tasks = [test_canister.children.deploy]
		const runtime = makeTestRuntime({}, taskTree)
		// const result = await runtime.runPromise()
		const result = await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.deploy)
				return result
			}),
		)
		expect(result.result).toMatchObject({
			canisterId: expect.any(String),
			canisterName: expect.any(String),
		})
	})

	it("should execute canister tasks in correct dependency order", async () => {
		const executionOrder: Array<string> = []

		const test_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()

		// Track execution order by wrapping tasks
		const trackingTasks = [
			test_canister.children.create,
			test_canister.children.build,
			test_canister.children.bindings,
			test_canister.children.install_args,
			test_canister.children.install,
		].map((task) => ({
			...task,
			effect: Effect.gen(function* () {
				executionOrder.push(task.description)
				const result = yield* task.effect
				return result
			}),
		}))

		const tasks = topologicalSortTasks(
			new Map(trackingTasks.map((task) => [task.id, task])),
		)

		const taskTree = {
			test_canister,
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

		// Should execute in dependency order: create, build, bindings, install_args, install
		expect(executionOrder).toContain("Create custom canister")
		expect(executionOrder).toContain("Build custom canister")
		expect(executionOrder).toContain("Generate bindings for custom canister")
		expect(executionOrder).toContain("Generate install args")
		expect(executionOrder).toContain("Install canister code")

		// Create should be first
		expect(executionOrder.indexOf("Create custom canister")).toBeLessThan(
			executionOrder.indexOf("Build custom canister"),
		)
		expect(executionOrder.indexOf("Build custom canister")).toBeLessThan(
			executionOrder.indexOf("Install canister code"),
		)
	})

	it("should cache canister tasks properly", async () => {
		const test_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()

		const taskTree = {
			test_canister,
		}

		const runtime = makeTestRuntime({}, taskTree)

		// First run - should execute and cache
		const firstResult = await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.install)
				return result
			}),
		)

		expect(firstResult.result).toMatchObject({
			canisterId: expect.any(String),
			canisterName: expect.any(String),
		})

		// Second run - should use cache
		const secondResult = await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.install)
				return result
			}),
		)

		expect(secondResult.result).toMatchObject({
			canisterId: firstResult.result.canisterId,
			canisterName: firstResult.result.canisterName,
		})
	})

	it("should handle multiple independent canisters", async () => {
		const canister1 = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()

		const canister2 = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()

		const taskTree = {
			canister1,
			canister2,
		}

		const runtime = makeTestRuntime({}, taskTree)

		// Deploy both canisters
		const results = await runtime.runPromise(
			Effect.gen(function* () {
				const result1 = yield* runTask(canister1.children.deploy)
				const result2 = yield* runTask(canister2.children.deploy)
				return [result1, result2]
			}),
		)

		expect(results).toHaveLength(2)
		expect(results[0]!.result).toMatchObject({
			canisterId: expect.any(String),
			canisterName: expect.any(String),
		})
		expect(results[1]!.result).toMatchObject({
			canisterId: expect.any(String),
			canisterName: expect.any(String),
		})

		// Should have different canister IDs
		expect(results[0]!.result.canisterId).not.toBe(
			results[1]!.result.canisterId,
		)
	})

	it("should handle canister dependencies", async () => {
		const dependency_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()

		const main_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.dependsOn({
				dependency: dependency_canister.children.install,
			})
			.deps({
				dependency: dependency_canister.children.install,
			})
			.installArgs(async ({ ctx, mode, deps }) => {
				// Use the dependency canister in install args
				expect(deps.dependency.canisterId).toBeTruthy()
				return []
			})
			.make()

		const taskTree = {
			dependency_canister,
			main_canister,
		}

		const runtime = makeTestRuntime({}, taskTree)

		const result = await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(main_canister.children.deploy)
				return result
			}),
		)

		expect(result.result).toMatchObject({
			canisterId: expect.any(String),
			canisterName: expect.any(String),
		})
	})

	it("should handle task failure propagation", async () => {
		const failing_canister = customCanister(() => {
			throw new Error("Configuration failed")
		}).make()

		const taskTree = {
			failing_canister,
		}

		const runtime = makeTestRuntime({}, taskTree)

		await expect(
			runtime.runPromise(
				Effect.gen(function* () {
					const result = yield* runTask(failing_canister.children.deploy)
					return result
				}),
			),
		).rejects.toThrow()
	})

	it("should handle complex dependency chains", async () => {
		const executionOrder: Array<string> = []

		const canister1 = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()

		const canister2 = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.dependsOn({
				canister1: canister1.children.install,
			})
			.deps({
				canister1: canister1.children.install,
			})
			.installArgs(async ({ ctx, mode, deps }) => {
				executionOrder.push("canister2_install_args")
				return []
			})
			.make()

		const canister3 = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.dependsOn({
				canister2: canister2.children.install,
			})
			.deps({
				canister2: canister2.children.install,
			})
			.installArgs(async ({ ctx, mode, deps }) => {
				executionOrder.push("canister3_install_args")
				return []
			})
			.make()

		const taskTree = {
			canister1,
			canister2,
			canister3,
		}

		const runtime = makeTestRuntime({}, taskTree)

		await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(canister3.children.deploy)
				return result
			}),
		)

		// Should execute in dependency order
		expect(executionOrder.indexOf("canister2_install_args")).toBeLessThan(
			executionOrder.indexOf("canister3_install_args"),
		)
	})

	it("should handle concurrent canister deployments with limits", async () => {
		const concurrentCounter = Ref.unsafeMake(0)
		const maxConcurrent = Ref.unsafeMake(0)

		const createTimedCanister = (name: string) => {
			return customCanister({
				wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
				candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
			})
				.installArgs(async ({ ctx, mode }) => {
					const current = await Effect.runPromise(
						Ref.updateAndGet(concurrentCounter, (n) => n + 1),
					)
					await Effect.runPromise(
						Ref.update(maxConcurrent, (max) => Math.max(max, current)),
					)
					// Simulate work
					await new Promise((resolve) => setTimeout(resolve, 30))
					await Effect.runPromise(Ref.update(concurrentCounter, (n) => n - 1))
					return []
				})
				.make()
		}

		const canister1 = createTimedCanister("canister1")
		const canister2 = createTimedCanister("canister2")
		const canister3 = createTimedCanister("canister3")

		const taskTree = {
			canister1,
			canister2,
			canister3,
		}

		const runtime = makeTestRuntime({}, taskTree)

		await runtime.runPromise(
			Effect.gen(function* () {
				const tasks = [
					canister1.children.install,
					canister2.children.install,
					canister3.children.install,
				]
				const taskEffects = yield* executeTasks(tasks)
				const results = yield* Effect.all(taskEffects, { concurrency: 2 })
				return results
			}),
		)

		const maxReached = runtime.runSync(Ref.get(maxConcurrent))
		expect(maxReached).toBeLessThanOrEqual(2)
	})

	it("should handle cache invalidation with different configurations", async () => {
		let configVersion = 1

		const dynamic_canister = customCanister(({ ctx }) => ({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
			// Change configuration to invalidate cache
			canisterId: `test-${configVersion}`,
		}))
			.installArgs(async ({ ctx, mode }) => {
				return [`version-${configVersion}`]
			})
			.make()

		const taskTree = {
			dynamic_canister,
		}

		const runtime = makeTestRuntime({}, taskTree)

		// First run with configVersion = 1
		const firstResult = await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(dynamic_canister.children.install)
				return result
			}),
		)

		expect(firstResult.result).toMatchObject({
			canisterId: expect.any(String),
			canisterName: expect.any(String),
		})

		// Change configuration
		configVersion = 2

		// Second run should re-execute due to configuration change
		const secondResult = await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(dynamic_canister.children.install)
				return result
			}),
		)

		expect(secondResult.result).toMatchObject({
			canisterId: expect.any(String),
			canisterName: expect.any(String),
		})
	})

	it("should handle different install modes", async () => {
		const test_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()

		const taskTree = {
			test_canister,
		}

		// Test with install mode
		const runtime = makeTestRuntime(
			{
				cliTaskArgs: { positionalArgs: [], namedArgs: { mode: "install" } },
			},
			taskTree,
		)

		const result = await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.install)
				return result
			}),
		)

		expect(result.result).toMatchObject({
			canisterId: expect.any(String),
			canisterName: expect.any(String),
			mode: "install",
		})
	})

	it("should handle canister stop and remove tasks", async () => {
		const test_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()

		const taskTree = {
			test_canister,
		}

		const runtime = makeTestRuntime({}, taskTree)

		// First deploy the canister
		await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.deploy)
				return result
			}),
		)

		// Then stop it
		await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.stop)
				return result
			}),
		)

		// Then remove it
		await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.remove)
				return result
			}),
		)

		// Should complete without errors
		expect(true).toBe(true)
	})

	it("should handle canister status task", async () => {
		const test_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()

		const taskTree = {
			test_canister,
		}

		const runtime = makeTestRuntime({}, taskTree)

		// Deploy the canister first
		await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.deploy)
				return result
			}),
		)

		// Check status
		const statusResult = await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.status)
				return result
			}),
		)

		expect(statusResult.result).toMatchObject({
			canisterName: expect.any(String),
			canisterId: expect.any(String),
			status: expect.any(String),
		})
	})

	it("should handle mixed cached and non-cached canister tasks", async () => {
		const executionOrder: Array<string> = []

		const test_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.installArgs(async ({ ctx, mode }) => {
				executionOrder.push("install_args_executed")
				return []
			})
			.make()

		const taskTree = {
			test_canister,
		}

		const runtime = makeTestRuntime({}, taskTree)

		// First run - should execute install_args
		await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.install)
				return result
			}),
		)

		expect(executionOrder).toContain("install_args_executed")

		// Reset execution order
		executionOrder.length = 0

		// Second run - install_args should be cached, but install might run again
		await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.install)
				return result
			}),
		)

		// install_args should be cached (not executed again)
		expect(executionOrder).not.toContain("install_args_executed")
	})

	it("should handle error propagation in canister dependency chains", async () => {
		const failing_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.installArgs(async ({ ctx, mode }) => {
				throw new Error("Install args failed")
			})
			.make()

		const dependent_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.dependsOn({
				failing: failing_canister.children.install,
			})
			.deps({
				failing: failing_canister.children.install,
			})
			.installArgs(async ({ ctx, mode, deps }) => {
				return []
			})
			.make()

		const taskTree = {
			failing_canister,
			dependent_canister,
		}

		const runtime = makeTestRuntime({}, taskTree)

		await expect(
			runtime.runPromise(
				Effect.gen(function* () {
					const result = yield* runTask(dependent_canister.children.deploy)
					return result
				}),
			),
		).rejects.toThrow()
	})

	it("should handle complex branching with multiple dependencies", async () => {
		const executionOrder: Array<string> = []

		const root_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.installArgs(async ({ ctx, mode }) => {
				executionOrder.push("root")
				return []
			})
			.make()

		const branch1_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.dependsOn({
				root: root_canister.children.install,
			})
			.deps({
				root: root_canister.children.install,
			})
			.installArgs(async ({ ctx, mode, deps }) => {
				executionOrder.push("branch1")
				return []
			})
			.make()

		const branch2_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.dependsOn({
				root: root_canister.children.install,
			})
			.deps({
				root: root_canister.children.install,
			})
			.installArgs(async ({ ctx, mode, deps }) => {
				executionOrder.push("branch2")
				return []
			})
			.make()

		const convergence_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.dependsOn({
				branch1: branch1_canister.children.install,
				branch2: branch2_canister.children.install,
			})
			.deps({
				branch1: branch1_canister.children.install,
				branch2: branch2_canister.children.install,
			})
			.installArgs(async ({ ctx, mode, deps }) => {
				executionOrder.push("convergence")
				return []
			})
			.make()

		const taskTree = {
			root_canister,
			branch1_canister,
			branch2_canister,
			convergence_canister,
		}

		const runtime = makeTestRuntime({}, taskTree)

		await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(convergence_canister.children.deploy)
				return result
			}),
		)

		// Root should be first, convergence should be last
		expect(executionOrder[0]).toBe("root")
		expect(executionOrder[3]).toBe("convergence")
		// Branch1 and branch2 can run in parallel after root
		expect(executionOrder.slice(1, 3).sort()).toEqual(["branch1", "branch2"])
	})
})
